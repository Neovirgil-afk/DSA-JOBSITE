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
    const ids = [...source.matchAll(/\\bid=["']([^"']+)["']/g)].map((match) => match[1]);
    const seen = new Set();
    const duplicates = new Set();
    for (const id of ids) {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
    }
    if (duplicates.size) fail(relativePath + ' contains duplicate IDs: ' + [...duplicates].join(', '));
    for (const id of requiredIds) if (!seen.has(id)) fail(relativePath + ' is missing required element #' + id);
    for (const scriptPath of requiredScripts) {
        if (!source.includes('src="/' + scriptPath + '"') && !source.includes('src="' + scriptPath + '"')) fail(relativePath + ' does not load required script ' + scriptPath);
        if (!fs.existsSync(path.join(root, scriptPath))) fail('Missing script referenced by ' + relativePath + ': ' + scriptPath);
    }
}

for (const relativePath of ['server.js', 'authRoutes.js', 'employerRoutes.js', 'messageRoutes.js', 'notificationRoutes.js', 'js/employer.js', 'js/profile.js', 'js/resume-builder.js', 'js/career-center.js', 'js/applications.js', 'js/floating-hub.js']) checkJavaScript(relativePath);

checkHtml('employer.html', ['applicantSummary', 'applicantsList', 'applicantPipelineCounts', 'applicantProfileHistory', 'applicantPrivateNotes'], ['js/employer.js', 'js/floating-hub.js']);
checkHtml('profile.html', ['targetJobEditor', 'editTargetJob', 'skillSearchInput'], ['js/profile.js', 'js/floating-hub.js']);
checkHtml('resume-builder.html', ['fullName', 'email', 'phone', 'location', 'summary', 'resumePaper'], ['js/resume-builder.js', 'js/floating-hub.js']);
checkHtml('career-center.html', ['ccTargetJobForm', 'ccTargetJobInput', 'ccLearningPathBody'], ['js/career-center.js', 'js/floating-hub.js']);
checkHtml('applications.html', ['applicationsList', 'exportApplications'], ['js/applications.js', 'js/floating-hub.js']);

const server = read('server.js');
for (const route of ['messageRoutes', 'notificationRoutes', 'employerRoutes', 'authRoutes']) if (!server.includes("require('./" + route + "')")) fail('server.js is missing route module ' + route);

if (failures.length) {
    console.error('JobPath smoke check FAILED');
    for (const failure of failures) console.error(' - ' + failure);
    process.exitCode = 1;
} else {
    console.log('JobPath smoke check passed.');
    console.log('Parsed ' + checkedScripts + ' JavaScript files and checked ' + checkedPages + ' key HTML pages.');
}
