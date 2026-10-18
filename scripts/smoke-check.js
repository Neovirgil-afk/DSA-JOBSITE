'use strict';

const fs = require('node:fs');
const path = require('node:path');
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

for (const relativePath of ['server.js', 'authRoutes.js', 'authRateLimit.js', 'employerRoutes.js', 'messageRoutes.js', 'notificationRoutes.js', 'js/employer.js', 'js/profile.js', 'js/resume-builder.js', 'js/career-center.js', 'js/applications.js', 'js/floating-hub.js', 'CareerPathService.js', 'ESCOService.js', 'Graph.js', 'HashTable.js', 'JobMatcher.js', 'JobMatchingService.js', 'LearningLessons.js', 'LearningResources.js', 'MaxHeap.js', 'ResumeScanner.js', 'SkillGapService.js', 'Sorting.js', 'Tree.js', 'psgcService.js', 'referenceData.js', 'seed.js', 'skillsList.js']) checkJavaScript(relativePath);

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

const server = read('server.js');
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
if (!/process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*&&\s*!process\.env\.SESSION_SECRET/.test(server)) {
    fail('server.js must require SESSION_SECRET in production.');
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
const authRoutesSource = read('authRoutes.js');
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

// Resume uploads live under the project root, so deny direct public requests before static serving.
const uploadsBlockIndex = server.indexOf("app.use('/uploads'");
const staticFilesIndex = server.indexOf('app.use(express.static(__dirname))');
if (!/app\.use\(\s*['"]\/uploads['"]\s*,\s*\(req,\s*res\)\s*=>\s*\{\s*res\.sendStatus\(404\);?\s*\}\s*\)/.test(server) ||
    uploadsBlockIndex < 0 || staticFilesIndex < 0 || uploadsBlockIndex > staticFilesIndex) {
    fail('Direct requests to /uploads must be blocked before public static-file serving.');
}

// Ensure the lightweight health endpoint remains available for deployment probes.
if (!/app\.get\(\s*['"]\/api\/health['"]/.test(server)) {
    fail('server.js is missing the /api/health endpoint.');
}
if (!/res\.json\(\s*\{\s*status:\s*['"]ok['"]\s*\}\s*\)/.test(server)) {
    fail('/api/health must return a JSON status of ok.');
}

if (failures.length) {
    console.error('JobPath smoke check FAILED');
    for (const failure of failures) console.error(' - ' + failure);
    process.exitCode = 1;
} else {
    console.log('JobPath smoke check passed.');
    console.log('Parsed ' + checkedScripts + ' JavaScript files and checked ' + checkedPages + ' key HTML pages.');
}
