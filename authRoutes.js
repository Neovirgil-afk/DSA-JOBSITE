
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database/database');

const router = express.Router();

router.post('/register', (req, res) => {
    try {
        const { fullName, email, password, confirmPassword } = req.body;

        if (!fullName || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const info = db.prepare(`
            INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)
        `).run(fullName.trim(), email.toLowerCase().trim(), passwordHash);

        req.session.userId = info.lastInsertRowid;
        res.json({ success: true, userId: info.lastInsertRowid });
    } catch (err) {
        console.error('[register] error:', err);
        res.status(500).json({ error: 'Something went wrong while creating your account.' });
    }
});

router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        req.session.userId = user.id;
        res.json({ success: true, userId: user.id, fullName: user.full_name });
    } catch (err) {
        console.error('[login] error:', err);
        res.status(500).json({ error: 'Something went wrong while logging in.' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
    const user = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in.' });
    res.json({ user });
});

module.exports = router;
