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

for (const relativePath of ['server.js', 'authRoutes.js', 'employerRoutes.js', 'messageRoutes.js', 'notificationRoutes.js', 'js/employer.js', 'js/profile.js', 'js/resume-builder.js', 'js/career-center.js', 'js/applications.js', 'js/floating-hub.js']) checkJavaScript(relativePath);

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
