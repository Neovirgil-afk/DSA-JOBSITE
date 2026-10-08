const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const { computeSkillGap } = require('./SkillGapService');
const { getUserSkillNames } = require('./JobMatchingService');
const MaxHeap = require('./MaxHeap');

const router = express.Router();

function requireEmployer(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'You must be logged in.' });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.session.userId);

    if (!user || user.role !== 'employer') {
        return res.status(403).json({ error: 'Employer access is required.' });
    }

    req.employer = user;
    next();
}

function clean(value) {
    return String(value ?? '').trim();
}

function splitSkills(value) {
    const values = Array.isArray(value)
        ? value
        : clean(value).split(/[,\n]/);

    const seen = new Set();
    const skills = [];

    for (const value of values) {
        const skill = clean(value);
        const key = skill.toLowerCase();

        if (!skill || seen.has(key)) continue;

        seen.add(key);
        skills.push(skill);
    }

    return skills;
}

function isValidDateOnly(value) {
    if (!value) return true;

    const match = /^\\d{4}-\\d{2}-\\d{2}$/.exec(String(value));
    if (!match) return false;

    const date = new Date(String(value) + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === String(value);
}

function isPastDeadline(value) {
    if (!value) return false;
    return new Date(String(value) + 'T23:59:59') < new Date();
}

function parseJobPayload(body) {
    return {
        title: clean(body.title),
        company: clean(body.company),
        description: clean(body.description),
        responsibilities: clean(body.responsibilities),
        qualifications: clean(body.qualifications),
        skills: splitSkills(body.skills),
        employmentType: clean(body.employmentType),
        salary: clean(body.salary),
        location: clean(body.location),
        workSchedule: clean(body.workSchedule),
        benefits: clean(body.benefits),
        applicationRequirements: clean(body.applicationRequirements),
        applicationDeadline: clean(body.applicationDeadline) || null,
        howToApply: clean(body.howToApply),
        contactInformation: clean(body.contactInformation),
        category: clean(body.category) || 'Other',
        status: ['draft', 'active', 'closed'].includes(body.status) ? body.status : 'active'
    };
}

function ensureSkills(skillNames) {
    const insertSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)');
    const findSkill = db.prepare('SELECT id, name FROM skills WHERE name = ? COLLATE NOCASE LIMIT 1');

    return skillNames.map((name) => {
        const existing = findSkill.get(name);

        if (existing) {
            return existing;
        }

        insertSkill.run(name, 'Job Requirement');
        return findSkill.get(name);
    }).filter(Boolean);
}

function syncJobSkills(jobId, skillNames) {
    const skillRows = ensureSkills(skillNames);
    db.prepare('DELETE FROM job_skills WHERE job_id = ?').run(jobId);

    const insert = db.prepare(
        'INSERT OR IGNORE INTO job_skills (job_id, skill_id, required) VALUES (?, ?, 1)'
    );

    for (const skill of skillRows) {
        insert.run(jobId, skill.id);
    }
}

function getEmployerJob(jobId, employerId) {
    return db.prepare(
        'SELECT * FROM jobs WHERE id = ? AND employer_id = ?'
    ).get(jobId, employerId);
}

function getJobWithSkills(jobId) {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return null;

    const skills = db.prepare(
        'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ? ORDER BY s.name'
    ).all(jobId).map((row) => row.name);

    return { ...job, skills };
}

/* =========================================================
   EMPLOYER ACCOUNT
   ========================================================= */

