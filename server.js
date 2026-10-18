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
const { seedDemoData, cleanupOrphanedJobs } = require('./scripts/seed-demo-data');

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

// Seed the database if it is genuinely new. Do not delete listings before the
// demo employer accounts have been synchronized: that can orphan/remove their jobs.
seedIfNeeded(db);

// Keep the fictional demo employers, candidates, jobs, applications, and conversations
// available automatically for local development. Production stays opt-in because
// these accounts share a known demo password. Cleanup runs only after demo seeding,
// and never runs in production while demo seeding is disabled.
if (process.env.NODE_ENV !== 'production' || process.env.DEMO_SEED_ALLOW_PRODUCTION === '1') {
    seedDemoData();
    cleanupOrphanedJobs();
} else {
    console.log('[demo-seed] Skipped in production. Set DEMO_SEED_ALLOW_PRODUCTION=1 to enable demo accounts and their job listings.');
}

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

// Never expose database files, backend source, package metadata, or deployment docs
// through the public static-file server.
const privateStaticFiles = new Set([
    '.env',
    '.gitignore',
    'adminRoutes.js',
    'analyticsRoutes.js',
    'applicationRoutes.js',
    'auth.js',
    'authRateLimit.js',
    'authRoutes.js',
    'career_platform_setup.md',
    'database.js',
    'DEPLOYMENT.md',
    'employerRoutes.js',
    'interviewRoutes.js',
    'jobRoutes.js',
    'learningDiscoveryRoutes.js',
    'learningPlannerRoutes.js',
    'learningRoutes.js',
    'messageRoutes.js',
    'notificationRoutes.js',
    'notificationService.js',
    'package.json',
    'package-lock.json',
    'referenceRoutes.js',
    'resumeRoutes.js',
    'schema.sql',
    'seed.js',
    'server.js',
    'sessionStore.js',
]);

app.use((req, res, next) => {
    let requestedPath;
    try {
        requestedPath = decodeURIComponent(req.path).toLowerCase();
    } catch (error) {
        return res.sendStatus(404);
    }
    const requestedFile = path.basename(requestedPath);
    const hasPrivatePathSegment = requestedPath.split('/').some((segment) =>
        segment === '.git' || segment === 'node_modules' || segment === 'scripts' ||
        segment === 'backup script'
    );
    const isDatabaseFile = /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/.test(requestedFile);
    const isPrivateFile = requestedPath === '/' + requestedFile && (
        privateStaticFiles.has(requestedFile) ||
        /routes\.js$/.test(requestedFile)
    );

    if (hasPrivatePathSegment || isDatabaseFile || isPrivateFile) {
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
