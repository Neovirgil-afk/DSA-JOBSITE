
const express = require('express');
const { db } = require('./database');
const { requireAuth } = require('./auth');
const {
    searchJobs,
    getAllJobsWithSkills,
    getRankedJobsForUser,
    getUserSkillNames,
} = require('./JobMatchingService');
const { getCareerPathForJob, getCategoryTree } = require('./CareerPathService')
const { computeSkillGap } = require('./SkillGapService')
const { createNotification } = require('./notificationService')

const router = express.Router();

// Job responses may include user-specific match scores and skill-gap data.
router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('Pragma', 'no-cache');
    next();
});

function requireCandidate(req, res, next) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);

    if (!user || user.role !== 'candidate') {
        return res.status(403).json({
            error: 'Only candidate accounts can use candidate job features.'
        });
    }

    next();
}

function isValidDateOnly(value) {
    if (!value) return true;

    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

    const date = new Date(text + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function isPastDeadline(value) {
    if (!value) return false;
    // Application deadlines are date-only values in the JobSite Philippines timezone.
    return new Date(String(value) + 'T23:59:59+08:00') < new Date();
}

const EXPERIENCE_LEVELS = {
    'Frontend Developer': 'Entry Level',
    'Backend Developer': 'Intermediate',
    'Java Developer': 'Intermediate',
    'Data Analyst': 'Entry Level',
    'Full Stack Developer': 'Intermediate',
    'Software Developer': 'Intermediate',
    'Web Developer': 'Entry Level',
    'Data Scientist': 'Expert',
    'DevOps Engineer': 'Intermediate',
    'Security Analyst': 'Entry Level',
    'Security Engineer': 'Expert',
    'IT Support Specialist': 'Entry Level',
    'Graphic Designer': 'Entry Level',
    'UX/UI Designer': 'Entry Level',
    'Marketing Specialist': 'Entry Level',
    'Spring Boot Developer': 'Intermediate',
};

function getExperienceLevel(jobTitle) {
    return EXPERIENCE_LEVELS[jobTitle] || 'Intermediate';
}


router.get('/', (req, res) => {
    try {
        const { q, category, location, employmentType, minMatch } = req.query;
        const textFilters = { q, category, location, employmentType };
        for (const [field, value] of Object.entries(textFilters)) {
            if (value !== undefined && (typeof value !== 'string' || value.length > 120)) {
                return res.status(400).json({ error: 'Job search filters must be text values of 120 characters or fewer.' });
            }
        }
        if (minMatch !== undefined && minMatch !== '' &&
            (typeof minMatch !== 'string' || !/^\d{1,3}$/.test(minMatch) ||
             Number(minMatch) < 0 || Number(minMatch) > 100)) {
            return res.status(400).json({ error: 'Minimum match must be a number from 0 to 100.' });
        }

        let jobs = searchJobs({ q, category, location });

        if (employmentType) {
            jobs = jobs.filter((j) => (j.employment_type || '').toLowerCase() === employmentType.toLowerCase());
        }


        if (req.session.userId) {
            const userSkills = getUserSkillNames(req.session.userId);
            const userSkillsLower = new Set(userSkills.map((s) => s.toLowerCase()));
            jobs = jobs.map((job) => {
                const { have, missing } = computeSkillGap(job.requiredSkills, [...userSkillsLower]);
                const matchScore = job.requiredSkills.length === 0 ? 0 : Math.round((have.length / job.requiredSkills.length) * 100);
                return { ...job, matchScore, matchingSkills: have, missingSkills: missing };
            });
            if (minMatch) {
                const threshold = parseInt(minMatch, 10) || 0;
                jobs = jobs.filter((j) => j.matchScore >= threshold);
            }
        }

        res.json({ jobs, count: jobs.length });
    } catch (err) {
        console.error('[GET /api/jobs] error:', err);
        res.status(500).json({ error: 'Failed to load jobs.' });
    }
});

router.get('/categories', (req, res) => {
    try {
        const flatTree = getCategoryTree();
        const counts = db.prepare("SELECT category, COUNT(*) AS count FROM jobs WHERE status = 'active' AND (application_deadline IS NULL OR date(application_deadline) >= date('now', '+8 hours')) GROUP BY category").all();
        res.json({ tree: flatTree, counts });
    } catch (err) {
        console.error('[GET /api/jobs/categories] error:', err);
        res.status(500).json({ error: 'Failed to load categories.' });
    }
});

router.get('/saved', requireAuth, requireCandidate, (req, res) => {
    try {
        const jobs = db.prepare(`
            SELECT
                j.*,
                sj.saved_at,
                a.status AS application_status,
                a.applied_at
            FROM saved_jobs sj
            JOIN jobs j ON j.id = sj.job_id
            LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = ?
            WHERE sj.user_id = ? AND j.status <> 'draft'
            ORDER BY sj.saved_at DESC, j.title ASC
        `).all(req.session.userId, req.session.userId);

        res.set('Cache-Control', 'private, no-store, max-age=0');
        res.set('Pragma', 'no-cache');
        res.json({ jobs });
    } catch (err) {
        console.error('[GET /api/jobs/saved] error:', err);
        res.status(500).json({ error: 'Failed to load saved jobs.' });
    }
});

router.post('/saved/:id', requireAuth, requireCandidate, (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (!Number.isInteger(jobId) || jobId <= 0) {
            return res.status(400).json({ error: 'Invalid job id.' });
        }
        const job = db.prepare('SELECT id, status FROM jobs WHERE id = ?').get(jobId);

        if (!job || job.status === 'draft') {
            return res.status(404).json({ error: 'Job not found.' });
        }

        db.prepare(`
            INSERT OR IGNORE INTO saved_jobs (user_id, job_id)
            VALUES (?, ?)
        `).run(req.session.userId, jobId);

        res.json({ success: true, saved: true, jobId });
    } catch (err) {
        console.error('[POST /api/jobs/saved/:id] error:', err);
        res.status(500).json({ error: 'Failed to save job.' });
    }
});

router.delete('/saved/:id', requireAuth, requireCandidate, (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (!Number.isInteger(jobId) || jobId <= 0) {
            return res.status(400).json({ error: 'Invalid job id.' });
        }

        db.prepare(`
            DELETE FROM saved_jobs
            WHERE user_id = ? AND job_id = ?
        `).run(req.session.userId, jobId);

        res.json({ success: true, saved: false, jobId });
    } catch (err) {
        console.error('[DELETE /api/jobs/saved/:id] error:', err);
        res.status(500).json({ error: 'Failed to remove saved job.' });
    }
});