router.post('/register', (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            confirmPassword,
            companyName,
            companyDescription,
            companyEmail,
            companyPhone,
            companyWebsite
        } = req.body;

        if (!clean(fullName) || !clean(email) || !password || !clean(companyName)) {
            return res.status(400).json({
                error: 'Full name, email, password, and company name are required.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        const cleanEmail = clean(email).toLowerCase();
        const cleanCompany = clean(companyName);

        if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }

        if (db.prepare('SELECT id FROM company_profiles WHERE company_name = ? COLLATE NOCASE').get(cleanCompany)) {
            return res.status(409).json({ error: 'That company name is already registered.' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        const createEmployer = db.transaction(() => {
            const userInfo = db.prepare(
                "INSERT INTO users (full_name, email, password_hash, education, degree, target_job, location, role) VALUES (?, ?, ?, '', '', '', '', 'employer')"
            ).run(clean(fullName), cleanEmail, passwordHash);

            db.prepare(
                'INSERT INTO company_profiles (company_name, description, email, phone, website, user_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(
                cleanCompany,
                clean(companyDescription),
                clean(companyEmail) || cleanEmail,
                clean(companyPhone),
                clean(companyWebsite),
                userInfo.lastInsertRowid
            );

            return Number(userInfo.lastInsertRowid);
        });

        const userId = createEmployer();
        req.session.userId = userId;

        res.json({
            success: true,
            userId,
            fullName: clean(fullName),
            role: 'employer',
            companyName: cleanCompany
        });
    } catch (err) {
        console.error('[POST /api/employer/register] error:', err);
        res.status(500).json({ error: 'Failed to create employer account.' });
    }
});

router.post('/login', (req, res) => {
    try {
        const email = clean(req.body.email).toLowerCase();
        const password = req.body.password || '';

        const user = db.prepare(
            'SELECT id, full_name, email, password_hash, role FROM users WHERE email = ?'
        ).get(email);

        if (!user || user.role !== 'employer' || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({
                error: 'Employer account not found or credentials are invalid.'
            });
        }

        req.session.userId = user.id;

        const company = db.prepare(
            'SELECT company_name FROM company_profiles WHERE user_id = ?'
        ).get(user.id);

        res.json({
            success: true,
            userId: user.id,
            fullName: user.full_name,
            role: 'employer',
            companyName: company?.company_name || ''
        });
    } catch (err) {
        console.error('[POST /api/employer/login] error:', err);
        res.status(500).json({ error: 'Employer login failed.' });
    }
});

router.get('/me', requireEmployer, (req, res) => {
    const user = db.prepare(
        'SELECT id, full_name, email, role FROM users WHERE id = ?'
    ).get(req.employer.id);

    const company = db.prepare(
        'SELECT * FROM company_profiles WHERE user_id = ?'
    ).get(req.employer.id);

    res.json({ success: true, user, company });
});

/* =========================================================
   DASHBOARD / JOBS
   ========================================================= */

router.get('/dashboard', requireEmployer, (req, res) => {
    try {
        const employerId = req.employer.id;

        const stats = {
            activeJobs: db.prepare(
                "SELECT COUNT(*) AS count FROM jobs WHERE employer_id = ? AND status = 'active' AND (application_deadline IS NULL OR (date(application_deadline) = application_deadline AND date(application_deadline) >= date('now')))"
            ).get(employerId).count,

            totalApplicants: db.prepare(
                'SELECT COUNT(*) AS count FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ?'
            ).get(employerId).count,

            newApplicants: db.prepare(
                "SELECT COUNT(*) AS count FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.status = 'new'"
            ).get(employerId).count,

            expiringSoon: db.prepare(
                "SELECT COUNT(*) AS count FROM jobs WHERE employer_id = ? AND status = 'active' AND application_deadline IS NOT NULL AND date(application_deadline) BETWEEN date('now') AND date('now', '+7 day')"
            ).get(employerId).count
        };

        const recentApplications = db.prepare(
            'SELECT a.id, a.status, a.applied_at, a.job_id, u.full_name AS applicant_name, j.title AS job_title FROM applications a JOIN users u ON u.id = a.user_id JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? ORDER BY a.applied_at DESC LIMIT 8'
        ).all(employerId);

        res.json({ success: true, stats, recentApplications });
    } catch (err) {
        console.error('[GET /api/employer/dashboard] error:', err);
        res.status(500).json({ error: 'Failed to load employer dashboard.' });
    }
});

router.get('/analytics', requireEmployer, (req, res) => {
    try {
        const employerId = req.employer.id;

        const applications = db.prepare(
            'SELECT a.id, a.status, a.job_id, a.user_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ?'
        ).all(employerId);

        const statusCounts = {
            new: 0,
            reviewing: 0,
            shortlisted: 0,
            interview: 0,
            hired: 0,
            rejected: 0
        };

        const userCache = new Map();
        const jobSkillCache = new Map();
        let matchTotal = 0;

        const getCachedUserSkills = (userId) => {
            if (!userCache.has(userId)) {
                userCache.set(userId, getUserSkillNames(userId));
            }

            return userCache.get(userId);
        };

        const getCachedRequiredSkills = (jobId) => {
            if (!jobSkillCache.has(jobId)) {
                jobSkillCache.set(
                    jobId,
                    db.prepare(
                        'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ?'
                    ).all(jobId).map((row) => row.name)
                );
            }

            return jobSkillCache.get(jobId);
        };

        for (const application of applications) {
            const bucket = jobAverages.get(Number(application.job_id));
            if (!bucket) continue;

            const requiredSkills = getCachedRequiredSkills(application.job_id);
            const userSkills = getCachedUserSkills(application.user_id);
            const gap = computeSkillGap(requiredSkills, userSkills);
            const score = requiredSkills.length
                ? Math.round((gap.have.length / requiredSkills.length) * 100)
                : 0;

            bucket.total += score;
            bucket.count += 1;
        }
        const statusLabels = { active: 'Active', draft: 'Draft', closed: 'Closed' };
        const jobResults = jobs.map((job) => {
            const bucket = jobAverages.get(Number(job.id));
            return {
                id: job.id,
                title: job.title,
                statusLabel: statusLabels[job.status] || job.status,
                applicants: Number(job.applicants || 0),
                averageMatch: bucket?.count ? Math.round(bucket.total / bucket.count) : 0
            };
        });

        res.json({
            success: true,
            stats: {
                totalApplicants: applications.length,
                shortlisted: statusCounts.shortlisted,
                interview: statusCounts.interview,
                hired: statusCounts.hired,
                averageMatch: applications.length ? Math.round(matchTotal / applications.length) : 0
            },
            statusCounts,
            jobs: jobResults
        });
    } catch (err) {
        console.error('[GET /api/employer/analytics] error:', err);
        res.status(500).json({ error: 'Failed to load employer analytics.' });
    }
});

router.get('/jobs', requireEmployer, (req, res) => {
    try {
        const jobs = db.prepare(
            "SELECT j.*, COUNT(a.id) AS applicant_count FROM jobs j LEFT JOIN applications a ON a.job_id = j.id WHERE j.employer_id = ? GROUP BY j.id ORDER BY CASE j.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 WHEN 'closed' THEN 3 ELSE 4 END, j.created_at DESC, j.id DESC"
        ).all(req.employer.id);

        const withSkills = jobs.map((job) => ({
            ...job,
            skills: db.prepare(
                'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ? ORDER BY s.name'
            ).all(job.id).map((row) => row.name)
        }));

        res.json({ success: true, jobs: withSkills });
    } catch (err) {
        console.error('[GET /api/employer/jobs] error:', err);
        res.status(500).json({ error: 'Failed to load employer jobs.' });
    }
});

router.post('/jobs', requireEmployer, (req, res) => {
    try {
        const payload = parseJobPayload(req.body);

        if (payload.applicationDeadline && !isValidDateOnly(payload.applicationDeadline)) {
            return res.status(400).json({
                error: 'Application deadline must be a valid date in YYYY-MM-DD format.'
            });
        }

        if (payload.status === 'active' && isPastDeadline(payload.applicationDeadline)) {
            return res.status(400).json({
                error: 'An active job cannot have an application deadline in the past.'
            });
        }

        if (!payload.title || !payload.description || !payload.skills.length ||
            !payload.employmentType || !payload.location || !payload.howToApply) {
            return res.status(400).json({
                error: 'Job title, description, skills, employment type, location, and how to apply are required.'
            });
        }

        const company = db.prepare(
            'SELECT company_name FROM company_profiles WHERE user_id = ?'
        ).get(req.employer.id);

        if (!company) {
            return res.status(400).json({
                error: 'Complete your company profile before posting a job.'
            });
        }

        const createJob = db.transaction(() => {
            const info = db.prepare(
                'INSERT INTO jobs (title, description, company, location, category, salary, employment_type, responsibilities, qualifications, work_schedule, benefits, application_requirements, application_deadline, how_to_apply, contact_information, status, employer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
            ).run(
                payload.title,
                payload.description,
                company.company_name,
                payload.location,
                payload.category,
                payload.salary,
                payload.employmentType,
                payload.responsibilities,
                payload.qualifications,
                payload.workSchedule,
                payload.benefits,
                payload.applicationRequirements,
                payload.applicationDeadline,
                payload.howToApply,
                payload.contactInformation,
                payload.status,
                req.employer.id
            );

            const jobId = Number(info.lastInsertRowid);
            syncJobSkills(jobId, payload.skills);
            return jobId;
        });

        const jobId = createJob();

        res.status(201).json({ success: true, job: getJobWithSkills(jobId) });
    } catch (err) {
        console.error('[POST /api/employer/jobs] error:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

router.put('/jobs/:id', requireEmployer, (req, res) => {
    try {
        const jobId = Number(req.params.id);

        if (!Number.isInteger(jobId) || jobId <= 0) {
            return res.status(400).json({ error: 'Invalid job id.' });
        }

        const existing = getEmployerJob(jobId, req.employer.id);

        if (!existing) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }

        const payload = parseJobPayload(req.body);

        if (payload.applicationDeadline && !isValidDateOnly(payload.applicationDeadline)) {
            return res.status(400).json({
                error: 'Application deadline must be a valid date in YYYY-MM-DD format.'
            });
        }

        if (payload.status === 'active' && isPastDeadline(payload.applicationDeadline)) {
            return res.status(400).json({
                error: 'An active job cannot have an application deadline in the past.'
            });
        }

        if (!payload.title || !payload.description || !payload.skills.length ||
            !payload.employmentType || !payload.location || !payload.howToApply) {
            return res.status(400).json({
                error: 'Job title, description, skills, employment type, location, and how to apply are required.'
            });
        }

        db.transaction(() => {
            db.prepare(
                'UPDATE jobs SET title = ?, description = ?, location = ?, category = ?, salary = ?, employment_type = ?, responsibilities = ?, qualifications = ?, work_schedule = ?, benefits = ?, application_requirements = ?, application_deadline = ?, how_to_apply = ?, contact_information = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND employer_id = ?'
            ).run(
                payload.title,
                payload.description,
                payload.location,
                payload.category,
                payload.salary,
                payload.employmentType,
                payload.responsibilities,
                payload.qualifications,
                payload.workSchedule,
                payload.benefits,
                payload.applicationRequirements,
                payload.applicationDeadline,
                payload.howToApply,
                payload.contactInformation,
                payload.status,
                jobId,
                req.employer.id
            );

            syncJobSkills(jobId, payload.skills);
        })();

        res.json({ success: true, job: getJobWithSkills(jobId) });
    } catch (err) {
        console.error('[PUT /api/employer/jobs/:id] error:', err);
        res.status(500).json({ error: 'Failed to update job posting.' });
    }
});

router.patch('/jobs/:id/status', requireEmployer, (req, res) => {
    const status = clean(req.body.status);

    if (!['active', 'draft', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid job status.' });
    }

    const jobId = Number(req.params.id);

    if (!Number.isInteger(jobId) || jobId <= 0) {
        return res.status(400).json({ error: 'Invalid job id.' });
    }

    const existing = db.prepare(
        'SELECT application_deadline FROM jobs WHERE id = ? AND employer_id = ?'
    ).get(jobId, req.employer.id);

    if (!existing) {
        return res.status(404).json({ error: 'Job posting not found.' });
    }

    if (status === 'active' && existing.application_deadline) {
        const deadline = String(existing.application_deadline);
        const validDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(deadline) &&
            !Number.isNaN(new Date(deadline + 'T00:00:00Z').getTime());

        if (!validDate) {
            return res.status(400).json({
                error: 'An active job must have a valid application deadline.'
            });
        }

        if (new Date(deadline + 'T23:59:59') < new Date()) {
            return res.status(400).json({
                error: 'An active job cannot have an application deadline in the past.'
            });
        }
    }

    const result = db.prepare(
        'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND employer_id = ?'
    ).run(status, jobId, req.employer.id);

    if (!result.changes) {
        return res.status(404).json({ error: 'Job posting not found.' });
    }

    res.json({ success: true, status });
});

/* =========================================================
   APPLICANTS
   ========================================================= */

router.get('/jobs/:id/applicants', requireEmployer, (req, res) => {
    try {
        const jobId = Number(req.params.id);
        const job = getEmployerJob(jobId, req.employer.id);

        if (!job) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }

        const requiredSkills = db.prepare(
            'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ?'
        ).all(jobId).map((row) => row.name);

        const applicants = db.prepare(
            'SELECT a.id AS application_id, a.status, a.applied_at, a.updated_at, u.id AS user_id, u.full_name, u.email, u.education, u.degree, u.target_job, u.location, ur.id AS resume_id, ur.original_name AS resume_name FROM applications a JOIN users u ON u.id = a.user_id LEFT JOIN user_resumes ur ON ur.id = a.resume_id WHERE a.job_id = ? ORDER BY a.applied_at DESC'
        ).all(jobId);

        const heap = new MaxHeap();

        for (const applicant of applicants) {
            const userSkills = getUserSkillNames(applicant.user_id);

            const gap = computeSkillGap(requiredSkills, userSkills);
            const matchScore = requiredSkills.length
                ? Math.round((gap.have.length / requiredSkills.length) * 100)
                : 0;

            heap.insert(matchScore, {
                ...applicant,
                matchScore,
                matchingSkills: gap.have,
                missingSkills: gap.missing
            });
        }

        const rankedApplicants = heap.toSortedArray().map((applicant, index) => ({
            ...applicant,
            rank: index + 1
        }));

        res.json({
            success: true,
            job: { id: job.id, title: job.title, requiredSkills },
            applicants: rankedApplicants
        });
    } catch (err) {
        console.error('[GET /api/employer/jobs/:id/applicants] error:', err);
        res.status(500).json({ error: 'Failed to load applicants.' });
    }
});

router.get('/applicants/:id', requireEmployer, (req, res) => {
    try {
        const application = db.prepare(
            (() => {
            const applicationId = Number(req.params.id);

            if (!Number.isInteger(applicationId) || applicationId <= 0) {
                return null;
            }

            return db.prepare(
                'SELECT a.*, j.title AS job_title, j.company, u.id AS user_id, u.full_name, u.email, u.education, u.degree, u.target_job, u.location, ur.original_name AS resume_name, ur.stored_name AS resume_stored_name FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.user_id LEFT JOIN user_resumes ur ON ur.id = a.resume_id WHERE a.id = ? AND j.employer_id = ?'
            ).get(applicationId, req.employer.id);
        })();

        if (!application) {
            return res.status(404).json({ error: 'Applicant not found.' });
        }

        const requiredSkills = db.prepare(
            'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ?'
        ).all(application.job_id).map((row) => row.name);

        const userSkills = getUserSkillNames(application.user_id);

        const gap = computeSkillGap(requiredSkills, userSkills);
        const matchScore = requiredSkills.length
            ? Math.round((gap.have.length / requiredSkills.length) * 100)
            : 0;

        const history = db.prepare(
            'SELECT status, changed_at FROM application_history WHERE application_id = ? ORDER BY changed_at ASC, id ASC'
        ).all(application.id);

        res.json({
            success: true,
            applicant: {
                ...application,
                skills: userSkills,
                requiredSkills,
                matchingSkills: gap.have,
                missingSkills: gap.missing,
                matchScore,
                history
            }
        });
    } catch (err) {
        console.error('[GET /api/employer/applicants/:id] error:', err);
        res.status(500).json({ error: 'Failed to load applicant.' });
    }
});

router.get('/applicants/:id/resume', requireEmployer, (req, res) => {
    try {
        const applicationId = Number(req.params.id);

        if (!Number.isInteger(applicationId) || applicationId <= 0) {
            return res.status(400).json({ error: 'Invalid application id.' });
        }

        const application = db.prepare(
            'SELECT ur.original_name, ur.stored_name FROM applications a JOIN jobs j ON j.id = a.job_id LEFT JOIN user_resumes ur ON ur.id = a.resume_id WHERE a.id = ? AND j.employer_id = ?'
        ).get(applicationId, req.employer.id);

        if (!application || !application.stored_name) {
            return res.status(404).json({ error: 'No resume is attached to this application.' });
        }

        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, 'uploads');
        const filePath = path.join(uploadDir, path.basename(application.stored_name));

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'The uploaded resume file could not be found.' });
        }

        const extension = path.extname(application.original_name || filePath).toLowerCase();
        const disposition = extension === '.pdf' ? 'inline' : 'attachment';

        res.setHeader(
            'Content-Disposition',
            disposition + '; filename="' +
                String(application.original_name || 'resume')
                    .replace(/["\\\r\n]/g, '_') +
                '"'
        );

        res.sendFile(filePath);
    } catch (err) {
        console.error('[GET /api/employer/applicants/:id/resume] error:', err);
        res.status(500).json({ error: 'Failed to open the applicant resume.' });
    }
});

router.patch('/applications/:id/status', requireEmployer, (req, res) => {
    const status = clean(req.body.status);
    const allowed = ['new', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected'];

    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid application status.' });
    }

    const applicationId = Number(req.params.id);

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ error: 'Invalid application id.' });
    }

    const updateApplication = db.transaction(() => {
        const current = db.prepare(
            'SELECT a.status FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.employer_id = ?'
        ).get(applicationId, req.employer.id);

        if (!current) {
            return { found: false, changed: false };
        }

        if (current.status === status) {
            return { found: true, changed: false };
        }

        const result = db.prepare(
            'UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(status, applicationId);

        if (!result.changes) {
            return { found: true, changed: false };
        }

        db.prepare(
            'INSERT INTO application_history (application_id, status) VALUES (?, ?)'
        ).run(applicationId, status);

        return { found: true, changed: true };
    });

    const result = updateApplication();

    if (!result.found) {
        return res.status(404).json({ error: 'Application not found.' });
    }

    res.json({ success: true, status, changed: result.changed });
});

/* =========================================================
   COMPANY PROFILE
   ========================================================= */

router.put('/company', requireEmployer, (req, res) => {
    try {
        const current = db.prepare(
            'SELECT * FROM company_profiles WHERE user_id = ?'
        ).get(req.employer.id);

        if (!current) {
            return res.status(404).json({ error: 'Company profile not found.' });
        }

        const companyName = clean(req.body.companyName) || current.company_name;

        const duplicate = db.prepare(
            'SELECT id FROM company_profiles WHERE company_name = ? COLLATE NOCASE AND id != ?'
        ).get(companyName, current.id);

        if (duplicate) {
            return res.status(409).json({ error: 'That company name is already in use.' });
        }

        db.prepare(
            'UPDATE company_profiles SET company_name = ?, description = ?, email = ?, phone = ?, website = ?, industry = ?, company_size = ?, location = ?, founded_year = ?, benefits = ? WHERE user_id = ?'
        ).run(
            companyName,
            clean(req.body.description),
            clean(req.body.email),
            clean(req.body.phone),
            clean(req.body.website),
            clean(req.body.industry),
            clean(req.body.companySize),
            clean(req.body.location),
            clean(req.body.foundedYear),
            clean(req.body.benefits),
            req.employer.id
        );

        db.prepare(
            'UPDATE jobs SET company = ?, updated_at = CURRENT_TIMESTAMP WHERE employer_id = ?'
        ).run(companyName, req.employer.id);

        const company = db.prepare(
            'SELECT * FROM company_profiles WHERE user_id = ?'
        ).get(req.employer.id);

        res.json({ success: true, company });
    } catch (err) {
        console.error('[PUT /api/employer/company] error:', err);
        res.status(500).json({ error: 'Failed to update company profile.' });
    }
});

module.exports = router;
