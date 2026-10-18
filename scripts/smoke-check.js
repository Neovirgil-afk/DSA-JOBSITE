'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const failures = [];
let checkedScripts = 0;
let checkedPages = 0;

function fail(message) { failures.push(message); }
function read(relativePath) {
    const absolute = path.join(root, relativePath);
    if (!fs.existsSync(absolute)) {
        fail('Missing required file: ' + relativePath);
        return '';
    }
    return fs.readFileSync(absolute, 'utf8');
}

function checkJavaScript(relativePath) {
    const source = read(relativePath);
    if (!source) return;
    try {
        new vm.Script(source, { filename: relativePath });
        checkedScripts += 1;
    } catch (error) {
        fail('JavaScript syntax error in ' + relativePath + ': ' + error.message);
    }
}

function checkHtml(relativePath, requiredIds, requiredScripts) {
    const source = read(relativePath);
    if (!source) return;
    checkedPages += 1;
    const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
    const seen = new Set();
    const duplicates = new Set();
    for (const id of ids) {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
    }
    if (duplicates.size) fail(relativePath + ' contains duplicate IDs: ' + [...duplicates].join(', '));
    for (const id of requiredIds) if (!seen.has(id)) fail(relativePath + ' is missing required element #' + id);
    if (!source.includes('style.css')) fail(relativePath + ' does not link to style.css.');
    if (!/<meta\s+[^>]*name=["']viewport["']/i.test(source)) fail(relativePath + ' is missing a viewport meta tag.');
    for (const scriptPath of requiredScripts) {
        const scriptName = scriptPath.split('/').pop();
        const hasScript = [...source.matchAll(/\bsrc=["']([^"']+)["']/gi)].some((match) => match[1].split(/[?#]/)[0].replace(/^\//, '') === scriptPath);
        if (!hasScript) fail(relativePath + ' does not load required script ' + scriptPath);
        if (!fs.existsSync(path.join(root, scriptPath))) fail('Missing script referenced by ' + relativePath + ': ' + scriptPath);
    }
}

for (const relativePath of ['database.js', 'server.js', 'sessionStore.js', 'authRoutes.js', 'authRateLimit.js', 'employerRoutes.js', 'messageRoutes.js', 'notificationRoutes.js', 'js/employer.js', 'js/profile.js', 'js/resume-builder.js', 'js/career-center.js', 'js/applications.js', 'js/floating-hub.js', 'CareerPathService.js', 'ESCOService.js', 'Graph.js', 'HashTable.js', 'JobMatcher.js', 'JobMatchingService.js', 'LearningLessons.js', 'LearningResources.js', 'MaxHeap.js', 'ResumeScanner.js', 'SkillGapService.js', 'Sorting.js', 'Tree.js', 'psgcService.js', 'referenceData.js', 'seed.js', 'skillsList.js']) checkJavaScript(relativePath);

checkHtml('employer.html', ['applicantSummary', 'applicantsList', 'applicantPipelineCounts', 'applicantProfileHistory', 'applicantPrivateNotes'], ['js/employer.js', 'js/floating-hub.js']);
checkHtml('profile.html', ['targetJobEditor', 'editTargetJob', 'skillSearchInput'], ['js/profile.js', 'js/floating-hub.js']);
checkHtml('resume-builder.html', ['fullName', 'email', 'phone', 'location', 'summary', 'resumePaper'], ['js/resume-builder.js', 'js/floating-hub.js']);
checkHtml('career-center.html', ['ccTargetJobForm', 'ccTargetJobInput', 'ccLearningPathBody'], ['js/career-center.js', 'js/floating-hub.js']);
checkHtml('applications.html', ['applicationsList', 'exportApplications'], ['js/applications.js', 'js/floating-hub.js']);

// Check the shared stylesheet for unbalanced CSS blocks.
const stylesheet = read('style.css');
if (stylesheet) {
    let depth = 0;
    let lowestDepth = 0;
    for (const character of stylesheet) {
        if (character === '{') depth += 1;
        if (character === '}') depth -= 1;
        if (depth < lowestDepth) lowestDepth = depth;
    }
    if (depth !== 0 || lowestDepth < 0) fail('style.css contains unbalanced braces (final depth: ' + depth + ').');
}

// Confirm the documented local quality-check and startup commands exist.
try {
    const packageJson = JSON.parse(read('package.json'));
    if (!packageJson.scripts || !packageJson.scripts.start) fail('package.json is missing the start script.');
    if (!packageJson.scripts || !packageJson.scripts.check) fail('package.json is missing the check script.');
} catch (error) {
    fail('Could not parse package.json: ' + error.message);
}

const databaseSource = read('database.js');
if (!/db\.pragma\(['"]busy_timeout\s*=\s*5000['"]\)/.test(databaseSource)) {
    fail('SQLite must use a busy timeout to handle brief concurrent-write contention.');
}
if (!/process\.env\.JOBPATH_DB_PATH\s*\?\s*path\.resolve\(process\.env\.JOBPATH_DB_PATH\)/.test(databaseSource) ||
    !/fs\.mkdirSync\(path\.dirname\(DB_PATH\),\s*\{\s*recursive:\s*true\s*\}\)/.test(databaseSource)) {
    fail('SQLite must support a configurable database path and create its parent directory.');
}

const server = read('server.js');
if (!server.includes("String(process.env.SESSION_SECRET || '').trim()")) {
    fail('Production startup must reject an empty or whitespace-only session secret.');
}
if (!/httpServer\.close\(\s*\(error\)\s*=>/.test(server) ||
    !/db\.close\(\)/.test(server) ||
    !/process\.on\(['"]SIGTERM['"]/.test(server) ||
    !/process\.on\(['"]SIGINT['"]/.test(server)) {
    fail('The server must gracefully close its HTTP listener and SQLite connection on SIGTERM and SIGINT.');
}
const routeImports = [...server.matchAll(/const\s+(\w+Routes)\s*=\s*require\(['"]\.\/([^'"]+)['"]\)/g)];
if (routeImports.length === 0) {
    fail('server.js does not declare any route modules.');
} else {
    // Syntax-check every route module discovered from server.js, not only a hand-maintained list.
    for (const match of routeImports) {
        const routeFile = match[2] + '.js';
        if (fs.existsSync(path.join(root, routeFile))) checkJavaScript(routeFile);
    }
    for (const match of routeImports) {
        const routeName = match[1];
        const routePath = match[2];
        if (!fs.existsSync(path.join(root, routePath + '.js'))) {
            fail('server.js imports missing route module: ' + routePath + '.js');
        }
        const mountPattern = new RegExp('app\\.use\\([^\\n]*\\b' + routeName + '\\s*\\)');
        if (!mountPattern.test(server)) fail('server.js imports but does not mount route module ' + routeName + '.');
    }
}

// Guard important production session-cookie and secret settings against accidental removal.
if (!server.includes("!String(process.env.SESSION_SECRET || '').trim()")) {
    fail('server.js must reject missing, empty, or whitespace-only SESSION_SECRET values in production.');
}
// Session data must persist in SQLite rather than Express' default in-memory store.
const sessionStoreSource = read('sessionStore.js');
if (!sessionStoreSource.includes('class SQLiteSessionStore extends session.Store') ||
    !sessionStoreSource.includes('get(sid, callback)') ||
    !sessionStoreSource.includes('set(sid, sessionData, callback)') ||
    !sessionStoreSource.includes('touch(sid, sessionData, callback)') ||
    !sessionStoreSource.includes('destroy(sid, callback)')) {
    fail('SQLite session store must implement get, set, touch, and destroy.');
}
if (!databaseSource.includes('CREATE TABLE IF NOT EXISTS sessions') ||
    !databaseSource.includes('idx_sessions_expires_at')) {
    fail('SQLite must create persistent session storage with an expiry index.');
}
if (!server.includes('store: new SQLiteSessionStore()')) {
    fail('Express sessions must use the persistent SQLite store.');
}
const sessionSecretGuardIndex = server.indexOf("if (process.env.NODE_ENV === 'production' && !String(process.env.SESSION_SECRET || '').trim())");
const databaseImportIndex = server.indexOf("const { db } = require('./database');");
if (sessionSecretGuardIndex < 0 || databaseImportIndex < 0 || sessionSecretGuardIndex > databaseImportIndex) {
    fail('Production session secret validation must run before the database module is loaded.');
}
if (!/httpOnly:\s*true/.test(server)) {
    fail('Session cookies must remain HttpOnly.');
}
if (!/sameSite:\s*['"]lax['"]/.test(server)) {
    fail('Session cookies must retain SameSite=Lax.');
}
if (!/secure:\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/.test(server)) {
    fail('Session cookies must use the secure flag in production.');
}
if (!/app\.set\(\s*['"]trust proxy['"]\s*,\s*1\s*\)/.test(server)) {
    fail('Production deployments must trust the configured reverse proxy for secure cookies.');
}
if (!/express\.json\(\s*\{\s*limit:\s*['"]1mb['"]\s*\}\s*\)/.test(server)) {
    fail('JSON request bodies must retain the 1mb size limit.');
}
if (!/express\.urlencoded\(\s*\{\s*extended:\s*true\s*,\s*limit:\s*['"]1mb['"]\s*\}\s*\)/.test(server)) {
    fail('URL-encoded request bodies must retain the 1mb size limit.');
}
const resumeSignatureSource = read('resumeRoutes.js');
if (!resumeSignatureSource.includes('function hasValidResumeSignature(filePath, originalName)') ||
    !resumeSignatureSource.includes("header.subarray(0, 5).toString('ascii') === '%PDF-'") ||
    !resumeSignatureSource.includes('header[0] === 0x50 && header[1] === 0x4b') ||
    !resumeSignatureSource.includes('The file content does not match a valid PDF or DOCX resume.') ||
    !resumeSignatureSource.includes('fs.unlinkSync(req.file.path)')) {
    fail('Resume uploads must validate PDF/DOCX file signatures and reject mismatched files before scanning.');
}

const authRoutesSource = read('authRoutes.js');
const logoutStart = authRoutesSource.indexOf("router.post('/logout'");
const logoutEnd = authRoutesSource.indexOf("router.get('/me'", logoutStart);
const logoutSource = logoutStart >= 0 && logoutEnd > logoutStart
    ? authRoutesSource.slice(logoutStart, logoutEnd)
    : '';
if (!logoutSource.includes('req.session.destroy((error)') ||
    !logoutSource.includes('res.status(500).json(') ||
    !logoutSource.includes("res.clearCookie('jobpath.sid'")) {
    fail('Logout must report session-destruction failures and clear the session cookie after success.');
}

for (const endpoint of ['register', 'login']) {
    const protectedRoute = new RegExp("router\\.post\\(\\s*['\"]/" + endpoint + "['\"]\\s*,\\s*authRateLimit\\s*,");
    if (!protectedRoute.test(authRoutesSource)) {
        fail('The /' + endpoint + ' endpoint must use authRateLimit.');
    }
}

// Exercise the auth limiter itself so the check catches behavior regressions, not only wiring.
try {
    const authRateLimit = require('../authRateLimit');
    let nextCount = 0;
    const blockedResponse = {
        statusCode: 200,
        headers: {},
        body: null,
        set(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    const request = { ip: 'smoke-check-auth-limiter', baseUrl: '/api/auth', path: '/login' };
    for (let attempt = 0; attempt < 20; attempt += 1) {
        authRateLimit(request, blockedResponse, () => { nextCount += 1; });
    }
    authRateLimit(request, blockedResponse, () => { nextCount += 1; });
    if (nextCount !== 20 || blockedResponse.statusCode !== 429) {
        fail('Authentication rate limiter must allow 20 attempts and block the next attempt.');
    }
    if (!Number(blockedResponse.headers['Retry-After']) || !blockedResponse.body || !blockedResponse.body.error) {
        fail('Blocked authentication attempts must include Retry-After and a JSON error.');
    }
    let separateIpPassed = false;
    authRateLimit({ ip: 'smoke-check-auth-limiter-other', baseUrl: '/api/auth', path: '/login' }, blockedResponse, () => {
        separateIpPassed = true;
    });
    if (!separateIpPassed) fail('Authentication rate limiting must track clients separately.');
} catch (error) {
    fail('Authentication rate limiter behavior check failed: ' + error.message);
}

// Protect resume uploads against unexpectedly large or unsupported files.
const resumeRoutesSource = read('resumeRoutes.js');
if (!/process\.env\.JOBPATH_UPLOAD_DIR\s*\?\s*path\.resolve\(process\.env\.JOBPATH_UPLOAD_DIR\)/.test(resumeRoutesSource) ||
    !/fs\.mkdirSync\(UPLOAD_DIR,\s*\{\s*recursive:\s*true\s*\}\)/.test(resumeRoutesSource)) {
    fail('Resume uploads must support a configurable storage directory and create it when needed.');
}

// Resume builder list fields may contain malformed values from manual/API clients.
const resumeBuilderSaveRoute = resumeRoutesSource.match(/router\.put\(\s*['"]\/builder['"]([\s\S]*?)(?=\nrouter\.(?:get|post|put|delete)\()/);
if (!resumeBuilderSaveRoute ||
    (resumeBuilderSaveRoute[1].match(/\.filter\(\(item\) => item && typeof item === 'object' && !Array\.isArray\(item\)\)/g) || []).length < 4) {
    fail('Resume builder must ignore malformed entries in education, experience, projects, and certifications.');
}
if (!/!data \|\| typeof data !== 'object' \|\| Array\.isArray\(data\)/.test(resumeRoutesSource)) {
    fail('Resume builder must reject array payloads instead of saving them as empty resumes.');
}

if (!/function cleanText\(value, maxLength\)/.test(resumeRoutesSource) ||
    !/\.slice\(0, maxLength\)/.test(resumeRoutesSource) ||
    !/cleanText\(data\.summary, 3000\)/.test(resumeRoutesSource) ||
    !/cleanText\(item\.description, 2000\)/.test(resumeRoutesSource)) {
    fail('Resume builder text fields must be normalized and length-limited before saving.');
}

if (!/limits:\s*\{\s*fileSize:\s*5\s*\*\s*1024\s*\*\s*1024\s*\}/.test(resumeRoutesSource)) {
    fail('Resume uploads must retain the 5MB file-size limit.');
}
if (!/const allowed = \[['"]\.pdf['"],\s*['"]\.docx['"]\]/.test(resumeRoutesSource)) {
    fail('Resume uploads must only accept PDF and DOCX extensions.');
}
if (!/err\.code === ['"]LIMIT_FILE_SIZE['"]/.test(resumeRoutesSource) ||
    !/Maximum size is 5MB/.test(resumeRoutesSource)) {
    fail('Oversized resume uploads must receive a clear size-limit error.');
}
if (!/router\.post\(\s*['"]\/scan['"],\s*requireAuth,\s*requireCandidate/.test(resumeRoutesSource) ||
    !/upload\.single\(['"]resume['"]\)/.test(resumeRoutesSource)) {
    fail('Resume scanning must remain authenticated and use the expected resume upload field.');
}

// Ensure the resume download route checks authentication and candidate role before serving files.
const resumeFileRoute = resumeRoutesSource.match(/router\.get\(\s*['"]\/file['"]([\s\S]*?)(?=\nrouter\.get\(|\nrouter\.post\()/);
if (!resumeFileRoute || !/requireAuth/.test(resumeFileRoute[1]) || !/requireCandidate/.test(resumeFileRoute[1]) || !/res\.sendFile\(/.test(resumeFileRoute[1])) {
    fail('Resume file delivery must remain authenticated, candidate-only, and use the private file endpoint.');
}
const privateResumeResponse = resumeFileRoute?.[1] || '';
if (!privateResumeResponse.includes("'Cache-Control': 'private, no-store, max-age=0'") ||
    !privateResumeResponse.includes("'Pragma': 'no-cache'") ||
    !/const safeFilename =/.test(privateResumeResponse) ||
    !privateResumeResponse.includes(String.raw`.replace(/[\r\n"]/g, '')`)) {
    fail('Private resume downloads must disable caching and sanitize the displayed filename.');
}if (!/req\.file\?\.path/.test(resumeRoutesSource) || !/fs\.unlinkSync\(req\.file\.path\)/.test(resumeRoutesSource)) {
    fail('Failed resume scans must clean up the uploaded file.');
}

if (!/Failed to scan resume\. Please check the file and try again\./.test(resumeRoutesSource) ||
    /Failed to scan resume\. '\s*\+\s*error\.message/.test(resumeRoutesSource)) {
    fail('Resume scan failures must return a generic client error without exposing internal exception details.');
}

// Resume uploads live under the project root, so deny direct public requests before static serving.
const uploadsBlockIndex = server.indexOf("app.use('/uploads'");
const staticFilesIndex = server.indexOf('app.use(express.static(__dirname))');
if (!/app\.use\(\s*['"]\/uploads['"]\s*,\s*\(req,\s*res\)\s*=>\s*\{\s*res\.sendStatus\(404\);?\s*\}\s*\)/.test(server) ||
    uploadsBlockIndex < 0 || staticFilesIndex < 0 || uploadsBlockIndex > staticFilesIndex) {
    fail('Direct requests to /uploads must be blocked before public static-file serving.');
}

// Verify SQLite WAL mode both in source and against a real temporary database.
if (!databaseSource.includes("db.pragma('journal_mode = WAL')")) {
    fail('SQLite should enable WAL journal mode for improved concurrent access.');
}
let temporaryDatabase;
let temporaryDirectory;
try {
    const Database = require('better-sqlite3');
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpath-smoke-'));
    temporaryDatabase = new Database(path.join(temporaryDirectory, 'wal-test.db'));
    const journalMode = temporaryDatabase.pragma('journal_mode = WAL', { simple: true });
    if (String(journalMode).toLowerCase() !== 'wal') {
        fail('SQLite runtime did not activate WAL journal mode.');
    }
    temporaryDatabase.pragma('busy_timeout = 5000');
    const timeout = temporaryDatabase.pragma('busy_timeout', { simple: true });
    if (Number(timeout) !== 5000) {
        fail('SQLite runtime did not apply the 5000ms busy timeout.');
    }
} catch (error) {
    fail('SQLite runtime configuration check failed: ' + error.message);
} finally {
    if (temporaryDatabase) {
        try { temporaryDatabase.close(); } catch (error) {
            fail('Could not close temporary SQLite test database: ' + error.message);
        }
    }
    if (temporaryDirectory) {
        try { fs.rmSync(temporaryDirectory, { recursive: true, force: true }); } catch (error) {
            fail('Could not clean up temporary SQLite test directory: ' + error.message);
        }
    }
}

// SQLite databases and sidecar files must be blocked before static serving.
const databaseFileBlockIndex = server.indexOf('Never expose SQLite database files');
const databaseFileGuard = server.slice(databaseFileBlockIndex, staticFilesIndex);
if (databaseFileBlockIndex < 0 || staticFilesIndex < 0 || databaseFileBlockIndex > staticFilesIndex ||
    !databaseFileGuard.includes('path.basename(req.path).toLowerCase()') ||
    !databaseFileGuard.includes('db|sqlite|sqlite3') ||
    !databaseFileGuard.includes('wal|shm') ||
    !databaseFileGuard.includes('res.sendStatus(404)')) {
    fail('SQLite database files and sidecar files must be blocked before public static-file serving.');
}

// Verify baseline browser security headers are applied by the server.
if (!/res\.setHeader\(['"]X-Content-Type-Options['"],\s*['"]nosniff['"]\)/.test(server) ||
    !/res\.setHeader\(['"]X-Frame-Options['"],\s*['"]DENY['"]\)/.test(server) ||
    !/res\.setHeader\(['"]Referrer-Policy['"],\s*['"]strict-origin-when-cross-origin['"]\)/.test(server) ||
    !/res\.setHeader\(['"]Permissions-Policy['"],\s*['"]camera=\(\), microphone=\(\), geolocation=\(\)['"]\)/.test(server)) {
    fail('Server must apply baseline browser security headers.');
}

// Ensure the lightweight health endpoint remains available for deployment probes.
if (!/app\.get\(\s*['"]\/api\/health['"]/.test(server)) {
    fail('server.js is missing the /api/health endpoint.');
}
if (!/res\.json\(\s*\{\s*status:\s*['"]ok['"]\s*\}\s*\)/.test(server)) {
    fail('/api/health must return a JSON status of ok.');
}
if (!/app\.get\(\s*['"]\/api\/health['"][\s\S]*?db\.prepare\(['"]SELECT 1['"]\)\.get\(\)[\s\S]*?res\.status\(503\)\.json\(/.test(server)) {
    fail('/api/health must check database connectivity and return 503 when the database is unavailable.');
}

if (failures.length) {
    console.error('JobPath smoke check FAILED');
    for (const failure of failures) console.error(' - ' + failure);
    process.exitCode = 1;
} else {
    console.log('JobPath smoke check passed.');
    console.log('Parsed ' + checkedScripts + ' JavaScript files and checked ' + checkedPages + ' key HTML pages.');
}
