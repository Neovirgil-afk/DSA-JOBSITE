'use strict';
const express=require('express');
const {db}=require('./database');
const {requireAuth}=require('./auth');
const {createNotification}=require('./notificationService');
const router=express.Router();
// Conversations and message contents are private to the application participants.
router.use((req,res,next)=>{
 res.set('Cache-Control','private, no-store, max-age=0');
 res.set('Pragma','no-cache');
 next();
});
function getUser(id){return db.prepare('SELECT id,role,full_name FROM users WHERE id=?').get(id);}
function access(appId,user){return db.prepare("SELECT a.id,a.user_id AS candidate_id,j.employer_id,j.title AS job_title,j.company FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=? AND ((?='candidate' AND a.user_id=?) OR (?='employer' AND j.employer_id=?))").get(appId,user.role,user.id,user.role,user.id);}
router.get('/',requireAuth,(req,res)=>{
 try{
  const u=getUser(Number(req.session.userId));if(!u||!['candidate','employer'].includes(u.role))return res.status(403).json({error:'Messaging is available to candidates and employers.'});
  const rows=db.prepare("SELECT a.id AS application_id,j.title AS job_title,j.company,CASE WHEN ?='candidate' THEN j.employer_id ELSE a.user_id END AS other_user_id,CASE WHEN ?='candidate' THEN COALESCE(cp.company_name,j.company,'Employer') ELSE candidate.full_name END AS other_party,(SELECT body FROM messages m WHERE m.application_id=a.id ORDER BY m.id DESC LIMIT 1) AS last_message,(SELECT created_at FROM messages m WHERE m.application_id=a.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,(SELECT COUNT(*) FROM messages m WHERE m.application_id=a.id AND m.recipient_id=? AND m.read_at IS NULL) AS unread_count FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users candidate ON candidate.id=a.user_id LEFT JOIN company_profiles cp ON cp.user_id=j.employer_id WHERE (?='candidate' AND a.user_id=?) OR (?='employer' AND j.employer_id=?) ORDER BY COALESCE(last_message_at,a.applied_at) DESC").all(u.role,u.role,u.id,u.role,u.id,u.role,u.id);
  res.json({success:true,threads:rows});
 }catch(e){console.error('[messages] threads:',e);res.status(500).json({error:'Failed to load messages.'});}
});
router.get('/:applicationId',requireAuth,(req,res)=>{
 try{
  const u=getUser(Number(req.session.userId));if(!u||!['candidate','employer'].includes(u.role))return res.status(403).json({error:'Messaging is available to candidates and employers.'});
  const appId=Number(req.params.applicationId);if(!Number.isInteger(appId)||appId<=0)return res.status(400).json({error:'Invalid application id.'});
  const app=access(appId,u);if(!app)return res.status(404).json({error:'Conversation not found.'});
  db.prepare('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE application_id=? AND recipient_id=? AND read_at IS NULL').run(appId,u.id);
  const messages=db.prepare('SELECT m.id,m.application_id,m.sender_id,m.recipient_id,m.body,m.read_at,m.created_at,u.full_name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.application_id=? ORDER BY m.id DESC LIMIT 500').all(appId).reverse();
  res.json({success:true,application:app,messages});
 }catch(e){console.error('[messages] conversation:',e);res.status(500).json({error:'Failed to load conversation.'});}
});

// Send one employer-authored message to every applicant for a job owned by this employer.
router.post('/job/:jobId/broadcast',requireAuth,(req,res)=>{
 try{
  const u=getUser(Number(req.session.userId));
  if(!u||u.role!=='employer')return res.status(403).json({error:'Only employers can message all applicants for a job.'});
  const jobId=Number(req.params.jobId);
  if(!Number.isInteger(jobId)||jobId<=0)return res.status(400).json({error:'Invalid job id.'});
  const payload=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  if(typeof payload.body!=='string')return res.status(400).json({error:'Message must be text.'});
  const body=payload.body.trim();
  if(!body)return res.status(400).json({error:'Message cannot be empty.'});
  if(body.length>2000)return res.status(400).json({error:'Messages must be 2,000 characters or fewer.'});
  const job=db.prepare('SELECT id,title FROM jobs WHERE id=? AND employer_id=?').get(jobId,u.id);
  if(!job)return res.status(404).json({error:'Job listing not found for your company.'});
  const applicants=db.prepare('SELECT id AS application_id,user_id AS candidate_id FROM applications WHERE job_id=? ORDER BY id').all(jobId);
  if(!applicants.length)return res.status(400).json({error:'This job listing has no applicants to message.'});
  const insert=db.prepare('INSERT INTO messages(application_id,sender_id,recipient_id,body) VALUES(?,?,?,?)');
  db.transaction(()=>{
   for(const applicant of applicants)insert.run(applicant.application_id,u.id,applicant.candidate_id,body);
  })();
  for(const applicant of applicants){
   createNotification({userId:applicant.candidate_id,type:'message',title:'New message about '+job.title,body:u.full_name+' sent a message to applicants for '+job.title+'.',link:'/career-center.html#messages'});
  }
  res.status(201).json({success:true,sent:applicants.length,jobTitle:job.title});
 }catch(e){console.error('[messages] broadcast:',e);res.status(500).json({error:'Failed to send message to applicants.'});}
});

router.post('/:applicationId',requireAuth,(req,res)=>{
 try{
  const u=getUser(Number(req.session.userId));if(!u||!['candidate','employer'].includes(u.role))return res.status(403).json({error:'Messaging is available to candidates and employers.'});
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (typeof payload.body !== 'string') return res.status(400).json({error:'Message must be text.'});
  const appId = Number(req.params.applicationId), body = payload.body.trim();
  if(!Number.isInteger(appId)||appId<=0)return res.status(400).json({error:'Invalid application id.'});
  if(!body)return res.status(400).json({error:'Message cannot be empty.'});if(body.length>2000)return res.status(400).json({error:'Messages must be 2,000 characters or fewer.'});
  const app=access(appId,u);if(!app)return res.status(404).json({error:'Conversation not found.'});
  const recipientId=u.role==='candidate'?app.employer_id:app.candidate_id;if(!recipientId)return res.status(400).json({error:'The other party is no longer available.'});
  const r=db.prepare('INSERT INTO messages(application_id,sender_id,recipient_id,body) VALUES(?,?,?,?)').run(appId,u.id,recipientId,body);
  createNotification({userId:recipientId,type:'message',title:'New message',body:u.full_name+' sent you a message about '+app.job_title+'.',link:'/career-center.html#messages'});
  res.status(201).json({success:true,messageId:Number(r.lastInsertRowid)});
 }catch(e){console.error('[messages] send:',e);res.status(500).json({error:'Failed to send message.'});}
});
module.exports=router;