router.get('/recommended', requireAuth, requireCandidate, (req, res) => {
    const userId = req.session.userId;

    try {
        const user = db.prepare(
            'SELECT role FROM users WHERE id = ?'
        ).get(userId);

        if (!user || user.role !== 'candidate') {
            return res.status(403).json({
                error: 'Only candidate accounts can view recommended jobs.'
            });
        }

        const ranked = getRankedJobsForUser(userId);

        res.set('Cache-Control', 'private, no-store, max-age=0');
        res.set('Pragma', 'no-cache');
        res.json({
            jobs: ranked
        });
    } catch (err) {
        console.error('[GET /api/jobs/recommended] error:', err);
        res.status(500).json({
            error: 'Failed to compute recommended jobs.'
        });
    }
});

router.get('/companies', (req, res) => {
    try {
        const companies = db.prepare(`
            SELECT
                cp.company_name,
                cp.description,
                cp.industry,
                cp.company_size,
                cp.location,
                cp.website,
                COUNT(DISTINCT CASE WHEN j.status = 'active' AND (j.application_deadline IS NULL OR date(j.application_deadline) >= date('now', '+8 hours')) THEN j.id END) AS open_jobs
            FROM company_profiles cp
            LEFT JOIN jobs j ON j.company = cp.company_name
            GROUP BY cp.id
            ORDER BY cp.company_name COLLATE NOCASE ASC
        `).all();

        res.json({ success: true, companies });
    } catch (err) {
        console.error('[GET /api/jobs/companies] error:', err);
        res.status(500).json({ error: 'Failed to load companies.' });
    }
});

router.get('/:id', (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (!Number.isInteger(jobId) || jobId <= 0) {
            return res.status(400).json({ error: 'Invalid job id.' });
        }

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
        if (!job || job.status === 'draft') {
            return res.status(404).json({ error: 'Job not found.' });
        }

        const requiredSkills = db.prepare(`
            SELECT s.name FROM job_skills js
            JOIN skills s ON s.id = js.skill_id
            WHERE js.job_id = ?
        `).all(jobId).map((row) => row.name);

        job.requiredSkills = requiredSkills;

        let matchScore = 0, matchingSkills = [], missingSkills = job.requiredSkills;
        if (req.session.userId) {
            const userSkills = getUserSkillNames(req.session.userId);
            const gap = computeSkillGap(job.requiredSkills, userSkills);
            matchingSkills = gap.have;
            missingSkills = gap.missing;
            matchScore = job.requiredSkills.length === 0 ? 0 : Math.round((matchingSkills.length / job.requiredSkills.length) * 100);
        }

        const careerPath = req.session.userId
            ? getCareerPathForJob(jobId, getUserSkillNames(req.session.userId))
            : getCareerPathForJob(jobId, []);

        const verifiedSkills = req.session.userId ? db.prepare('SELECT s.name FROM learning_progress lp JOIN skills s ON s.id = lp.skill_id WHERE lp.user_id = ? AND lp.status = \'verified\'').all(req.session.userId).map((row) => row.name) : [];

        let company = null;

        if (job.company) {
            try {
                company = db.prepare(
                    'SELECT description, email, phone, website FROM company_profiles WHERE company_name = ?'
                ).get(job.company) || null;
            } catch (companyError) {
                console.warn(
                    '[GET /api/jobs/:id] Company profile unavailable:',
                    companyError.message
                );
            }
        }

        const deadlineValid = isValidDateOnly(job.application_deadline);
        const deadlinePassed = Boolean(
            job.application_deadline &&
            (!deadlineValid || isPastDeadline(job.application_deadline))
        );
        const acceptingApplications = job.status === 'active' && !deadlinePassed;

        res.json({
            job,
            acceptingApplications,
            deadlinePassed,
            company,
            matchScore,
            matchingSkills,
            missingSkills,
            verifiedSkills,
            careerPath,
            experienceLevel: getExperienceLevel(job.title),
        });
    } catch (err) {
        console.error('[GET /api/jobs/:id] error:', err);
        res.status(500).json({ error: 'Failed to load job details.' });
    }
});


