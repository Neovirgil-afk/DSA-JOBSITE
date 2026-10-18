'use strict';
const express=require('express');
const {db}=require('./database');
const {requireAuth}=require('./auth');
const {getRankedJobsForUser}=require('./JobMatchingService');
const router=express.Router();
// Analytics contain account-specific application and learning progress.
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store, max-age=0');res.set('Pragma','no-cache');next();});
router.get('/me',requireAuth,(req,res)=>{
 try{
  const u=db.prepare('SELECT id,role FROM users WHERE id=?').get(Number(req.session.userId));
  if(!u||u.role!=='candidate')return res.status(403).json({error:'Candidate analytics are only available to candidates.'});
  const rows=db.prepare('SELECT status,COUNT(*) AS count FROM applications WHERE user_id=? GROUP BY status').all(u.id);
  const applicationStatuses=Object.fromEntries(rows.map(r=>[r.status,r.count]));
  const totalApplications=rows.reduce((n,r)=>n+r.count,0);
  const savedJobs=db.prepare('SELECT COUNT(*) AS count FROM saved_jobs WHERE user_id=?').get(u.id).count;
  const upcomingInterviews=db.prepare("SELECT COUNT(*) AS count FROM interviews i JOIN applications a ON a.id=i.application_id WHERE a.user_id=? AND i.status='scheduled' AND datetime(i.scheduled_at)>=datetime('now')").get(u.id).count;
  const unreadNotifications=db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL').get(u.id).count;
  const learning=db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status IN ('completed','verified') THEN 1 ELSE 0 END) AS completed FROM learning_progress WHERE user_id=?").get(u.id);
  const appliedIds=new Set(db.prepare('SELECT job_id FROM applications WHERE user_id=?').all(u.id).map(row=>Number(row.job_id)));
  const monthlyApplications=db.prepare("SELECT strftime('%Y-%m',applied_at) AS month,COUNT(*) AS count FROM applications WHERE user_id=? AND datetime(applied_at)>=datetime('now','-5 months','start of month') GROUP BY strftime('%Y-%m',applied_at) ORDER BY month ASC").all(u.id);
  let recommendations=[];try{recommendations=getRankedJobsForUser(u.id).filter(job=>!appliedIds.has(Number(job.id))).slice(0,5);}catch(e){console.error('[analytics] recommendations unavailable:',e.message);}
  res.json({success:true,stats:{totalApplications,savedJobs,upcomingInterviews,unreadNotifications,learningCompleted:Number(learning.completed||0),learningTotal:Number(learning.total||0),applicationStatuses},monthlyApplications,recommendations});
 }catch(e){console.error('[analytics] candidate overview:',e);res.status(500).json({error:'Failed to load career analytics.'});}
});
module.exports=router;
