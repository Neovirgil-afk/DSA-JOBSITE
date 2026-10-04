'use strict';

const express = require('express');
const { db } = require('./database');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
    try {
        const user = db.prepare(
            'SELECT id, role FROM users WHERE id = ?'
        ).get(req.session.userId);

        if (!user || user.role !== 'candidate') {
            return res.status(403).json({
                error: 'Only candidate accounts can view applications.'
            });
        }

        const applications = db.prepare(
            'SELECT a.id, a.status, a.applied_at, a.updated_at, ' +
            'j.id AS job_id, j.title, j.company, j.location, ' +
            'j.employment_type, j.salary, j.status AS job_status ' +
            'FROM applications a JOIN jobs j ON j.id = a.job_id ' +
            'WHERE a.user_id = ? ORDER BY a.applied_at DESC, a.id DESC'
        ).all(req.session.userId);

        res.json({ success: true, applications });
    } catch (err) {
        console.error('[GET /api/applications] error:', err);
        res.status(500).json({ error: 'Failed to load your applications.' });
    }
});

module.exports = router;