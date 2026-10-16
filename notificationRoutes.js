'use strict';
const express = require('express');
const { db } = require('./database');
const { requireAuth } = require('./auth');
const router = express.Router();
router.get('/', requireAuth, (req,res) => {
 try {
  const id=Number(req.session.userId);
  const notifications=db.prepare('SELECT id,type,title,body,link,read_at,created_at FROM notifications WHERE user_id=? ORDER BY datetime(created_at) DESC,id DESC LIMIT 100').all(id);
  const unreadCount=db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL').get(id).count;
  res.json({success:true,notifications,unreadCount});
 } catch(e){console.error('[notifications] list:',e);res.status(500).json({error:'Failed to load notifications.'});}
});
router.patch('/:id/read',requireAuth,(req,res)=>{
 const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'Invalid notification id.'});
 try{const r=db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?').run(id,Number(req.session.userId));if(!r.changes)return res.status(404).json({error:'Notification not found.'});res.json({success:true});}
 catch(e){console.error('[notifications] mark read:',e);res.status(500).json({error:'Failed to update notification.'});}
});
router.post('/read-all',requireAuth,(req,res)=>{
 try{const r=db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL').run(Number(req.session.userId));res.json({success:true,updated:r.changes});}
 catch(e){console.error('[notifications] read all:',e);res.status(500).json({error:'Failed to update notifications.'});}
});
module.exports=router;
