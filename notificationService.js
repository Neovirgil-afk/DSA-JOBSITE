'use strict';
const { db } = require('./database');
function createNotification({ userId, type = 'general', title, body = '', link = null }) {
 const id = Number(userId), cleanTitle = String(title || '').trim().slice(0,160);
 if (!Number.isInteger(id) || id <= 0 || !cleanTitle) return null;
 const result = db.prepare('INSERT INTO notifications (user_id,type,title,body,link) VALUES (?,?,?,?,?)')
  .run(id,String(type).slice(0,40),cleanTitle,String(body || '').slice(0,1000),link ? String(link).slice(0,500) : null);
 return Number(result.lastInsertRowid);
}
module.exports = { createNotification };
