'use strict';

const { db } = require('./database');

/**
 * Notifications are a secondary side effect: if one cannot be stored, the
 * application/message/interview action that triggered it should still succeed.
 */
function createNotification({ userId, type = 'general', title, body = '', link = null }) {
    const id = Number(userId);
    const cleanTitle = String(title || '').trim().slice(0, 160);

    if (!Number.isInteger(id) || id <= 0 || !cleanTitle) {
        return null;
    }

    try {
        const result = db.prepare(
            'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)'
        ).run(
            id,
            String(type || 'general').slice(0, 40),
            cleanTitle,
            String(body || '').slice(0, 1000),
            link ? String(link).slice(0, 500) : null
        );

        return Number(result.lastInsertRowid);
    } catch (error) {
        console.error('[notifications] Failed to create notification:', error.message);
        return null;
    }
}

module.exports = { createNotification };
