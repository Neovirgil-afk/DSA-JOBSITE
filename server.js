require('dotenv').config();

// Fail fast before loading the database or route modules in production.
if (process.env.NODE_ENV === 'production' && !String(process.env.SESSION_SECRET || '').trim()) {
    throw new Error('SESSION_SECRET must be configured in production.');
}



const express = require('express');
const session = require('express-session');
const path = require('path');

const { db } = require('./database');
const SQLiteSessionStore = require('./sessionStore');
const { seedIfNeeded } = require('./seed');

const authRoutes = require('./authRoutes');
const jobRoutes = require('./jobRoutes');
const resumeRoutes = require('./resumeRoutes');
const referenceRoutes = require('./referenceRoutes');
const learningRoutes = require('./learningRoutes');
const learningPlannerRoutes = require('./learningPlannerRoutes');
const learningDiscoveryRoutes = require('./learningDiscoveryRoutes');
const employerRoutes = require('./employerRoutes');
const applicationRoutes = require('./applicationRoutes');
const notificationRoutes = require('./notificationRoutes');
const interviewRoutes = require('./interviewRoutes');
const messageRoutes = require('./messageRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const adminRoutes = require('./adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Seed the database with skills/jobs/demo user if empty.
seedIfNeeded(db);

// Optional administrator bootstrap: set ADMIN_EMAIL in the environment,
// create/sign up that account, then restart the server to grant admin access.
const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (configuredAdminEmail) {
    db.prepare('UPDATE users SET role = \'admin\' WHERE email = ?').run(configuredAdminEmail);
}

if (process.env.NODE_ENV === 'production') {
    // Render and other reverse-proxy deployments terminate HTTPS before Node.
    app.set('trust proxy', 1);
}

// Set baseline browser security headers without changing the app's inline-script behavior.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(session({
    store: new SQLiteSessionStore(),
    name: 'jobpath.sid',
    secret: process.env.SESSION_SECRET || 'jobpath-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    },
}));

// Resume files contain private personal information. Block direct public
// access before mounting the general static-file server.
app.use('/uploads', (req, res) => {
    res.sendStatus(404);
});

// Never expose SQLite database files or their write-ahead log files through static serving.
app.use((req, res, next) => {
    const requestedFile = path.basename(req.path).toLowerCase();
    if (/\\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/.test(requestedFile)) {
        return res.sendStatus(404);
    }
    next();
});

app.use(express.static(__dirname));

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/learning/planner', learningPlannerRoutes);
app.use('/api/learning/discover', learningDiscoveryRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);


app.get('/api/health', (req, res) => {
    try {
        db.prepare('SELECT 1').get();
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('[health] database check failed:', error);
        res.status(503).json({ status: 'error', error: 'Database unavailable.' });
    }
});

const httpServer = app.listen(PORT, () => {
    console.log(`[server] JobPath API running on http://localhost:${PORT}`);
});

// Close the HTTP listener before SQLite so in-flight requests can finish
// during Render restarts and other graceful process shutdowns.
let isShuttingDown = false;
function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[server] ${signal} received; shutting down gracefully.`);

    httpServer.close((error) => {
        if (error) {
            console.error('[server] HTTP shutdown failed:', error);
            process.exitCode = 1;
        }

        try {
            db.close();
        } catch (closeError) {
            console.error('[server] Database close failed:', closeError);
            process.exitCode = 1;
        }
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
