'use strict';
const express=require('express');
const {db}=require('./database');
const {requireAuth}=require('./auth');
const {createNotification}=require('./notificationService');
const router=express.Router();
// Interview details and scheduling/status responses are private to participants.
router.use((req,res,next)=>{
 res.set('Cache-Control','private, no-store, max-age=0');
 res.set('Pragma','no-cache');
 next();
});
function getUser(id){return db.prepare('SELECT id,role FROM users WHERE id=?').get(id);}
router.get('/',requireAuth,(req,res)=>{
 try{
  const user=getUser(Number(req.session.userId));
  if(!user||!['candidate','employer','admin'].includes(user.role))return res.status(403).json({error:'This account cannot access interviews.'});
  const rows=db.prepare("SELECT i.id,i.application_id,i.scheduled_at,i.duration_minutes,i.interview_type,i.location_or_link,i.notes,i.status,i.created_at,j.title AS job_title,j.company,u.full_name AS candidate_name,u.id AS candidate_id,j.employer_id FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.user_id WHERE (?='admin') OR (?='candidate' AND a.user_id=?) OR (?='employer' AND j.employer_id=?) ORDER BY datetime(i.scheduled_at) ASC LIMIT 200").all(user.role,user.role,user.id,user.role,user.id);
  res.json({success:true,interviews:rows});
 }catch(e){console.error('[interviews] list:',e);res.status(500).json({error:'Failed to load interviews.'});}
});
router.post('/',requireAuth,(req,res)=>{
 try{
  const user=getUser(Number(req.session.userId));if(!user||user.role!=='employer')return res.status(403).json({error:'Only employers can schedule interviews.'});
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  for (const field of ['scheduledAt', 'interviewType', 'locationOrLink', 'notes']) {
   if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== 'string') {
    return res.status(400).json({error:'Interview date, type, location/link, and notes must be text values.'});
   }
  }
  const appId = Number(payload.applicationId), raw = String(payload.scheduledAt || '').trim(), date = new Date(raw);
  const duration = Number(payload.durationMinutes === undefined ? 30 : payload.durationMinutes), type = String(payload.interviewType || 'online').trim();
  const place = String(payload.locationOrLink || '').trim().slice(0, 2000), notes = String(payload.notes || '').trim().slice(0, 2000);
  if(!Number.isInteger(appId)||appId<=0)return res.status(400).json({error:'Choose a valid application.'});
  if(!raw||Number.isNaN(date.getTime())||date.getTime()<=Date.now())return res.status(400).json({error:'Choose a valid future interview date and time.'});
  if(![15,30,45,60,90,120].includes(duration))return res.status(400).json({error:'Choose an interview duration between 15 and 120 minutes.'});
  if(!['online','phone','onsite'].includes(type))return res.status(400).json({error:'Choose online, phone, or onsite.'});
  if((type==='online'||type==='onsite')&&!place)return res.status(400).json({error:type==='online'?'Enter the interview link.':'Enter the interview location.'});
  const app=db.prepare("SELECT a.id,a.user_id AS candidate_id,a.status,j.id AS job_id,j.title AS job_title,j.employer_id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=? AND j.employer_id=?").get(appId,user.id);
  if(!app)return res.status(404).json({error:'Application not found for your company.'});
  const interviewId=db.transaction(()=>{
   const r=db.prepare('INSERT INTO interviews(application_id,created_by,scheduled_at,duration_minutes,interview_type,location_or_link,notes) VALUES(?,?,?,?,?,?,?)').run(appId,user.id,date.toISOString(),duration,type,place,notes);
   if(app.status!=='interview'){db.prepare("UPDATE applications SET status='interview',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(appId);db.prepare("INSERT INTO application_history(application_id,status) VALUES(?,'interview')").run(appId);}
   return Number(r.lastInsertRowid);
  })();
  createNotification({userId:app.candidate_id,type:'interview',title:'Interview scheduled',body:'An interview for '+app.job_title+' is scheduled for '+date.toLocaleString()+'.',link:'/career-center.html#interviews'});
  res.status(201).json({success:true,interviewId});
 }catch(e){console.error('[interviews] schedule:',e);res.status(500).json({error:'Failed to schedule interview.'});}
});
router.patch('/:id',requireAuth,(req,res)=>{
 try{
  const user=getUser(Number(req.session.userId));if(!user||!['employer','admin'].includes(user.role))return res.status(403).json({error:'Only employers or admins can update interview status.'});
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (payload.status !== undefined && typeof payload.status !== 'string') {
   return res.status(400).json({error:'Interview status must be a text value.'});
  }
  const id = Number(req.params.id), status = String(payload.status || '').trim();
  if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'Invalid interview id.'});
  if(!['scheduled','completed','cancelled'].includes(status))return res.status(400).json({error:'Invalid interview status.'});
  const row=db.prepare('SELECT i.id,i.status AS current_status,a.user_id AS candidate_id,j.title AS job_title,j.employer_id FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=?').get(id);
  if(!row||(user.role==='employer'&&Number(row.employer_id)!==Number(user.id)))return res.status(404).json({error:'Interview not found.'});
  const changed=row.current_status!==status;
  if(changed)db.prepare('UPDATE interviews SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,id);
  if(changed&&status==='cancelled')createNotification({userId:row.candidate_id,type:'interview',title:'Interview cancelled',body:'The interview for '+row.job_title+' was cancelled.',link:'/career-center.html#interviews'});
  res.json({success:true,status,changed});
 }catch(e){console.error('[interviews] update:',e);res.status(500).json({error:'Failed to update interview.'});}
});
module.exports=router;
