'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

function listenOnAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

function makeTextPdf(lines) {
    const stream = 'BT /F1 12 Tf 50 760 Td ' + lines.map((line, index) =>
        (index ? '0 -18 Td ' : '') + '(' + line + ') Tj'
    ).join(' ') + ' ET';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream'
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let index = 0; index < objects.length; index++) {
        offsets.push(Buffer.byteLength(pdf, 'ascii'));
        pdf += (index + 1) + ' 0 obj\n' + objects[index] + '\nendobj\n';
    }
    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
    pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
    return Buffer.from(pdf, 'ascii');
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function makeDocx(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const [name, content] of entries) {
        const nameBytes = Buffer.from(name, 'utf8');
        const data = Buffer.from(content, 'utf8');
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, nameBytes, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, nameBytes);
        offset += local.length + nameBytes.length + data.length;
    }
    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...localParts, centralDirectory, end]);
}

function makeTextDocx(lines) {
    const escapeXml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = lines.map((line) => '<w:p><w:r><w:t xml:space="preserve">' + escapeXml(line) + '</w:t></w:r></w:p>').join('');
    return makeDocx([
        ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
        ['word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '<w:sectPr/></w:body></w:document>']
    ]);
}

async function main() {
    const port = await listenOnAvailablePort();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpath-runtime-'));
    const child = spawn(process.execPath, ['server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: String(port),
            SESSION_SECRET: 'runtime-check-only-secret',
            JOBPATH_DB_PATH: path.join(tempDir, 'jobpath.db'),
            JOBPATH_UPLOAD_DIR: path.join(tempDir, 'uploads')
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let logs = '';
    child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
    child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

    let sessionCookie = '';
    async function request(route, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (sessionCookie) headers.Cookie = sessionCookie;
        return fetch('http://127.0.0.1:' + port + route, {
            ...options,
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(2500)
        });
    }

    try {
        let healthy = false;
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
            if (child.exitCode !== null) throw new Error('Server exited before becoming healthy.\n' + logs);
            try {
                const response = await request('/api/health');
                if (response.status === 200) {
                    const body = await response.json();
                    if (body.status !== 'ok') throw new Error('Health endpoint returned an unexpected body.');
                    healthy = true;
                    break;
                }
            } catch (error) {
                if (error.message.includes('unexpected body')) throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (!healthy) throw new Error('Server did not become healthy within 20 seconds.\n' + logs);

        for (const route of ['/', '/profile.html', '/resume-builder.html', '/career-center.html', '/applications.html', '/employer.html']) {
            const response = await request(route);
            if (response.status !== 200) throw new Error('Expected public page ' + route + ' to return 200; received ' + response.status + '.');
            const type = response.headers.get('content-type') || '';
            if (!type.includes('text/html')) throw new Error('Expected ' + route + ' to return HTML, got ' + type + '.');
        }

        for (const route of ['/server.js', '/package.json', '/database.js', '/uploads/private-resume.pdf']) {
            const response = await request(route);
            if (response.status !== 404) throw new Error('Expected private path ' + route + ' to return 404; received ' + response.status + '.');
        }

        const privateApi = await request('/api/resume/current');
        if (![401, 403].includes(privateApi.status)) throw new Error('Unauthenticated resume API should be denied; received ' + privateApi.status + '.');

        const email = 'runtime-' + process.pid + '-' + Date.now() + '@example.com';
        const registration = await request('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Runtime Test Candidate',
                email,
                password: 'RuntimeTest123!',
                confirmPassword: 'RuntimeTest123!',
                education: 'Integration Test School',
                degree: 'Test Degree',
                targetJob: 'Software Developer',
                location: 'Bacoor'
            })
        });
        if (registration.status !== 200) throw new Error('Candidate registration should succeed; received ' + registration.status + ': ' + await registration.text());
        const registrationBody = await registration.json();
        if (!registrationBody.success || !registrationBody.userId) throw new Error('Registration response did not include a created candidate account.');
        const setCookie = registration.headers.get('set-cookie') || '';
        sessionCookie = setCookie.split(';')[0];
        if (!sessionCookie.includes('=')) throw new Error('Registration did not establish a session cookie.');

        const me = await request('/api/auth/me');
        if (me.status !== 200) throw new Error('Newly registered candidate session should work; received ' + me.status + '.');

        // Registration must normalize email casing and prevent duplicate accounts.
        const duplicateRegistration = await request('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Duplicate Runtime Candidate',
                email: '  ' + email.toUpperCase() + '  ',
                password: 'RuntimeTest123!',
                confirmPassword: 'RuntimeTest123!',
                education: 'Integration Test School',
                degree: 'Test Degree',
                targetJob: 'Software Developer',
                location: 'Bacoor'
            })
        });
        if (duplicateRegistration.status !== 409) {
            throw new Error('Registration must reject duplicate emails even with different casing and surrounding whitespace; received ' + duplicateRegistration.status + '.');
        }

        const malformedRegistration = await request('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Invalid Email Candidate',
                email: 'not-an-email',
                password: 'RuntimeTest123!',
                confirmPassword: 'RuntimeTest123!',
                education: 'Integration Test School',
                degree: 'Test Degree',
                targetJob: 'Software Developer',
                location: 'Bacoor'
            })
        });
        if (malformedRegistration.status !== 400) {
            throw new Error('Registration must reject malformed email addresses with 400; received ' + malformedRegistration.status + '.');
        }

        // Invalid credentials and malformed options must be rejected before valid sign-in.
        sessionCookie = '';
        const badPasswordResponse = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'WrongRuntimePassword!' })
        });
        if (badPasswordResponse.status !== 401) throw new Error('Incorrect password must be rejected with 401; received ' + badPasswordResponse.status + '.');

        const malformedRememberResponse = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'RuntimeTest123!', rememberMe: 'false' })
        });
        if (malformedRememberResponse.status !== 400) throw new Error('Non-boolean rememberMe must be rejected with 400; received ' + malformedRememberResponse.status + '.');

        // Exercise sign-in and sign-out independently of the registration session.
        sessionCookie = '';
        const loginResponse = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.toUpperCase(), password: 'RuntimeTest123!' })
        });
        if (loginResponse.status !== 200) throw new Error('Candidate login failed; received ' + loginResponse.status + '.');
        sessionCookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0];
        if (!sessionCookie.includes('=')) throw new Error('Login did not create a session cookie.');

        const logoutResponse = await request('/api/auth/logout', { method: 'POST' });
        if (logoutResponse.status !== 200) throw new Error('Candidate logout failed; received ' + logoutResponse.status + '.');
        sessionCookie = '';
        const afterLogout = await request('/api/auth/me');
        if (afterLogout.status !== 401) throw new Error('Logged-out users must not access the current-user endpoint.');
        const profileAfterLogout = await request('/api/auth/profile');
        if (profileAfterLogout.status !== 401) throw new Error('Logged-out users must not access candidate profile data.');
        const applicationHistoryAfterLogout = await request('/api/applications');
        if (applicationHistoryAfterLogout.status !== 401) throw new Error('Logged-out users must not access application history.');

        const reloginResponse = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'RuntimeTest123!' })
        });
        if (reloginResponse.status !== 200) throw new Error('Candidate should be able to log in again after logout; received ' + reloginResponse.status + '.');
        sessionCookie = (reloginResponse.headers.get('set-cookie') || '').split(';')[0];
        if (!sessionCookie.includes('=')) throw new Error('Relogin did not create a session cookie.');

        const jobsResponse = await request('/api/jobs');
        if (jobsResponse.status !== 200) throw new Error('Public job search should respond successfully; received ' + jobsResponse.status + '.');
        const jobsBody = await jobsResponse.json();
        if (!Array.isArray(jobsBody.jobs) || jobsBody.jobs.length === 0) throw new Error('Fresh database should provide at least one job for the application workflow test.');
        const job = jobsBody.jobs.find((item) => Number.isInteger(Number(item.id)) && Number(item.id) > 0);
        if (!job) throw new Error('Job search returned no job with a valid ID.');

        for (const id of ['0', 'not-a-number']) {
            const invalidApply = await request('/api/jobs/' + id + '/apply', { method: 'POST' });
            if (invalidApply.status !== 400) throw new Error('Invalid application job ID should return 400: ' + id);
        }
        const nonexistentApply = await request('/api/jobs/99999999/apply', { method: 'POST' });
        if (nonexistentApply.status !== 404) throw new Error('Applying to a nonexistent job should return 404.');
        const recommendedJobsResponse = await request('/api/jobs/recommended');
        if (recommendedJobsResponse.status !== 200) throw new Error('Candidate should be able to retrieve recommended jobs; received ' + recommendedJobsResponse.status + '.');
        const recommendedCache = recommendedJobsResponse.headers.get('cache-control') || '';
        if (!/private/i.test(recommendedCache) || !/no-store/i.test(recommendedCache)) {
            throw new Error('Personalized job recommendations must be private and non-cacheable.');
        }
        const recommendedJobs = await recommendedJobsResponse.json();
        if (!Array.isArray(recommendedJobs.jobs)) throw new Error('Recommended jobs response should contain a jobs array.');

        // Validate search filters and saved-job behavior.
        for (const path of ['/api/jobs?minMatch=101', '/api/jobs?minMatch=abc', '/api/jobs?q=' + 'x'.repeat(121)]) {
            const response = await request(path);
            if (response.status !== 400) throw new Error('Invalid job search filter should return 400: ' + path);
        }
        const saved = await request('/api/jobs/saved/' + job.id, { method: 'POST' });
        if (saved.status !== 200) throw new Error('Candidate could not save an existing job.');
        const savedAgain = await request('/api/jobs/saved/' + job.id, { method: 'POST' });
        if (savedAgain.status !== 200) throw new Error('Duplicate save should be safe.');
        const savedListResponse = await request('/api/jobs/saved');
        if (savedListResponse.status !== 200) throw new Error('Candidate could not retrieve saved jobs.');
        const savedList = await savedListResponse.json();
        if (!Array.isArray(savedList.jobs) || savedList.jobs.filter((item) => Number(item.id) === Number(job.id)).length !== 1) {
            throw new Error('Duplicate saves must not create duplicate saved-job entries.');
        }
        const savedCache = savedListResponse.headers.get('cache-control') || '';
        if (!/private/i.test(savedCache) || !/no-store/i.test(savedCache)) throw new Error('Saved jobs must not be cached.');
        for (const id of ['0', 'not-a-number']) {
            const invalid = await request('/api/jobs/saved/' + id, { method: 'POST' });
            if (invalid.status !== 400) throw new Error('Invalid saved-job ID should return 400: ' + id);
        }
        const nonexistent = await request('/api/jobs/saved/99999999', { method: 'POST' });
        if (nonexistent.status !== 404) throw new Error('Nonexistent saved job should return 404.');

        for (const id of ['0', 'not-a-number']) {
            const invalidDelete = await request('/api/jobs/saved/' + id, { method: 'DELETE' });
            if (invalidDelete.status !== 400) throw new Error('Invalid unsave ID should return 400: ' + id);
        }
        const removeSaved = await request('/api/jobs/saved/' + job.id, { method: 'DELETE' });
        if (removeSaved.status !== 200) throw new Error('Candidate should be able to remove their own saved job.');
        const savedAfterRemove = await request('/api/jobs/saved');
        const savedAfterRemoveBody = await savedAfterRemove.json();
        if (!Array.isArray(savedAfterRemoveBody.jobs) || savedAfterRemoveBody.jobs.some((item) => Number(item.id) === Number(job.id))) {
            throw new Error('Removed saved job still appears in the candidate saved-job list.');
        }
        const restoreSaved = await request('/api/jobs/saved/' + job.id, { method: 'POST' });
        if (restoreSaved.status !== 200) throw new Error('Candidate should be able to save a job again after removing it.');
        const apply = await request('/api/jobs/' + job.id + '/apply', { method: 'POST' });
        if (apply.status !== 201) throw new Error('Candidate should be able to apply to an available job; received ' + apply.status + ': ' + await apply.text());
        const applyBody = await apply.json();
        if (!applyBody.success || !applyBody.applicationId) throw new Error('Application response did not include an application ID.');

        const applicationStatus = await request('/api/jobs/' + job.id + '/application');
        if (applicationStatus.status !== 200) throw new Error('Candidate should be able to check their own application status.');
        const applicationStatusBody = await applicationStatus.json();
        if (applicationStatusBody.applied !== true || Number(applicationStatusBody.application?.id) !== Number(applyBody.applicationId)) {
            throw new Error('Application status endpoint should return the current candidate\'s own application.');
        }
        for (const invalidId of ['0', 'not-a-number']) {
            const invalidApplicationStatus = await request('/api/jobs/' + invalidId + '/application');
            if (invalidApplicationStatus.status !== 400) throw new Error('Invalid job ID for application-status lookup should return 400: ' + invalidId);
        }

        const applications = await request('/api/applications');
        if (applications.status !== 200) throw new Error('Candidate should be able to view their applications; received ' + applications.status + '.');
        const applicationsBody = await applications.json();
        if (!Array.isArray(applicationsBody.applications) || !applicationsBody.applications.some((item) => Number(item.id) === Number(applyBody.applicationId))) {
            throw new Error('Submitted application was not returned in the candidate application list.');
        }

        const applicationCacheControl = applications.headers.get('cache-control') || '';
        if (!/private/i.test(applicationCacheControl) || !/no-store/i.test(applicationCacheControl)) {
            throw new Error('Candidate application history must be marked private and non-cacheable.');
        }

        // A second candidate must see only their own application history.
        const firstCandidateCookie = sessionCookie;
        sessionCookie = '';
        const secondCandidateEmail = 'runtime-second-candidate-' + process.pid + '-' + Date.now() + '@example.com';
        const secondCandidateRegistration = await request('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Runtime Second Candidate',
                email: secondCandidateEmail,
                password: 'RuntimeTest123!',
                confirmPassword: 'RuntimeTest123!',
                education: 'Second Integration School',
                degree: 'Test Degree',
                targetJob: 'Software Developer',
                location: 'Bacoor'
            })
        });
        if (secondCandidateRegistration.status !== 200) throw new Error('Second candidate registration should succeed; received ' + secondCandidateRegistration.status + ': ' + await secondCandidateRegistration.text());
        const secondCandidateCookie = (secondCandidateRegistration.headers.get('set-cookie') || '').split(';')[0];
        if (!secondCandidateCookie.includes('=')) throw new Error('Second candidate registration did not establish a session cookie.');
        sessionCookie = secondCandidateCookie;

        const malformedSkills = await request('/api/auth/profile/skills', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillIds: 'not-an-array', skillNames: [] })
        });
        if (malformedSkills.status !== 400) throw new Error('Malformed candidate skill payload should return 400.');
        const secondCandidateSkillUpdate = await request('/api/auth/profile/skills', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillIds: [], skillNames: ['Runtime Custom Skill', 'runtime custom skill', '  Runtime   Custom Skill  '] })
        });
        if (secondCandidateSkillUpdate.status !== 200) throw new Error('Candidate should be able to save custom profile skills; received ' + secondCandidateSkillUpdate.status + '.');
        const secondCandidateSkillBody = await secondCandidateSkillUpdate.json();
        const customSkillEntries = (secondCandidateSkillBody.skills || []).filter((skill) => String(skill.name).toLowerCase() === 'runtime custom skill');
        if (customSkillEntries.length !== 1 || customSkillEntries[0].source !== 'manual') {
            throw new Error('Custom skills should be normalized, deduplicated, and marked as manually added.');
        }
        const secondCandidateProfileWithSkill = await request('/api/auth/profile');
        const secondCandidateProfileWithSkillBody = await secondCandidateProfileWithSkill.json();
        if (!(secondCandidateProfileWithSkillBody.profile?.skills || []).some((skill) => skill.name === 'Runtime Custom Skill' && skill.source === 'manual')) {
            throw new Error('Saved custom skill should appear in the current candidate profile.');
        }
        const secondCandidateApplicationStatus = await request('/api/jobs/' + job.id + '/application');
        if (secondCandidateApplicationStatus.status !== 200) throw new Error('Second candidate should be able to check their own application status.');
        const secondCandidateApplicationStatusBody = await secondCandidateApplicationStatus.json();
        if (secondCandidateApplicationStatusBody.applied !== false || secondCandidateApplicationStatusBody.application !== null) {
            throw new Error('Application-status endpoint exposed another candidate\'s application.');
        }
        const secondCandidateSavedJobsResponse = await request('/api/jobs/saved');
        if (secondCandidateSavedJobsResponse.status !== 200) throw new Error('Second candidate should be able to retrieve saved jobs.');
        const secondCandidateSavedJobs = await secondCandidateSavedJobsResponse.json();
        if (!Array.isArray(secondCandidateSavedJobs.jobs) || secondCandidateSavedJobs.jobs.some((item) => Number(item.id) === Number(job.id))) {
            throw new Error('Saved-job list exposed another candidate\'s saved job.');
        }
        const crossCandidateUnsave = await request('/api/jobs/saved/' + job.id, { method: 'DELETE' });
        if (crossCandidateUnsave.status !== 200) throw new Error('Second candidate unsave request should complete safely.');
        sessionCookie = firstCandidateCookie;
        const firstCandidateProfileAfterSkillUpdate = await request('/api/auth/profile');
        const firstCandidateProfileAfterSkillUpdateBody = await firstCandidateProfileAfterSkillUpdate.json();
        if ((firstCandidateProfileAfterSkillUpdateBody.profile?.skills || []).some((skill) => String(skill.name).toLowerCase() === 'runtime custom skill')) {
            throw new Error('Editing one candidate\'s skills changed another candidate\'s profile.');
        }
        const firstCandidateSavedJobsAfterUnsave = await request('/api/jobs/saved');
        const firstCandidateSavedJobsAfterUnsaveBody = await firstCandidateSavedJobsAfterUnsave.json();
        if (!Array.isArray(firstCandidateSavedJobsAfterUnsaveBody.jobs) || !firstCandidateSavedJobsAfterUnsaveBody.jobs.some((item) => Number(item.id) === Number(job.id))) {
            throw new Error('One candidate was able to remove another candidate\'s saved job.');
        }
        sessionCookie = secondCandidateCookie;
        const secondCandidateApplicationsResponse = await request('/api/applications');
        if (secondCandidateApplicationsResponse.status !== 200) throw new Error('Second candidate should be able to view their own application history.');
        const secondCandidateApplications = await secondCandidateApplicationsResponse.json();
        if (!Array.isArray(secondCandidateApplications.applications) || secondCandidateApplications.applications.some((item) => Number(item.id) === Number(applyBody.applicationId))) {
            throw new Error('Candidate application history exposed another candidate\'s application.');
        }
        const secondCandidateCacheControl = secondCandidateApplicationsResponse.headers.get('cache-control') || '';
        if (!/private/i.test(secondCandidateCacheControl) || !/no-store/i.test(secondCandidateCacheControl)) {
            throw new Error('Second candidate application history must also be non-cacheable.');
        }
        const secondCandidateProfileResponse = await request('/api/auth/profile');
        if (secondCandidateProfileResponse.status !== 200) throw new Error('Second candidate should be able to load their own profile.');
        const secondCandidateProfileBody = await secondCandidateProfileResponse.json();
        if (secondCandidateProfileBody.profile?.full_name !== 'Runtime Second Candidate' ||
            secondCandidateProfileBody.profile?.email?.toLowerCase() !== secondCandidateEmail.toLowerCase()) {
            throw new Error('Candidate profile endpoint returned another user’s identity.');
        }
        const foreignApplicationDetail = await request('/api/auth/applications/' + applyBody.applicationId);
        if (foreignApplicationDetail.status !== 404) throw new Error('Candidate must not access another candidate’s application details; received ' + foreignApplicationDetail.status + '.');
        const secondProfileUpdate = await request('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: 'Runtime Second Candidate Updated', location: 'Las Piñas' })
        });
        if (secondProfileUpdate.status !== 200) throw new Error('Candidate should be able to update their own profile; received ' + secondProfileUpdate.status + '.');
        const secondProfileUpdateBody = await secondProfileUpdate.json();
        if (secondProfileUpdateBody.profile?.full_name !== 'Runtime Second Candidate Updated') {
            throw new Error('Profile update did not return the updated candidate identity.');
        }
        sessionCookie = firstCandidateCookie;
        const firstCandidateProfileAfterOtherUpdate = await request('/api/auth/profile');
        const firstCandidateProfileAfterOtherUpdateBody = await firstCandidateProfileAfterOtherUpdate.json();
        if (firstCandidateProfileAfterOtherUpdateBody.profile?.full_name !== 'Runtime Test Candidate' ||
            firstCandidateProfileAfterOtherUpdateBody.profile?.email?.toLowerCase() !== email.toLowerCase()) {
            throw new Error('Updating one candidate profile changed or exposed another candidate profile.');
        }
        sessionCookie = secondCandidateCookie;
        // Notifications are private per account, and foreign notification IDs cannot be changed.
        const secondCandidateNotificationsResponse = await request('/api/notifications');
        if (secondCandidateNotificationsResponse.status !== 200) throw new Error('Second candidate should be able to load their notifications.');
        const secondCandidateNotificationsBody = await secondCandidateNotificationsResponse.json();
        if (!Array.isArray(secondCandidateNotificationsBody.notifications)) throw new Error('Notification list should return an array.');
        const secondNotificationsCache = secondCandidateNotificationsResponse.headers.get('cache-control') || '';
        if (!/private/i.test(secondNotificationsCache) || !/no-store/i.test(secondNotificationsCache)) {
            throw new Error('Candidate notifications must be private and non-cacheable.');
        }
        const secondCandidateReadAll = await request('/api/notifications/read-all', { method: 'POST' });
        if (secondCandidateReadAll.status !== 200) throw new Error('Candidate should be able to mark all of their own notifications as read.');
        const secondCandidateReadAllBody = await secondCandidateReadAll.json();
        if (!secondCandidateReadAllBody.success || !Number.isInteger(secondCandidateReadAllBody.updated) || secondCandidateReadAllBody.updated < 0) {
            throw new Error('Mark-all-read should report a non-negative count of updated notifications.');
        }
        const secondCandidateNotificationsAfterReadAll = await request('/api/notifications');
        const secondCandidateNotificationsAfterReadAllBody = await secondCandidateNotificationsAfterReadAll.json();
        if (secondCandidateNotificationsAfterReadAllBody.unreadCount !== 0 ||
            secondCandidateNotificationsAfterReadAllBody.notifications?.some((item) => !item.read_at)) {
            throw new Error('Mark-all-read should clear unread notifications for the current candidate.');
        }
        const repeatedSecondCandidateReadAll = await request('/api/notifications/read-all', { method: 'POST' });
        const repeatedSecondCandidateReadAllBody = await repeatedSecondCandidateReadAll.json();
        if (repeatedSecondCandidateReadAll.status !== 200 || repeatedSecondCandidateReadAllBody.updated !== 0) {
            throw new Error('Repeating mark-all-read should succeed without updating already-read notifications.');
        }
        const invalidNotificationRead = await request('/api/notifications/not-a-number/read', { method: 'PATCH' });
        if (invalidNotificationRead.status !== 400) throw new Error('Invalid notification IDs must return 400; received ' + invalidNotificationRead.status + '.');

        sessionCookie = firstCandidateCookie;
        const firstCandidateNotificationsResponse = await request('/api/notifications');
        if (firstCandidateNotificationsResponse.status !== 200) throw new Error('First candidate should be able to load their notifications.');
        const firstCandidateNotificationsBody = await firstCandidateNotificationsResponse.json();
        const firstApplicationNotification = firstCandidateNotificationsBody.notifications?.find((item) =>
            item.type === 'application' && String(item.body || '').includes(job.title)
        );
        if (!firstApplicationNotification) throw new Error('Application submission should create a notification for the candidate.');
        if (firstApplicationNotification.read_at) {
            throw new Error('Marking all notifications as read for another candidate must not change this candidate’s notification.');
        }
        sessionCookie = secondCandidateCookie;
        const foreignNotificationRead = await request('/api/notifications/' + firstApplicationNotification.id + '/read', { method: 'PATCH' });
        if (foreignNotificationRead.status !== 404) throw new Error('A candidate must not mark another candidate’s notification as read; received ' + foreignNotificationRead.status + '.');
        const secondCandidateAfterForeignReadResponse = await request('/api/notifications');
        const secondCandidateAfterForeignRead = await secondCandidateAfterForeignReadResponse.json();
        if (secondCandidateAfterForeignRead.notifications?.some((item) => Number(item.id) === Number(firstApplicationNotification.id))) {
            throw new Error('Notification list exposed another candidate’s notification.');
        }
        sessionCookie = firstCandidateCookie;
        const ownNotificationRead = await request('/api/notifications/' + firstApplicationNotification.id + '/read', { method: 'PATCH' });
        if (ownNotificationRead.status !== 200) throw new Error('Candidate should be able to mark their own notification as read.');
        const firstCandidateAfterRead = await request('/api/notifications');
        const firstCandidateAfterReadBody = await firstCandidateAfterRead.json();
        const markedReadNotification = firstCandidateAfterReadBody.notifications?.find((item) => Number(item.id) === Number(firstApplicationNotification.id));
        if (!markedReadNotification?.read_at) throw new Error('Mark-as-read must persist on the owner’s notification.');
        const originalReadAt = markedReadNotification.read_at;
        const repeatedOwnNotificationRead = await request('/api/notifications/' + firstApplicationNotification.id + '/read', { method: 'PATCH' });
        if (repeatedOwnNotificationRead.status !== 200) throw new Error('Marking an already-read notification should remain safe.');
        const notificationAfterRepeatedRead = await request('/api/notifications');
        const notificationAfterRepeatedReadBody = await notificationAfterRepeatedRead.json();
        const repeatedReadRecord = notificationAfterRepeatedReadBody.notifications?.find((item) => Number(item.id) === Number(firstApplicationNotification.id));
        if (!repeatedReadRecord?.read_at || repeatedReadRecord.read_at !== originalReadAt) {
            throw new Error('Marking an already-read notification must preserve its original read timestamp.');
        }
        const firstCandidateReadAll = await request('/api/notifications/read-all', { method: 'POST' });
        if (firstCandidateReadAll.status !== 200) throw new Error('Candidate should be able to mark all their notifications as read.');
        const firstCandidateReadAllBody = await firstCandidateReadAll.json();
        if (!firstCandidateReadAllBody.success || !Number.isInteger(firstCandidateReadAllBody.updated) || firstCandidateReadAllBody.updated < 0) {
            throw new Error('First candidate mark-all-read response should include a valid updated count.');
        }
        const firstCandidateNotificationsAfterReadAll = await request('/api/notifications');
        const firstCandidateNotificationsAfterReadAllBody = await firstCandidateNotificationsAfterReadAll.json();
        if (firstCandidateNotificationsAfterReadAllBody.unreadCount !== 0 ||
            firstCandidateNotificationsAfterReadAllBody.notifications?.some((item) => !item.read_at)) {
            throw new Error('Mark-all-read should clear every unread notification for the first candidate.');
        }
        const repeatedFirstCandidateReadAll = await request('/api/notifications/read-all', { method: 'POST' });
        const repeatedFirstCandidateReadAllBody = await repeatedFirstCandidateReadAll.json();
        if (repeatedFirstCandidateReadAll.status !== 200 || repeatedFirstCandidateReadAllBody.updated !== 0) {
            throw new Error('Repeated mark-all-read should be idempotent and report zero updated records.');
        }

        const duplicateApply = await request('/api/jobs/' + job.id + '/apply', { method: 'POST' });
        if (duplicateApply.status !== 409) throw new Error('Duplicate applications should be rejected with 409; received ' + duplicateApply.status + '.');

        // Exercise the employer side and verify candidate/employer data is linked correctly.
        const candidateCookie = sessionCookie;
        // Use a separate unauthenticated client for employer registration so session regeneration
        // cannot invalidate the candidate session used later in the cross-role workflow.
        sessionCookie = '';
        const employerEmail = 'runtime-employer-' + process.pid + '-' + Date.now() + '@example.com';
        const employerRegistration = await request('/api/employer/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Runtime Test Employer',
                email: employerEmail,
                password: 'RuntimeEmployer123!',
                confirmPassword: 'RuntimeEmployer123!',
                companyName: 'Runtime Test Company ' + process.pid
            })
        });
        if (employerRegistration.status !== 200) throw new Error('Employer registration should succeed; received ' + employerRegistration.status + ': ' + await employerRegistration.text());
        const employerBody = await employerRegistration.json();
        if (!employerBody.success || employerBody.role !== 'employer') throw new Error('Employer registration did not create an employer account.');
        const employerCookieHeader = employerRegistration.headers.get('set-cookie') || '';
        const employerCookie = employerCookieHeader.split(';')[0];
        if (!employerCookie.includes('=')) throw new Error('Employer registration did not establish a session cookie.');

        sessionCookie = employerCookie;
        const employerSavedJobsAccess = await request('/api/jobs/saved');
        if (employerSavedJobsAccess.status !== 403) throw new Error('Employer accounts must not access candidate saved-job features; received ' + employerSavedJobsAccess.status + '.');
        const employerMe = await request('/api/employer/me');
        if (employerMe.status !== 200) throw new Error('Employer session should be authorized; received ' + employerMe.status + '.');

        const employerApplicationsAccess = await request('/api/applications');
        if (employerApplicationsAccess.status !== 403) throw new Error('Employer accounts must not access candidate application history; received ' + employerApplicationsAccess.status + '.');
        const employerApplicationsCacheControl = employerApplicationsAccess.headers.get('cache-control') || '';
        if (!/private/i.test(employerApplicationsCacheControl) || !/no-store/i.test(employerApplicationsCacheControl)) {
            throw new Error('Application API responses, including access-denied responses, must not be publicly cached.');
        }

        const employerProfileAccess = await request('/api/auth/profile');
        if (employerProfileAccess.status !== 403) throw new Error('Employer accounts must not access candidate profile data; received ' + employerProfileAccess.status + '.');

        // Company profile validation should reject malformed payloads without changing stored data.
        const malformedCompanyProfile = await request('/api/employer/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName: 42 })
        });
        if (malformedCompanyProfile.status !== 400) throw new Error('Company profile updates must reject non-text fields; received ' + malformedCompanyProfile.status + '.');

        const validCompanyProfileUpdate = await request('/api/employer/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyName: employerBody.companyName,
                description: 'Runtime integration test company profile description.',
                industry: 'Software',
                location: 'Philippines'
            })
        });
        if (validCompanyProfileUpdate.status !== 200) throw new Error('A valid company profile update should succeed; received ' + validCompanyProfileUpdate.status + ': ' + await validCompanyProfileUpdate.text());
        const validCompanyProfileBody = await validCompanyProfileUpdate.json();
        if (validCompanyProfileBody.company?.description !== 'Runtime integration test company profile description.') {
            throw new Error('Successful company profile update did not return the saved description.');
        }
        const companyProfileReload = await request('/api/employer/me');
        const companyProfileReloadBody = await companyProfileReload.json();
        if (companyProfileReload.status !== 200 || companyProfileReloadBody.company?.industry !== 'Software' || companyProfileReloadBody.company?.location !== 'Philippines') {
            throw new Error('Company profile fields did not persist after reloading the employer profile.');
        }

        const invalidJobTitle = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: '   ',
                description: 'Invalid title test',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.'
            })
        });
        if (invalidJobTitle.status !== 400) throw new Error('Job postings must reject a blank title; received ' + invalidJobTitle.status + '.');

        const invalidCreateJobStatus = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Invalid Status Create Test',
                description: 'Unsupported status values must never publish a job by default.',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                status: 'published-and-secret'
            })
        });
        if (invalidCreateJobStatus.status !== 400) {
            throw new Error('Job creation must reject unsupported statuses rather than silently publishing; received ' + invalidCreateJobStatus.status + '.');
        }

        const invalidJobDeadline = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Invalid Deadline Test',
                description: 'Invalid deadline test',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                applicationDeadline: '2026-02-31'
            })
        });
        if (invalidJobDeadline.status !== 400) throw new Error('Job postings must reject impossible calendar deadlines; received ' + invalidJobDeadline.status + '.');

        const pastJobDeadline = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Past Deadline Test',
                description: 'Active jobs must not use a deadline in the past.',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                applicationDeadline: '2020-01-01',
                status: 'active'
            })
        });
        if (pastJobDeadline.status !== 400) throw new Error('Active job postings must reject deadlines in the past; received ' + pastJobDeadline.status + '.');

        const oversizedJobTitle = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'T'.repeat(121),
                description: 'Overlong title test',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.'
            })
        });
        if (oversizedJobTitle.status !== 400) throw new Error('Job postings must reject titles longer than 120 characters; received ' + oversizedJobTitle.status + '.');

        const postedJobResponse = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Runtime Integration Developer',
                description: 'A temporary job posting used only by the automated integration check.',
                skills: ['JavaScript', 'Node.js'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                status: 'active'
            })
        });
        if (postedJobResponse.status !== 201) throw new Error('Employer should be able to publish a job; received ' + postedJobResponse.status + ': ' + await postedJobResponse.text());
        const postedJobBody = await postedJobResponse.json();
        const postedJobId = Number(postedJobBody.job?.id);
        if (!postedJobBody.success || !Number.isInteger(postedJobId) || postedJobId <= 0) throw new Error('Employer job posting response did not include a valid job.');

        const employerJobs = await request('/api/employer/jobs');
        if (employerJobs.status !== 200) throw new Error('Employer should be able to view company jobs; received ' + employerJobs.status + '.');
        const employerJobsBody = await employerJobs.json();
        if (!employerJobsBody.jobs?.some((item) => Number(item.id) === postedJobId)) throw new Error('Newly posted job was not returned in the employer job list.');

        const draftJobCreateResponse = await request('/api/employer/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Runtime Draft Visibility Check',
                description: 'Draft job visibility and publication transition integration test.',
                category: 'Runtime Unpublished Category',
                skills: ['Python'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                status: 'draft'
            })
        });
        if (draftJobCreateResponse.status !== 201) {
            throw new Error('Employer should be able to save a valid draft job; received ' + draftJobCreateResponse.status + ': ' + await draftJobCreateResponse.text());
        }
        const draftJobCreateBody = await draftJobCreateResponse.json();
        const draftJobId = Number(draftJobCreateBody.job?.id);
        if (draftJobCreateBody.job?.status !== 'draft' || !Number.isInteger(draftJobId) || draftJobId <= 0) {
            throw new Error('A job created as draft must retain its draft status and return a valid ID.');
        }
        const employerJobsWithDraft = await request('/api/employer/jobs');
        const employerJobsWithDraftBody = await employerJobsWithDraft.json();
        if (!employerJobsWithDraftBody.jobs?.some((item) => Number(item.id) === draftJobId && item.status === 'draft')) {
            throw new Error('Employer job list should include the employer’s saved draft.');
        }
        sessionCookie = candidateCookie;
        const publicJobsWithDraft = await request('/api/jobs');
        const publicJobsWithDraftBody = await publicJobsWithDraft.json();
        if (publicJobsWithDraftBody.jobs?.some((item) => Number(item.id) === draftJobId)) {
            throw new Error('Draft postings must not appear in public candidate job search.');
        }
        const publicDraftDetails = await request('/api/jobs/' + draftJobId);
        if (publicDraftDetails.status !== 404) {
            throw new Error('Draft job details must be hidden from public lookup; received ' + publicDraftDetails.status + '.');
        }
        const publicCategoriesWithDraft = await request('/api/jobs/categories');
        if (publicCategoriesWithDraft.status !== 200) throw new Error('Public job categories should load while drafts exist.');
        const publicCategoriesWithDraftBody = await publicCategoriesWithDraft.json();
        if (publicCategoriesWithDraftBody.counts?.some((item) => item.category === 'Runtime Unpublished Category')) {
            throw new Error('Unpublished drafts must not contribute to public job category counts.');
        }
        const saveDraftAsCandidate = await request('/api/jobs/saved/' + draftJobId, { method: 'POST' });
        if (saveDraftAsCandidate.status !== 404) {
            throw new Error('Candidates must not be able to save unpublished drafts; received ' + saveDraftAsCandidate.status + '.');
        }
        const savedJobsWhileDraftExists = await request('/api/jobs/saved');
        const savedJobsWhileDraftExistsBody = await savedJobsWhileDraftExists.json();
        if (savedJobsWhileDraftExistsBody.jobs?.some((item) => Number(item.id) === draftJobId)) {
            throw new Error('Unpublished draft jobs must not appear in a candidate’s saved-job list.');
        }
        sessionCookie = employerCookie;
        const publishDraftResponse = await request('/api/employer/jobs/' + draftJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
        });
        if (publishDraftResponse.status !== 200) {
            throw new Error('Employer should be able to publish a valid draft; received ' + publishDraftResponse.status + '.');
        }
        sessionCookie = candidateCookie;
        const publicJobsAfterDraftPublished = await request('/api/jobs');
        const publicJobsAfterDraftPublishedBody = await publicJobsAfterDraftPublished.json();
        if (!publicJobsAfterDraftPublishedBody.jobs?.some((item) => Number(item.id) === draftJobId)) {
            throw new Error('Publishing a draft should make the job available in public candidate search.');
        }
        const publishedDraftDetails = await request('/api/jobs/' + draftJobId);
        if (publishedDraftDetails.status !== 200) {
            throw new Error('Published draft details should become available in public lookup; received ' + publishedDraftDetails.status + '.');
        }
        const publishedDraftDetailsBody = await publishedDraftDetails.json();
        if (publishedDraftDetailsBody.job?.status !== 'active') {
            throw new Error('Public job details should expose the published active status after a draft is published.');
        }
        const publicCategoriesAfterPublish = await request('/api/jobs/categories');
        const publicCategoriesAfterPublishBody = await publicCategoriesAfterPublish.json();
        if (!publicCategoriesAfterPublishBody.counts?.some((item) => item.category === 'Runtime Unpublished Category' && Number(item.count) >= 1)) {
            throw new Error('Publishing a draft should add its category to public category counts.');
        }
        sessionCookie = employerCookie;

        for (const invalidStatusValue of ['published-and-secret', 42, null, {}]) {
            const invalidStatusUpdate = await request('/api/employer/jobs/' + postedJobId + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: invalidStatusValue })
            });
            if (invalidStatusUpdate.status !== 400) {
                throw new Error('Job status endpoint must reject malformed or unsupported status values; received ' + invalidStatusUpdate.status + '.');
            }
        }
        const missingStatusUpdate = await request('/api/employer/jobs/' + postedJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (missingStatusUpdate.status !== 400) throw new Error('Job status endpoint must reject a missing status value.');

        const malformedJobStatusId = await request('/api/employer/jobs/not-a-number/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' })
        });
        if (malformedJobStatusId.status !== 400) throw new Error('Job status endpoint must reject malformed job IDs; received ' + malformedJobStatusId.status + '.');

        const missingJobStatusId = await request('/api/employer/jobs/999999/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' })
        });
        if (missingJobStatusId.status !== 404) throw new Error('Job status endpoint must return 404 for a nonexistent posting; received ' + missingJobStatusId.status + '.');

        const jobAfterInvalidStatusUpdates = await request('/api/employer/jobs');
        const jobAfterInvalidStatusUpdatesBody = await jobAfterInvalidStatusUpdates.json();
        const unchangedStatusJob = jobAfterInvalidStatusUpdatesBody.jobs?.find((item) => Number(item.id) === postedJobId);
        if (!unchangedStatusJob || unchangedStatusJob.status !== 'active') {
            throw new Error('Rejected status updates must leave the existing job active and unchanged.');
        }

        const invalidJobEdit = await request('/api/employer/jobs/' + postedJobId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: '   ',
                description: 'Invalid update test',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                status: 'active'
            })
        });
        if (invalidJobEdit.status !== 400) throw new Error('Job updates must reject a blank title; received ' + invalidJobEdit.status + '.');

        const invalidDeadlineEdit = await request('/api/employer/jobs/' + postedJobId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Runtime Integration Developer',
                description: 'A temporary job posting used only by the automated integration check.',
                skills: ['JavaScript', 'Node.js'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                applicationDeadline: '2020-01-01',
                status: 'active'
            })
        });
        if (invalidDeadlineEdit.status !== 400) throw new Error('Job updates must reject past deadlines on active postings; received ' + invalidDeadlineEdit.status + '.');

        const invalidJobStatusEdit = await request('/api/employer/jobs/' + postedJobId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Runtime Integration Developer',
                description: 'A temporary job posting used only by the automated integration check.',
                skills: ['JavaScript', 'Node.js'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.',
                status: 'published-and-secret'
            })
        });
        if (invalidJobStatusEdit.status !== 400) {
            throw new Error('Job edits must reject unsupported statuses instead of silently switching the posting to active; received ' + invalidJobStatusEdit.status + '.');
        }

        const jobAfterRejectedEdits = await request('/api/employer/jobs');
        const jobAfterRejectedEditsBody = await jobAfterRejectedEdits.json();
        const unchangedJob = jobAfterRejectedEditsBody.jobs?.find((item) => Number(item.id) === postedJobId);
        if (!unchangedJob || unchangedJob.title !== 'Runtime Integration Developer') {
            throw new Error('Rejected job edits must not modify the existing posting.');
        }

        sessionCookie = candidateCookie;
        const applyToEmployerJob = await request('/api/jobs/' + postedJobId + '/apply', { method: 'POST' });
        if (applyToEmployerJob.status !== 201) throw new Error('Candidate should be able to apply to the employer-created job; received ' + applyToEmployerJob.status + ': ' + await applyToEmployerJob.text());
        const employerJobApplication = await applyToEmployerJob.json();
        const employerApplicationId = Number(employerJobApplication.applicationId);

        if (!Number.isInteger(employerApplicationId) || employerApplicationId <= 0) throw new Error('Application to employer-created job did not return a valid application ID.');

        // The job application status endpoint must reflect only the signed-in candidate's application.
        const ownJobApplicationStatus = await request('/api/jobs/' + postedJobId + '/application');
        if (ownJobApplicationStatus.status !== 200) throw new Error('Candidate should be able to check their application status for a job; received ' + ownJobApplicationStatus.status + '.');
        const ownJobApplicationStatusBody = await ownJobApplicationStatus.json();
        if (ownJobApplicationStatusBody.applied !== true || Number(ownJobApplicationStatusBody.application?.id) !== employerApplicationId) {
            throw new Error('Application status endpoint should return the signed-in candidate’s own application.');
        }
        const ownApplicationCache = ownJobApplicationStatus.headers.get('cache-control') || '';
        if (!/private/i.test(ownApplicationCache) || !/no-store/i.test(ownApplicationCache)) throw new Error('Job application status responses must not be publicly cached.');

        sessionCookie = secondCandidateCookie;
        const otherCandidateJobApplicationStatus = await request('/api/jobs/' + postedJobId + '/application');
        if (otherCandidateJobApplicationStatus.status !== 200) throw new Error('A candidate with no application should receive an application-status response.');
        const otherCandidateJobApplicationStatusBody = await otherCandidateJobApplicationStatus.json();
        if (otherCandidateJobApplicationStatusBody.applied !== false || otherCandidateJobApplicationStatusBody.application !== null) {
            throw new Error('Application status endpoint must not expose another candidate’s application.');
        }

        const invalidApplicationStatusId = await request('/api/jobs/not-a-number/application');
        if (invalidApplicationStatusId.status !== 400) throw new Error('Application status checks must reject malformed job IDs; received ' + invalidApplicationStatusId.status + '.');

        // Closed jobs must reject new applications without creating application records.
        sessionCookie = employerCookie;
        const closeJobForApplicationCheck = await request('/api/employer/jobs/' + postedJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' })
        });
        if (closeJobForApplicationCheck.status !== 200) throw new Error('Job owner should be able to close a job before application rejection checks; received ' + closeJobForApplicationCheck.status + '.');
        const companiesWithClosedJob = await request('/api/jobs/companies');
        if (companiesWithClosedJob.status !== 200) throw new Error('Public company listing should remain available when a job is closed.');
        const companiesWithClosedJobBody = await companiesWithClosedJob.json();
        const closedJobCompany = companiesWithClosedJobBody.companies?.find((item) => item.company_name === employerBody.companyName);
        const closedCompanyOpenJobs = closedJobCompany ? Number(closedJobCompany.open_jobs) : null;
        if (!Number.isInteger(closedCompanyOpenJobs) || closedCompanyOpenJobs < 0) {
            throw new Error('Public company listing should expose a valid open-job count for the employer.');
        }

        sessionCookie = secondCandidateCookie;
        const applyToClosedJob = await request('/api/jobs/' + postedJobId + '/apply', { method: 'POST' });
        if (applyToClosedJob.status !== 400) throw new Error('Closed jobs must reject new applications with 400; received ' + applyToClosedJob.status + '.');
        const closedJobApplicationStatus = await request('/api/jobs/' + postedJobId + '/application');
        const closedJobApplicationStatusBody = await closedJobApplicationStatus.json();
        if (closedJobApplicationStatus.status !== 200 || closedJobApplicationStatusBody.applied !== false || closedJobApplicationStatusBody.application !== null) {
            throw new Error('A rejected application to a closed job must not create an application record.');
        }

        // Draft postings are private/unpublished and must also reject applications.
        sessionCookie = employerCookie;
        const setDraftForApplicationCheck = await request('/api/employer/jobs/' + postedJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'draft' })
        });
        if (setDraftForApplicationCheck.status !== 200) {
            throw new Error('Job owner should be able to move a posting to draft; received ' + setDraftForApplicationCheck.status + '.');
        }

        sessionCookie = secondCandidateCookie;
        const applyToDraftJob = await request('/api/jobs/' + postedJobId + '/apply', { method: 'POST' });
        if (applyToDraftJob.status !== 400) {
            throw new Error('Draft jobs must reject applications with 400; received ' + applyToDraftJob.status + '.');
        }
        const draftJobApplicationStatus = await request('/api/jobs/' + postedJobId + '/application');
        const draftJobApplicationStatusBody = await draftJobApplicationStatus.json();
        if (draftJobApplicationStatus.status !== 200 || draftJobApplicationStatusBody.applied !== false || draftJobApplicationStatusBody.application !== null) {
            throw new Error('A rejected application to a draft job must not create an application record.');
        }

        sessionCookie = employerCookie;
        const reopenJobAfterApplicationCheck = await request('/api/employer/jobs/' + postedJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
        });
        if (reopenJobAfterApplicationCheck.status !== 200) throw new Error('Job owner should be able to reopen a job after the closed-job application test; received ' + reopenJobAfterApplicationCheck.status + '.');
        const companiesWithReopenedJob = await request('/api/jobs/companies');
        const companiesWithReopenedJobBody = await companiesWithReopenedJob.json();
        const reopenedJobCompany = companiesWithReopenedJobBody.companies?.find((item) => item.company_name === employerBody.companyName);
        if (!reopenedJobCompany || Number(reopenedJobCompany.open_jobs) !== closedCompanyOpenJobs + 1) {
            throw new Error('Public company open-job counts should increase by one when this job is reopened.');
        }
        sessionCookie = candidateCookie;

        sessionCookie = employerCookie;
        const applicantsResponse = await request('/api/employer/jobs/' + postedJobId + '/applicants');
        if (applicantsResponse.status !== 200) throw new Error('Employer should be able to view applicants for its own job; received ' + applicantsResponse.status + ': ' + await applicantsResponse.text());
        const applicantsBody = await applicantsResponse.json();
        if (!applicantsBody.applicants?.some((item) => Number(item.application_id) === employerApplicationId)) throw new Error('Candidate application was not visible to the job owner.');

        const statusResponse = await request('/api/employer/applications/' + employerApplicationId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'shortlisted' })
        });
        if (statusResponse.status !== 200) throw new Error('Employer should be able to shortlist its applicant; received ' + statusResponse.status + ': ' + await statusResponse.text());

        const statusBody = await statusResponse.json();
        if (!statusBody.success || statusBody.status !== 'shortlisted' || statusBody.changed !== true) {
            throw new Error('Application status update should confirm a real status change.');
        }
        sessionCookie = candidateCookie;
        const candidateNotificationsAfterShortlist = await request('/api/notifications');
        if (candidateNotificationsAfterShortlist.status !== 200) throw new Error('Candidate should be able to retrieve status-update notifications.');
        const candidateNotificationsAfterShortlistBody = await candidateNotificationsAfterShortlist.json();
        const shortlistNotifications = candidateNotificationsAfterShortlistBody.notifications?.filter((item) =>
            item.type === 'application_status' && String(item.link || '').includes('applicationId=' + employerApplicationId)
        ) || [];
        if (shortlistNotifications.length !== 1 || shortlistNotifications[0].read_at ||
            !String(shortlistNotifications[0].body || '').toLowerCase().includes('shortlisted')) {
            throw new Error('A real application status change should create one unread candidate notification with the updated status.');
        }
        const candidateHistoryAfterShortlist = await request('/api/applications');
        const candidateHistoryAfterShortlistBody = await candidateHistoryAfterShortlist.json();
        const shortlistedApplication = candidateHistoryAfterShortlistBody.applications?.find((item) => Number(item.id) === employerApplicationId);
        if (!shortlistedApplication || shortlistedApplication.status !== 'shortlisted' ||
            !shortlistedApplication.history?.some((entry) => entry.status === 'new') ||
            !shortlistedApplication.history?.some((entry) => entry.status === 'shortlisted')) {
            throw new Error('Candidate application history must reflect employer status changes in order.');
        }
        const initialHistoryIndex = shortlistedApplication.history.findIndex((entry) => entry.status === 'new');
        const shortlistedHistoryIndex = shortlistedApplication.history.findIndex((entry) => entry.status === 'shortlisted');
        if (initialHistoryIndex < 0 || shortlistedHistoryIndex <= initialHistoryIndex) {
            throw new Error('Application history must preserve the order of initial submission and later shortlisting.');
        }
        const historyCountBeforeRepeat = shortlistedApplication.history.length;
        sessionCookie = employerCookie;
        const repeatedStatusResponse = await request('/api/employer/applications/' + employerApplicationId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'shortlisted' })
        });
        if (repeatedStatusResponse.status !== 200) throw new Error('Repeating the same application status should be safe.');
        const repeatedStatusBody = await repeatedStatusResponse.json();
        if (repeatedStatusBody.changed !== false) throw new Error('Repeating an unchanged application status should not create a new status change.');
        sessionCookie = candidateCookie;
        const historyAfterRepeatedStatus = await request('/api/applications');
        const historyAfterRepeatedStatusBody = await historyAfterRepeatedStatus.json();
        const applicationAfterRepeatedStatus = historyAfterRepeatedStatusBody.applications?.find((item) => Number(item.id) === employerApplicationId);
        if (!applicationAfterRepeatedStatus || applicationAfterRepeatedStatus.history?.length !== historyCountBeforeRepeat) {
            throw new Error('Repeating the same application status must not add a duplicate history entry.');
        }
        const notificationsAfterRepeatedStatus = await request('/api/notifications');
        const notificationsAfterRepeatedStatusBody = await notificationsAfterRepeatedStatus.json();
        const shortlistNotificationsAfterRepeat = notificationsAfterRepeatedStatusBody.notifications?.filter((item) =>
            item.type === 'application_status' && String(item.link || '').includes('applicationId=' + employerApplicationId)
        ) || [];
        if (shortlistNotificationsAfterRepeat.length !== 1) {
            throw new Error('Repeating an unchanged application status must not create duplicate notifications.');
        }
        sessionCookie = employerCookie;
        for (const invalidStatus of ['unknown-status', 42, null, {}, '']) {
            const invalidStatusResponse = await request('/api/employer/applications/' + employerApplicationId + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: invalidStatus })
            });
            if (invalidStatusResponse.status !== 400) throw new Error('Invalid application status should return 400.');
        }
        const missingApplicationStatus = await request('/api/employer/applications/' + employerApplicationId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (missingApplicationStatus.status !== 400) throw new Error('Missing application status must be rejected with 400.');
        sessionCookie = candidateCookie;
        const historyAfterInvalidStatuses = await request('/api/applications');
        const historyAfterInvalidStatusesBody = await historyAfterInvalidStatuses.json();
        const applicationAfterInvalidStatuses = historyAfterInvalidStatusesBody.applications?.find((item) => Number(item.id) === employerApplicationId);
        if (!applicationAfterInvalidStatuses || applicationAfterInvalidStatuses.status !== 'shortlisted' ||
            applicationAfterInvalidStatuses.history?.length !== historyCountBeforeRepeat) {
            throw new Error('Rejected application status values must not alter the current status or history.');
        }
        sessionCookie = employerCookie;
        const invalidApplicationId = await request('/api/employer/applications/not-a-number/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'reviewing' })
        });
        if (invalidApplicationId.status !== 400) throw new Error('Invalid application ID should return 400.');
        sessionCookie = candidateCookie;
        const candidateCannotChangeApplicationStatus = await request('/api/employer/applications/' + employerApplicationId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'hired' })
        });
        if (candidateCannotChangeApplicationStatus.status !== 403) throw new Error('Candidates must not change employer application statuses.');
        sessionCookie = employerCookie;

        const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const interviewResponse = await request('/api/interviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applicationId: employerApplicationId,
                scheduledAt,
                durationMinutes: 30,
                interviewType: 'online',
                locationOrLink: 'https://example.com/runtime-interview',
                notes: 'Temporary automated integration test.'
            })
        });
        if (interviewResponse.status !== 201) throw new Error('Employer should be able to schedule an interview for its applicant; received ' + interviewResponse.status + ': ' + await interviewResponse.text());
        const interviewBody = await interviewResponse.json();
        if (!interviewBody.success || !interviewBody.interviewId) throw new Error('Interview scheduling response did not include an interview ID.');

        const interviewCache = interviewResponse.headers.get('cache-control') || '';
        if (!/private/i.test(interviewCache) || !/no-store/i.test(interviewCache)) {
            throw new Error('Interview scheduling responses must not be publicly cached.');
        }
        for (const invalidPayload of [
            { applicationId: employerApplicationId, scheduledAt: 'not-a-date', durationMinutes: 30, interviewType: 'online', locationOrLink: 'https://example.com/interview' },
            { applicationId: employerApplicationId, scheduledAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 17, interviewType: 'online', locationOrLink: 'https://example.com/interview' },
            { applicationId: employerApplicationId, scheduledAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30, interviewType: 'online', locationOrLink: 'javascript:alert(1)' },
            { applicationId: 99999999, scheduledAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30, interviewType: 'online', locationOrLink: 'https://example.com/interview' }
        ]) {
            const invalidInterview = await request('/api/interviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidPayload)
            });
            if (![400, 404].includes(invalidInterview.status)) {
                throw new Error('Invalid interview scheduling input should return 400 or 404; received ' + invalidInterview.status + '.');
            }
        }

        sessionCookie = candidateCookie;
        const candidateCannotScheduleInterview = await request('/api/interviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applicationId: employerApplicationId,
                scheduledAt: new Date(Date.now() + 86400000).toISOString(),
                durationMinutes: 30,
                interviewType: 'online',
                locationOrLink: 'https://example.com/not-authorized'
            })
        });
        if (candidateCannotScheduleInterview.status !== 403) {
            throw new Error('Candidate accounts must not schedule interviews; received ' + candidateCannotScheduleInterview.status + '.');
        }
        const candidateInterviews = await request('/api/interviews');
        if (candidateInterviews.status !== 200) throw new Error('Candidate should be able to view their scheduled interviews; received ' + candidateInterviews.status + ': ' + await candidateInterviews.text());
        const candidateInterviewsBody = await candidateInterviews.json();
        if (!candidateInterviewsBody.interviews?.some((item) => Number(item.id) === Number(interviewBody.interviewId))) {
            throw new Error('Scheduled interview was not visible to the candidate.');
        }

        // A different employer must not see applicants or alter another company's interview.
        sessionCookie = '';
        const secondEmployerEmail = 'runtime-other-employer-' + process.pid + '-' + Date.now() + '@example.com';
        const secondEmployerRegistration = await request('/api/employer/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Runtime Other Employer',
                email: secondEmployerEmail,
                password: 'RuntimeEmployer123!',
                confirmPassword: 'RuntimeEmployer123!',
                companyName: 'Runtime Other Company ' + process.pid
            })
        });
        if (secondEmployerRegistration.status !== 200) throw new Error('Second employer registration should succeed; received ' + secondEmployerRegistration.status + ': ' + await secondEmployerRegistration.text());
        const secondEmployerCookie = (secondEmployerRegistration.headers.get('set-cookie') || '').split(';')[0];
        if (!secondEmployerCookie.includes('=')) throw new Error('Second employer registration did not establish a session cookie.');

        sessionCookie = secondEmployerCookie;

        const foreignCompanyUpdate = await request('/api/employer/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName: employerBody.companyName })
        });
        if (foreignCompanyUpdate.status !== 409) throw new Error('Company profile updates must reject a name already owned by another employer; received ' + foreignCompanyUpdate.status + '.');

        const secondEmployerJobs = await request('/api/employer/jobs');
        if (secondEmployerJobs.status !== 200) throw new Error('Second employer should be able to load its own job list.');
        const secondEmployerJobsBody = await secondEmployerJobs.json();
        if (secondEmployerJobsBody.jobs?.some((item) => Number(item.id) === postedJobId)) {
            throw new Error('Employer job listings must not expose another company’s postings.');
        }

        const secondEmployerAnalytics = await request('/api/employer/analytics');
        if (secondEmployerAnalytics.status !== 200) throw new Error('Second employer should be able to load its analytics.');
        const secondEmployerAnalyticsBody = await secondEmployerAnalytics.json();
        if (secondEmployerAnalyticsBody.jobs?.some((item) => Number(item.id) === postedJobId) || Number(secondEmployerAnalyticsBody.stats?.totalApplicants || 0) !== 0) {
            throw new Error('Employer analytics must not include another company’s jobs or applicants.');
        }

        const invalidJobStatus = await request('/api/employer/jobs/' + postedJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'published-and-secret' })
        });
        if (invalidJobStatus.status !== 400) throw new Error('Job status updates must reject unsupported statuses; received ' + invalidJobStatus.status + '.');

        const foreignJobUpdate = await request('/api/employer/jobs/' + postedJobId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Unauthorized Edit',
                description: 'Should not be allowed',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.'
            })
        });
        if (foreignJobUpdate.status !== 404) throw new Error('An employer must not update another company’s job; received ' + foreignJobUpdate.status + '.');

        const invalidJobIdUpdate = await request('/api/employer/jobs/not-a-number', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Invalid ID Edit',
                description: 'Invalid ID test',
                skills: ['JavaScript'],
                employmentType: 'Full-time',
                location: 'Remote',
                howToApply: 'Apply through JobPath.'
            })
        });
        if (invalidJobIdUpdate.status !== 400) throw new Error('Employer job updates must reject malformed job IDs; received ' + invalidJobIdUpdate.status + '.');

        sessionCookie = employerCookie;
        const ownerCompanyBefore = await request('/api/employer/me');
        const ownerCompanyBeforeBody = await ownerCompanyBefore.json();
        if (ownerCompanyBeforeBody.company?.company_name !== employerBody.companyName) {
            throw new Error('A rejected cross-company profile update changed the owner’s company profile.');
        }
        sessionCookie = secondEmployerCookie;

        const foreignApplicantsResponse = await request('/api/employer/jobs/' + postedJobId + '/applicants');
        if (foreignApplicantsResponse.status !== 404) throw new Error('Another employer must not access applicants for a job it does not own; received ' + foreignApplicantsResponse.status + '.');
        const foreignApplicantDetail = await request('/api/employer/applicants/' + employerApplicationId);
        if (foreignApplicantDetail.status !== 404) throw new Error('Another employer must not access applicant profile details for a foreign application; received ' + foreignApplicantDetail.status + '.');
        const foreignJobStatusUpdate = await request('/api/employer/jobs/' + postedJobId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' })
        });
        if (foreignJobStatusUpdate.status !== 404) throw new Error('Another employer must not change the status of a foreign job; received ' + foreignJobStatusUpdate.status + '.');
        const foreignApplicationStatusUpdate = await request('/api/employer/applications/' + employerApplicationId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'hired' })
        });
        if (foreignApplicationStatusUpdate.status !== 404) throw new Error('Another employer must not change an application for a job it does not own; received ' + foreignApplicationStatusUpdate.status + '.');
        const foreignInterviewUpdate = await request('/api/interviews/' + interviewBody.interviewId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        if (foreignInterviewUpdate.status !== 404) throw new Error('Another employer must not update an interview for a job it does not own; received ' + foreignInterviewUpdate.status + '.');

        sessionCookie = employerCookie;
        const invalidInterviewStatus = await request('/api/interviews/' + interviewBody.interviewId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'hired' })
        });
        if (invalidInterviewStatus.status !== 400) throw new Error('Invalid interview status must return 400; received ' + invalidInterviewStatus.status + '.');

        const invalidInterviewId = await request('/api/interviews/not-a-number', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        if (invalidInterviewId.status !== 400) throw new Error('Invalid interview ID must return 400; received ' + invalidInterviewId.status + '.');
        sessionCookie = candidateCookie;
        const candidateCannotUpdateInterview = await request('/api/interviews/' + interviewBody.interviewId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        if (candidateCannotUpdateInterview.status !== 403) throw new Error('Candidates must not update interview status; received ' + candidateCannotUpdateInterview.status + '.');
        sessionCookie = employerCookie;
        const completeInterview = await request('/api/interviews/' + interviewBody.interviewId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        if (completeInterview.status !== 200) throw new Error('Interview owner should be able to mark an interview completed; received ' + completeInterview.status + '.');
        const completeInterviewBody = await completeInterview.json();
        if (!completeInterviewBody.success || completeInterviewBody.status !== 'completed') throw new Error('Interview completion response did not confirm the new status.');
        const interviewOwnerList = await request('/api/interviews');
        if (interviewOwnerList.status !== 200) throw new Error('Interview owner should still be able to view interviews after denied cross-company access.');
        const ownerCache = interviewOwnerList.headers.get('cache-control') || '';
        if (!/private/i.test(ownerCache) || !/no-store/i.test(ownerCache)) throw new Error('Interview lists must not be publicly cached.');
        const ownerListBody = await interviewOwnerList.json();
        const unchangedInterview = ownerListBody.interviews?.find((item) => Number(item.id) === Number(interviewBody.interviewId));
        if (!unchangedInterview || unchangedInterview.status !== 'completed') throw new Error('Unauthorized requests changed the interview status or owner update did not persist.');

        const cancelInterview = await request('/api/interviews/' + interviewBody.interviewId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        if (cancelInterview.status !== 200 || !(await cancelInterview.json()).changed) {
            throw new Error('Changing an interview to cancelled should report a real status change.');
        }
        const repeatCancelInterview = await request('/api/interviews/' + interviewBody.interviewId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        const repeatCancelInterviewBody = await repeatCancelInterview.json();
        if (repeatCancelInterview.status !== 200 || repeatCancelInterviewBody.changed !== false) {
            throw new Error('Repeating the same interview status should be idempotent.');
        }
        sessionCookie = candidateCookie;
        const cancellationNotificationsResponse = await request('/api/notifications');
        const cancellationNotificationsBody = await cancellationNotificationsResponse.json();
        const cancellationNotifications = cancellationNotificationsBody.notifications?.filter((item) => item.title === 'Interview cancelled') || [];
        if (cancellationNotifications.length !== 1) {
            throw new Error('Repeated interview cancellation must create exactly one cancellation notification.');
        }

        sessionCookie = candidateCookie;
        // Resume builder must persist a valid draft and reject malformed email addresses.
        const draftResponse = await request('/api/resume/builder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: {
                fullName: 'Runtime Test Candidate',
                email: 'candidate@example.com',
                phone: '09170000000',
                location: 'Bacoor',
                summary: 'Automated integration check',
                education: [{ school: 'Test School', degree: 'Test Degree', year: '2025' }],
                experience: [],
                projects: [{ name: 'Test Project', description: 'Integration test project' }],
                certifications: []
            } })
        });
        if (draftResponse.status !== 200) throw new Error('Candidate should be able to save a resume draft; received ' + draftResponse.status + ': ' + await draftResponse.text());
        const savedDraft = await draftResponse.json();
        if (!savedDraft.success || savedDraft.resume?.email !== 'candidate@example.com') throw new Error('Resume builder did not return the saved draft.');

        const loadDraftResponse = await request('/api/resume/builder');
        if (loadDraftResponse.status !== 200) throw new Error('Candidate should be able to reload their resume draft; received ' + loadDraftResponse.status + '.');
        const loadedDraft = await loadDraftResponse.json();
        if (loadedDraft.resume?.fullName !== 'Runtime Test Candidate' || loadedDraft.resume?.education?.[0]?.school !== 'Test School') {
            throw new Error('Resume draft did not persist correctly across requests.');
        }

        const invalidDraftResponse = await request('/api/resume/builder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: { fullName: 'Invalid Email Test', email: 'not-an-email' } })
        });
        if (invalidDraftResponse.status !== 400) throw new Error('Resume builder should reject malformed email addresses with 400; received ' + invalidDraftResponse.status + '.');

        const emptyDraftResponse = await request('/api/resume/builder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: { fullName: 'Email Optional Test', email: '' } })
        });
        if (emptyDraftResponse.status !== 200) throw new Error('Resume builder should allow a blank optional email; received ' + emptyDraftResponse.status + '.');

        const reloadAfterInvalidResponse = await request('/api/resume/builder');
        const reloadAfterInvalid = await reloadAfterInvalidResponse.json();
        if (reloadAfterInvalid.resume?.fullName !== 'Email Optional Test') throw new Error('Resume builder failed to preserve the last valid draft after validation.');

        // Exercise the real PDF parser and skill detector using a generated text PDF.
        const pdfLines = [
            'Runtime Candidate Resume',
            'candidate@example.com',
            'Software Developer',
            'JavaScript Node.js React HTML CSS Git SQL Python',
            'Experienced building web applications and testing APIs with clear documentation.',
            'Education: Integration Test School, Bachelor of Computer Science.',
            'Projects: JobPath candidate hiring application workflow and portfolio.'
        ];
        const pdfForm = new FormData();
        pdfForm.append('resume', new Blob([makeTextPdf(pdfLines)], { type: 'application/pdf' }), 'runtime-resume.pdf');
        const pdfScanResponse = await request('/api/resume/scan', { method: 'POST', body: pdfForm });
        if (pdfScanResponse.status !== 200) throw new Error('A valid text PDF should scan successfully; received ' + pdfScanResponse.status + ': ' + await pdfScanResponse.text());
        const pdfScanBody = await pdfScanResponse.json();
        if (!pdfScanBody.success || !Array.isArray(pdfScanBody.detectedSkills) || pdfScanBody.detectedSkills.length === 0) {
            throw new Error('The real PDF scan did not detect any skills.');
        }
        if (pdfScanBody.extracted?.email !== 'candidate@example.com') throw new Error('The PDF scanner did not extract the expected email address.');
        const resumeStatusResponse = await request('/api/resume/current');
        if (resumeStatusResponse.status !== 200) throw new Error('Candidate resume metadata should be available after scanning.');
        const resumeStatusBody = await resumeStatusResponse.json();
        if (resumeStatusBody.resume?.original_name !== 'runtime-resume.pdf') throw new Error('Scanned PDF metadata was not saved.');
        const resumeFileResponse = await request('/api/resume/file');
        if (resumeFileResponse.status !== 200) throw new Error('Candidate could not retrieve their uploaded PDF.');
        if (!(resumeFileResponse.headers.get('content-type') || '').includes('application/pdf')) throw new Error('Uploaded PDF was returned with an unexpected content type.');
        const returnedPdf = Buffer.from(await resumeFileResponse.arrayBuffer());
        if (returnedPdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('The private resume endpoint did not return the uploaded PDF bytes.');

        // Exercise real DOCX parsing and confirm detected skills reach the candidate profile.
        const docxLines = [
            'DOCX Integration Candidate',
            'docx.candidate@example.com',
            'Frontend Developer',
            'JavaScript React HTML CSS Node.js Git',
            'Built accessible web applications and REST API integrations.',
            'Education: Test University, Bachelor of Information Technology.'
        ];
        const docxForm = new FormData();
        docxForm.append('resume', new Blob([makeTextDocx(docxLines)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'runtime-resume.docx');
        const docxScanResponse = await request('/api/resume/scan', { method: 'POST', body: docxForm });
        if (docxScanResponse.status !== 200) throw new Error('A valid DOCX resume should scan successfully; received ' + docxScanResponse.status + ': ' + await docxScanResponse.text());
        const docxScanBody = await docxScanResponse.json();
        if (!docxScanBody.success || docxScanBody.extracted?.email !== 'docx.candidate@example.com') throw new Error('DOCX text extraction did not return the expected email.');
        if (!Array.isArray(docxScanBody.detectedSkills) || docxScanBody.detectedSkills.length === 0) throw new Error('DOCX scanning did not detect skills.');
        const profileAfterDocx = await request('/api/auth/profile');
        if (profileAfterDocx.status !== 200) throw new Error('Candidate profile could not be loaded after DOCX scan.');
        const profileAfterDocxBody = await profileAfterDocx.json();
        const profileSkills = profileAfterDocxBody.profile?.skills || [];
        if (!profileSkills.some((skill) => skill.source === 'resume')) throw new Error('Resume-detected skills were not persisted to the candidate profile.');

        if (!profileSkills.some((skill) => /javascript/i.test(skill.name))) throw new Error('Expected JavaScript skill was not present in the saved candidate profile.');

        // Manual skill edits must validate payload shape and preserve resume-derived skills.
        const malformedSkillsResponse = await request('/api/auth/profile/skills', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillIds: 'not-an-array', skillNames: ['Manual QA'] })
        });
        if (malformedSkillsResponse.status !== 400) throw new Error('Skill management must reject non-array skillIds; received ' + malformedSkillsResponse.status + '.');

        const customSkillName = 'Runtime Custom Skill ' + process.pid;
        const saveManualSkillsResponse = await request('/api/auth/profile/skills', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillIds: [], skillNames: [customSkillName, '  ' + customSkillName.toLowerCase() + '  ', '   '] })
        });
        if (saveManualSkillsResponse.status !== 200) throw new Error('Candidate should be able to save valid custom skills; received ' + saveManualSkillsResponse.status + ': ' + await saveManualSkillsResponse.text());
        const savedManualSkillsBody = await saveManualSkillsResponse.json();
        const matchingCustomSkills = (savedManualSkillsBody.skills || []).filter((skill) => skill.name.toLowerCase() === customSkillName.toLowerCase());
        if (matchingCustomSkills.length !== 1 || matchingCustomSkills[0].source !== 'manual') throw new Error('Custom skills should be trimmed, deduplicated case-insensitively, and saved as manual skills.');
        if (!(savedManualSkillsBody.skills || []).some((skill) => skill.source === 'resume' && /javascript/i.test(skill.name))) throw new Error('Saving manual skills must preserve resume-derived skills.');

        // Replacing a resume should replace old resume-derived skills but keep manual skills.
        const replacementDocxLines = [
            'Runtime Resume Replacement Candidate',
            'replacement.candidate@example.com',
            'Data Analyst',
            'Python SQL Docker Linux',
            'Data processing, database queries, and containerized application deployment.',
            'Education: Test University, Information Systems.'
        ];
        const replacementDocxForm = new FormData();
        replacementDocxForm.append('resume', new Blob([makeTextDocx(replacementDocxLines)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'runtime-resume-replacement.docx');
        const replacementDocxResponse = await request('/api/resume/scan', { method: 'POST', body: replacementDocxForm });
        if (replacementDocxResponse.status !== 200) throw new Error('A replacement DOCX should scan successfully; received ' + replacementDocxResponse.status + ': ' + await replacementDocxResponse.text());
        const replacementDocxBody = await replacementDocxResponse.json();
        if (!replacementDocxBody.success || !replacementDocxBody.detectedSkills?.some((skill) => /python/i.test(skill))) {
            throw new Error('Replacement resume should detect its new Python skill.');
        }
        if (replacementDocxBody.detectedSkills.some((skill) => /javascript/i.test(skill))) {
            throw new Error('Replacing a resume should not retain JavaScript from the previous resume when it is absent from the new scan.');
        }

        const profileAfterResumeReplacement = await request('/api/auth/profile');
        const profileAfterResumeReplacementBody = await profileAfterResumeReplacement.json();
        const replacementProfileSkills = profileAfterResumeReplacementBody.profile?.skills || [];
        if (!replacementProfileSkills.some((skill) => skill.source === 'resume' && /python/i.test(skill.name))) {
            throw new Error('New resume-derived skills were not synchronized to the candidate profile.');
        }
        if (replacementProfileSkills.some((skill) => skill.source === 'resume' && /javascript/i.test(skill.name))) {
            throw new Error('Old resume-derived JavaScript skill remained after resume replacement.');
        }
        if (!replacementProfileSkills.some((skill) => skill.source === 'manual' && skill.name.toLowerCase() === customSkillName.toLowerCase())) {
            throw new Error('Replacing a resume must preserve manually added candidate skills.');
        }

        sessionCookie = secondCandidateCookie;
        const otherCandidateProfileAfterSkillEdit = await request('/api/auth/profile');
        if (otherCandidateProfileAfterSkillEdit.status !== 200) throw new Error('Second candidate should still be able to load their own profile after another candidate edits skills.');
        const otherCandidateProfileAfterSkillEditBody = await otherCandidateProfileAfterSkillEdit.json();
        if ((otherCandidateProfileAfterSkillEditBody.profile?.skills || []).some((skill) => skill.name.toLowerCase() === customSkillName.toLowerCase())) {
            throw new Error('Manual skills must remain private to the candidate who saved them.');
        }
        sessionCookie = candidateCookie;
        const currentAfterDocx = await request('/api/resume/current');
        const currentAfterDocxBody = await currentAfterDocx.json();
        if (currentAfterDocxBody.resume?.original_name !== 'runtime-resume-replacement.docx') throw new Error('Replacement DOCX metadata was not saved as the latest resume.');
        if (currentAfterDocx.headers.get('cache-control') && !/private/i.test(currentAfterDocx.headers.get('cache-control'))) {
            throw new Error('Resume metadata responses must not be publicly cached.');
        }

        // Resume replacement should make the newest uploaded file the one served to the candidate.
        const latestResumeFile = await request('/api/resume/file');
        if (latestResumeFile.status !== 200) throw new Error('Candidate should be able to retrieve the newest uploaded resume.');
        const latestResumeBytes = Buffer.from(await latestResumeFile.arrayBuffer());
        if (latestResumeBytes.length === 0 || latestResumeBytes.subarray(0, 2).toString('ascii') !== 'PK') {
            throw new Error('Resume file endpoint should serve the latest DOCX archive after a replacement upload.');
        }
        const latestResumeCache = latestResumeFile.headers.get('cache-control') || '';
        if (!/private/i.test(latestResumeCache) || !/no-store/i.test(latestResumeCache)) {
            throw new Error('Resume file responses must not be publicly cached.');
        }

        // Resume access is candidate-only, even when an employer is authenticated.
        sessionCookie = employerCookie;
        const employerResumeFile = await request('/api/resume/file');
        if (employerResumeFile.status !== 403) throw new Error('Employer accounts must not retrieve candidate resume files; received ' + employerResumeFile.status + '.');
        const employerResumeScan = await request('/api/resume/scan', { method: 'POST' });
        if (employerResumeScan.status !== 403) throw new Error('Employer accounts must not use candidate resume scanning; received ' + employerResumeScan.status + '.');
        sessionCookie = candidateCookie;

        // Enforce the server-side 5MB upload limit, not only the browser UI limit.
        const oversizedForm = new FormData();
        oversizedForm.append('resume', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'application/pdf' }), 'oversized-resume.pdf');
        const oversizedResponse = await request('/api/resume/scan', { method: 'POST', body: oversizedForm });
        if (oversizedResponse.status !== 400) throw new Error('Resume uploads larger than 5MB must be rejected; received ' + oversizedResponse.status + '.');
        const oversizedBody = await oversizedResponse.json();
        if (!String(oversizedBody.error || '').includes('5MB')) throw new Error('Oversized resume rejection should explain the 5MB limit.');

        const invalidResumeForm = new FormData();
        invalidResumeForm.append('resume', new Blob(['this is not a real PDF or DOCX file'], { type: 'application/pdf' }), 'fake-resume.pdf');
        const badResumeUpload = await request('/api/resume/scan', {
            method: 'POST',
            body: invalidResumeForm
        });
        if (badResumeUpload.status !== 400) throw new Error('Resume scanner should reject a fake PDF whose content does not match its extension; received ' + badResumeUpload.status + '.');
        const badResumeBody = await badResumeUpload.json();
        if (!String(badResumeBody.error || '').includes('does not match')) throw new Error('Fake PDF rejection should explain the file-content mismatch.');

        // Failed uploads must not replace the last valid resume or its detected skills.
        const resumeAfterRejectedUpload = await request('/api/resume/current');
        const resumeAfterRejectedUploadBody = await resumeAfterRejectedUpload.json();
        if (resumeAfterRejectedUpload.status !== 200 || resumeAfterRejectedUploadBody.resume?.original_name !== 'runtime-resume-replacement.docx') {
            throw new Error('A rejected resume upload must not replace the latest valid resume metadata.');
        }
        const profileAfterRejectedUpload = await request('/api/auth/profile');
        const profileAfterRejectedUploadBody = await profileAfterRejectedUpload.json();
        const skillsAfterRejectedUpload = profileAfterRejectedUploadBody.profile?.skills || [];
        if (!skillsAfterRejectedUpload.some((skill) => skill.source === 'resume' && /python/i.test(skill.name))) {
            throw new Error('A rejected resume upload must preserve the last valid resume-derived skills.');
        }
        if (!skillsAfterRejectedUpload.some((skill) => skill.source === 'manual' && skill.name.toLowerCase() === customSkillName.toLowerCase())) {
            throw new Error('A rejected resume upload must preserve manual candidate skills.');
        }

        console.log('Runtime integration check passed: server health, public pages, access controls, candidate/employer workflows, candidate-isolated application history and saved jobs, search-filter validation, private cache headers, notification read-all and timestamp idempotency, application history ordering and duplicate prevention, employer job posting/applicant management and status validation, draft visibility and publishing, interview scheduling and lifecycle checks, cross-employer authorization, resume draft persistence and validation, PDF/DOCX extraction and replacement skill synchronization, manual skill preservation, authenticated resume retrieval, role-based access, upload size limits, and forged upload rejection.');
    } finally {
        if (child.exitCode === null) {
            child.kill('SIGTERM');
            await Promise.race([
                new Promise((resolve) => child.once('exit', resolve)),
                new Promise((resolve) => setTimeout(resolve, 3000))
            ]);
            if (child.exitCode === null) child.kill('SIGKILL');
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error('JobPath runtime integration check FAILED');
    console.error(error.stack || error);
    process.exitCode = 1;
});
