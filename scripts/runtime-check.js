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

        const jobsResponse = await request('/api/jobs');
        if (jobsResponse.status !== 200) throw new Error('Public job search should respond successfully; received ' + jobsResponse.status + '.');
        const jobsBody = await jobsResponse.json();
        if (!Array.isArray(jobsBody.jobs) || jobsBody.jobs.length === 0) throw new Error('Fresh database should provide at least one job for the application workflow test.');
        const job = jobsBody.jobs.find((item) => Number.isInteger(Number(item.id)) && Number(item.id) > 0);
        if (!job) throw new Error('Job search returned no job with a valid ID.');

        const apply = await request('/api/jobs/' + job.id + '/apply', { method: 'POST' });
        if (apply.status !== 201) throw new Error('Candidate should be able to apply to an available job; received ' + apply.status + ': ' + await apply.text());
        const applyBody = await apply.json();
        if (!applyBody.success || !applyBody.applicationId) throw new Error('Application response did not include an application ID.');

        const applications = await request('/api/applications');
        if (applications.status !== 200) throw new Error('Candidate should be able to view their applications; received ' + applications.status + '.');
        const applicationsBody = await applications.json();
        if (!Array.isArray(applicationsBody.applications) || !applicationsBody.applications.some((item) => Number(item.id) === Number(applyBody.applicationId))) {
            throw new Error('Submitted application was not returned in the candidate application list.');
        }

        const duplicateApply = await request('/api/jobs/' + job.id + '/apply', { method: 'POST' });
        if (duplicateApply.status !== 409) throw new Error('Duplicate applications should be rejected with 409; received ' + duplicateApply.status + '.');

        console.log('Runtime integration check passed: server health, 6 public pages, 4 private paths, API access control, candidate registration/session, job search, application submission/listing, and duplicate-application prevention.');
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
