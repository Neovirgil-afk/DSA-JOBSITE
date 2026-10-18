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

        // Exercise the employer side and verify candidate/employer data is linked correctly.
        const candidateCookie = sessionCookie;
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
        const employerMe = await request('/api/employer/me');
        if (employerMe.status !== 200) throw new Error('Employer session should be authorized; received ' + employerMe.status + '.');

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

        sessionCookie = candidateCookie;
        const applyToEmployerJob = await request('/api/jobs/' + postedJobId + '/apply', { method: 'POST' });
        if (applyToEmployerJob.status !== 201) throw new Error('Candidate should be able to apply to the employer-created job; received ' + applyToEmployerJob.status + ': ' + await applyToEmployerJob.text());
        const employerJobApplication = await applyToEmployerJob.json();
        const employerApplicationId = Number(employerJobApplication.applicationId);
        if (!Number.isInteger(employerApplicationId) || employerApplicationId <= 0) throw new Error('Application to employer-created job did not return a valid application ID.');

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

        sessionCookie = candidateCookie;
        const candidateInterviews = await request('/api/interviews');
        if (candidateInterviews.status !== 200) throw new Error('Candidate should be able to view their scheduled interviews; received ' + candidateInterviews.status + ': ' + await candidateInterviews.text());
        const candidateInterviewsBody = await candidateInterviews.json();
        if (!candidateInterviewsBody.interviews?.some((item) => Number(item.id) === Number(interviewBody.interviewId))) {
            throw new Error('Scheduled interview was not visible to the candidate.');
        }

        console.log('Runtime integration check passed: server health, 6 public pages, private-file and API access controls, candidate registration/session, job search/application/history, duplicate prevention, employer registration/session, job posting/listing, applicant visibility/status updates, and interview scheduling/visibility.');
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
