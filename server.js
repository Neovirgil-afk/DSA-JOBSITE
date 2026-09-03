
const express = require('express');
const session = require('express-session');
const path = require('path');

const { db } = require('./database');
const { seedIfNeeded } = require('./seed');

const authRoutes = require('./authRoutes');
const jobRoutes = require('./jobRoutes');
const resumeRoutes = require('./resumeRoutes');
const referenceRoutes = require('./referenceRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Seed the database with skills/jobs/demo user if empty
seedIfNeeded(db);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'jobpath-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true,
    },
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(__dirname));

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/reference', referenceRoutes);


app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`[server] JobPath API running on http://localhost:${PORT}`);
});
