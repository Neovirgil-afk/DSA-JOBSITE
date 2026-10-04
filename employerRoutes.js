const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const { computeSkillGap } = require('./SkillGapService');
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
    if (Array.isArray(value)) {
        return [...new Set(value.map(clean).filter(Boolean))];
    }

    return [...new Set(
        clean(value)
            .split(/[,\\n]/)
            .map((skill) => skill.trim())
            .filter(Boolean)
    )];
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
    const getSkill = db.prepare('SELECT id FROM skills WHERE name = ?');

    return skillNames.map((name) => {
        insertSkill.run(name, 'Job Requirement');
        return getSkill.get(name);
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

        if (db.prepare('SELECT id FROM company_profiles WHERE company_name = ?').get(cleanCompany)) {
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
                "SELECT COUNT(*) AS count FROM jobs WHERE employer_id = ? AND status = 'active'"
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
            'SELECT a.id, a.status, a.applied_at, u.full_name AS applicant_name, j.title AS job_title FROM applications a JOIN users u ON u.id = a.user_id JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? ORDER BY a.applied_at DESC LIMIT 8'
        ).all(employerId);

        res.json({ success: true, stats, recentApplications });
    } catch (err) {
        console.error('[GET /api/employer/dashboard] error:', err);
        res.status(500).json({ error: 'Failed to load employer dashboard.' });
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

        res.status(201).json({ success: true, job: getJobWithSkills(jobId) });
    } catch (err) {
        console.error('[POST /api/employer/jobs] error:', err);
        res.status(500).json({ error: 'Failed to create job posting.' });
    }
});

router.put('/jobs/:id', requireEmployer, (req, res) => {
    try {
        const jobId = Number(req.params.id);
        const existing = getEmployerJob(jobId, req.employer.id);

        if (!existing) {
            return res.status(404).json({ error: 'Job posting not found.' });
        }

        const payload = parseJobPayload(req.body);

        if (!payload.title || !payload.description || !payload.skills.length ||
            !payload.employmentType || !payload.location || !payload.howToApply) {
            return res.status(400).json({
                error: 'Job title, description, skills, employment type, location, and how to apply are required.'
            });
        }

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

    const result = db.prepare(
        'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND employer_id = ?'
    ).run(status, Number(req.params.id), req.employer.id);

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
            const userSkills = db.prepare(
                'SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = ?'
            ).all(applicant.user_id).map((row) => row.name);

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
            'SELECT a.*, j.title AS job_title, j.company, u.id AS user_id, u.full_name, u.email, u.education, u.degree, u.target_job, u.location, ur.original_name AS resume_name, ur.stored_name AS resume_stored_name FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.user_id LEFT JOIN user_resumes ur ON ur.id = a.resume_id WHERE a.id = ? AND j.employer_id = ?'
        ).get(Number(req.params.id), req.employer.id);

        if (!application) {
            return res.status(404).json({ error: 'Applicant not found.' });
        }

        const requiredSkills = db.prepare(
            'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ?'
        ).all(application.job_id).map((row) => row.name);

        const userSkills = db.prepare(
            'SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = ?'
        ).all(application.user_id).map((row) => row.name);

        const gap = computeSkillGap(requiredSkills, userSkills);
        const matchScore = requiredSkills.length
            ? Math.round((gap.have.length / requiredSkills.length) * 100)
            : 0;

        res.json({
            success: true,
            applicant: {
                ...application,
                skills: userSkills,
                requiredSkills,
                matchingSkills: gap.have,
                missingSkills: gap.missing,
                matchScore
            }
        });
    } catch (err) {
        console.error('[GET /api/employer/applicants/:id] error:', err);
        res.status(500).json({ error: 'Failed to load applicant.' });
    }
});

router.get('/applicants/:id/resume', requireEmployer, (req, res) => {
    try {
        const application = db.prepare(
            'SELECT ur.original_name, ur.stored_name FROM applications a JOIN jobs j ON j.id = a.job_id LEFT JOIN user_resumes ur ON ur.id = a.resume_id WHERE a.id = ? AND j.employer_id = ?'
        ).get(Number(req.params.id), req.employer.id);

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
    const current = db.prepare(
        'SELECT a.status FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.employer_id = ?'
    ).get(applicationId, req.employer.id);

    if (!current) {
        return res.status(404).json({ error: 'Application not found.' });
    }

    if (current.status === status) {
        return res.json({ success: true, status, changed: false });
    }

    db.transaction(() => {
        db.prepare(
            'UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(status, applicationId);

        db.prepare(
            'INSERT INTO application_history (application_id, status) VALUES (?, ?)'
        ).run(applicationId, status);
    })();

    res.json({ success: true, status, changed: true });
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
            'SELECT id FROM company_profiles WHERE company_name = ? AND id != ?'
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
