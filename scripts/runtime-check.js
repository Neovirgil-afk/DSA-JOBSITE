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
        '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\\nstream\\n' + stream + '\\nendstream'
    ];
    let pdf = '%PDF-1.4\\n';
    const offsets = [0];
    for (let index = 0; index < objects.length; index++) {
        offsets.push(Buffer.byteLength(pdf, 'ascii'));
        pdf += (index + 1) + ' 0 obj\\n' + objects[index] + '\\nendobj\\n';
    }
    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += 'xref\\n0 ' + (objects.length + 1) + '\\n0000000000 65535 f \\n';
    for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, '0') + ' 00000 n \\n';
    pdf += 'trailer\\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\\nstartxref\\n' + xrefOffset + '\\n%%EOF';
    return Buffer.from(pdf, 'ascii');
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

        const invalidResumeForm = new FormData();
        invalidResumeForm.append('resume', new Blob(['this is not a real PDF or DOCX file'], { type: 'application/pdf' }), 'fake-resume.pdf');
        const badResumeUpload = await request('/api/resume/scan', {
            method: 'POST',
            body: invalidResumeForm
        });
        if (badResumeUpload.status !== 400) throw new Error('Resume scanner should reject a fake PDF whose content does not match its extension; received ' + badResumeUpload.status + '.');
        const badResumeBody = await badResumeUpload.json();
        if (!String(badResumeBody.error || '').includes('does not match')) throw new Error('Fake PDF rejection should explain the file-content mismatch.');

        console.log('Runtime integration check passed: server health, 6 public pages, access controls, candidate/employer account workflows, applications and duplicate prevention, employer job posting/applicant management, interview scheduling, resume draft persistence and validation, real PDF text extraction and skill detection, authenticated resume file retrieval, and forged upload rejection.');
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
