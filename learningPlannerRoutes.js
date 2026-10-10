const express = require('express');
const { db } = require('./database');
const { requireAuth } = require('./auth');

const router = express.Router();
const VALID_STATUSES = new Set(['not_started', 'in_progress', 'completed']);

function requireCandidate(req, res, next) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user || user.role !== 'candidate') {
        return res.status(403).json({ error: 'Only candidate accounts can use the Learning Planner.' });
    }
    next();
}

const SELECT_ITEM = 'SELECT id, title, category, status, notes, created_at, updated_at FROM learning_plans';

router.get('/', requireAuth, requireCandidate, (req, res) => {
    try {
        const items = db.prepare(
            SELECT_ITEM + " WHERE user_id = ? ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'not_started' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, datetime(created_at) DESC, id DESC"
        ).all(req.session.userId);
        res.json({ items });
    } catch (err) {
        console.error('[GET /api/learning/planner] error:', err);
        res.status(500).json({ error: 'Unable to load your learning planner.' });
    }
});

router.post('/', requireAuth, requireCandidate, (req, res) => {
    try {
        const title = String(req.body?.title || '').trim();
        const category = String(req.body?.category || 'Personal interest').trim().slice(0, 80) || 'Personal interest';
        const notes = String(req.body?.notes || '').trim().slice(0, 500);
        if (!title || title.length > 120) {
            return res.status(400).json({ error: 'Enter a learning goal between 1 and 120 characters.' });
        }
        const result = db.prepare(
            'INSERT INTO learning_plans (user_id, title, category, notes) VALUES (?, ?, ?, ?)'
        ).run(req.session.userId, title, category, notes);
        const item = db.prepare(SELECT_ITEM + ' WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.session.userId);
        res.status(201).json({ item });
    } catch (err) {
        console.error('[POST /api/learning/planner] error:', err);
        res.status(500).json({ error: 'Unable to add this learning goal.' });
    }
});

router.patch('/:id', requireAuth, requireCandidate, (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid learning goal.' });
        const existing = db.prepare(
            'SELECT id, title, category, status, notes FROM learning_plans WHERE id = ? AND user_id = ?'
        ).get(id, req.session.userId);
        if (!existing) return res.status(404).json({ error: 'Learning goal not found.' });

        const title = req.body?.title === undefined ? existing.title : String(req.body.title).trim();
        const category = req.body?.category === undefined ? existing.category : String(req.body.category).trim().slice(0, 80);
        const notes = req.body?.notes === undefined ? existing.notes : String(req.body.notes).trim().slice(0, 500);
        const status = req.body?.status === undefined ? existing.status : String(req.body.status);
        if (!title || title.length > 120) return res.status(400).json({ error: 'Goal title must be between 1 and 120 characters.' });
        if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Choose a valid learning status.' });

        db.prepare(
            'UPDATE learning_plans SET title = ?, category = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
        ).run(title, (category || 'Personal interest'), notes, status, id, req.session.userId);
        const item = db.prepare(SELECT_ITEM + ' WHERE id = ? AND user_id = ?').get(id, req.session.userId);
        res.json({ item });
    } catch (err) {
        console.error('[PATCH /api/learning/planner/:id] error:', err);
        res.status(500).json({ error: 'Unable to update this learning goal.' });
    }
});

router.delete('/:id', requireAuth, requireCandidate, (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid learning goal.' });
        const result = db.prepare('DELETE FROM learning_plans WHERE id = ? AND user_id = ?').run(id, req.session.userId);
        if (!result.changes) return res.status(404).json({ error: 'Learning goal not found.' });
        res.json({ success: true, id });
    } catch (err) {
        console.error('[DELETE /api/learning/planner/:id] error:', err);
        res.status(500).json({ error: 'Unable to delete this learning goal.' });
    }
});

module.exports = router;