/* =========================================================
   JOB APPLICATIONS
   ========================================================= */

router.post('/:id/apply', requireAuth, requireCandidate, (req, res) => {
    try {
        const jobId = Number(req.params.id);

        if (!Number.isInteger(jobId) || jobId <= 0) {
            return res.status(400).json({ error: 'Invalid job id.' });
        }

        const user = db.prepare(
            'SELECT id, role FROM users WHERE id = ?'
        ).get(req.session.userId);

        if (!user || user.role !== 'candidate') {
            return res.status(403).json({
                error: 'Only candidate accounts can apply for jobs.'
            });
        }

        const job = db.prepare(
            'SELECT id, title, status, application_deadline, employer_id, company FROM jobs WHERE id = ?'
        ).get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        if (job.status !== 'active') {
            return res.status(400).json({
                error: 'This job is not currently accepting applications.'
            });
        }

        if (job.application_deadline && !isValidDateOnly(job.application_deadline)) {
            return res.status(400).json({
                error: 'This job has an invalid application deadline.'
            });
        }

        if (isPastDeadline(job.application_deadline)) {
            return res.status(400).json({
                error: 'The application deadline has passed.'
            });
        }

        const existing = db.prepare(
            'SELECT id, status FROM applications WHERE job_id = ? AND user_id = ?'
        ).get(jobId, req.session.userId);

        if (existing) {
            return res.status(409).json({
                error: 'You already applied to this job.',
                application: existing
            });
        }

        const resume = db.prepare(
            'SELECT id FROM user_resumes WHERE user_id = ? ORDER BY uploaded_at DESC, id DESC LIMIT 1'
        ).get(req.session.userId);

        const createApplication = db.transaction(() => {
            const info = db.prepare(
                "INSERT INTO applications (job_id, user_id, resume_id, status) VALUES (?, ?, ?, 'new')"
            ).run(
                jobId,
                req.session.userId,
                resume?.id || null
            );

            db.prepare(
                "INSERT INTO application_history (application_id, status) VALUES (?, 'new')"
            ).run(Number(info.lastInsertRowid));

            return Number(info.lastInsertRowid);
        });

        const applicationId = createApplication();

        createNotification({
            userId: req.session.userId,
            type: 'application',
            title: 'Application submitted',
            body: 'Your application for ' + job.title + ' was submitted successfully.',
            link: '/applications.html'
        });
        if (job.employer_id) {
            createNotification({
                userId: job.employer_id,
                type: 'application',
                title: 'New job application',
                body: 'A candidate applied for ' + job.title + '.',
                link: '/employer.html'
            });
        }

        res.status(201).json({
            success: true,
            applicationId,
            jobId,
            resumeAttached: Boolean(resume)
        });
    } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            const existing = db.prepare(
                'SELECT id, status FROM applications WHERE job_id = ? AND user_id = ?'
            ).get(
                Number(req.params.id),
                req.session.userId
            );

            return res.status(409).json({
                error: 'You already applied to this job.',
                application: existing || null
            });
        }

        console.error('[POST /api/jobs/:id/apply] error:', err);
        res.status(500).json({
            error: 'Failed to submit your application.'
        });
    }
});

router.get('/:id/application', requireAuth, requireCandidate, (req, res) => {
    try {
        const jobId = Number(req.params.id);

        if (!Number.isInteger(jobId) || jobId <= 0) {
            return res.status(400).json({ error: 'Invalid job id.' });
        }

        const application = db.prepare(
            'SELECT id, status, applied_at, updated_at FROM applications WHERE job_id = ? AND user_id = ?'
        ).get(jobId, req.session.userId);

        res.set('Cache-Control', 'private, no-store, max-age=0');
        res.set('Pragma', 'no-cache');
        res.json({
            applied: Boolean(application),
            application: application || null
        });
    } catch (err) {
        console.error('[GET /api/jobs/:id/application] error:', err);
        res.status(500).json({ error: 'Failed to check application status.' });
    }
});

module.exports = router;
