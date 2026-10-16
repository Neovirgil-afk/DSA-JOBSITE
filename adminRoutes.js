'use strict';
const express=require('express');
const {db}=require('./database');
const {requireAuth}=require('./auth');
const router=express.Router();
function requireAdmin(req,res,next){const u=db.prepare('SELECT id,role FROM users WHERE id=?').get(Number(req.session.userId));if(!u||u.role!=='admin')return res.status(403).json({error:'Administrator access is required.'});req.admin=u;next();}
router.get('/overview',requireAuth,requireAdmin,(req,res)=>{
 try{
  const count=sql=>Number(db.prepare(sql).get().count||0);
  const stats={users:count('SELECT COUNT(*) AS count FROM users'),candidates:count("SELECT COUNT(*) AS count FROM users WHERE role='candidate'"),employers:count("SELECT COUNT(*) AS count FROM users WHERE role='employer'"),jobs:count('SELECT COUNT(*) AS count FROM jobs'),activeJobs:count("SELECT COUNT(*) AS count FROM jobs WHERE status='active'"),applications:count('SELECT COUNT(*) AS count FROM applications'),interviews:count("SELECT COUNT(*) AS count FROM interviews WHERE status='scheduled'"),unreadMessages:count('SELECT COUNT(*) AS count FROM messages WHERE read_at IS NULL')};
  const recentUsers=db.prepare('SELECT id,full_name,email,role,created_at FROM users ORDER BY id DESC LIMIT 20').all();
  const recentJobs=db.prepare('SELECT id,title,company,status,created_at FROM jobs ORDER BY id DESC LIMIT 20').all();
  const recentApplications=db.prepare('SELECT a.id,a.status,a.applied_at,j.title AS job_title,j.company,u.full_name AS candidate_name FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 20').all();
  res.json({success:true,stats,recentUsers,recentJobs,recentApplications});
 }catch(e){console.error('[admin] overview:',e);res.status(500).json({error:'Failed to load admin overview.'});}
});
router.get('/users',requireAuth,requireAdmin,(req,res)=>{
 try{res.json({success:true,users:db.prepare('SELECT id,full_name,email,role,created_at FROM users ORDER BY id DESC LIMIT 200').all()});}
 catch(e){console.error('[admin] users:',e);res.status(500).json({error:'Failed to load users.'});}
});
router.patch('/jobs/:id/status',requireAuth,requireAdmin,(req,res)=>{
 const id=Number(req.params.id),status=String(req.body.status||'').trim();
 if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'Invalid job id.'});
 if(!['active','paused','closed','draft'].includes(status))return res.status(400).json({error:'Invalid job status.'});
 try{const r=db.prepare('UPDATE jobs SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,id);if(!r.changes)return res.status(404).json({error:'Job not found.'});res.json({success:true,jobId:id,status});}
 catch(e){console.error('[admin] job status:',e);res.status(500).json({error:'Failed to update job status.'});}
});
module.exports=router;
