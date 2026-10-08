
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

const router = express.Router();

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
        const counts = db.prepare('SELECT category, COUNT(*) AS count FROM jobs GROUP BY category').all();
        res.json({ tree: flatTree, counts });
    } catch (err) {
        console.error('[GET /api/jobs/categories] error:', err);
        res.status(500).json({ error: 'Failed to load categories.' });
    }
});

router.get('/saved', requireAuth, (req, res) => {
    try {
        const jobs = db.prepare(`
            SELECT
                j.*,
                sj.saved_at
            FROM saved_jobs sj
            JOIN jobs j ON j.id = sj.job_id
            WHERE sj.user_id = ?
            ORDER BY sj.saved_at DESC, j.title ASC
        `).all(req.session.userId);

        res.json({ jobs });
    } catch (err) {
        console.error('[GET /api/jobs/saved] error:', err);
        res.status(500).json({ error: 'Failed to load saved jobs.' });
    }
});

router.post('/saved/:id', requireAuth, (req, res) => {
    try {
        const jobId = parseInt(req.params.id, 10);
        const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);

        if (!job) {
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

router.delete('/saved/:id', requireAuth, (req, res) => {
    try {
        const jobId = parseInt(req.params.id, 10);

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

router.get('/recommended', requireAuth, (req, res) => {
    const startedAt = Date.now();
    const userId = req.session.userId;

    console.log(
        `[DEBUG /api/jobs/recommended] START userId=${userId}`
    );

    try {
        console.log(
            '[DEBUG /api/jobs/recommended] Loading user skills...'
        );

        const userSkills = getUserSkillNames(userId);

        console.log(
            `[DEBUG /api/jobs/recommended] User skills loaded: ${userSkills.length}`
        );

        console.log(
            '[DEBUG /api/jobs/recommended] Loading jobs and calculating matches...'
        );

        const ranked = getRankedJobsForUser(userId);

        console.log(
            `[DEBUG /api/jobs/recommended] Matching complete: ${ranked.length} jobs in ${Date.now() - startedAt}ms`
        );

        res.json({
            jobs: ranked,
            debug: {
                userSkills: userSkills.length,
                jobsRanked: ranked.length,
                durationMs: Date.now() - startedAt
            }
        });
    } catch (err) {
        console.error(
            '[DEBUG /api/jobs/recommended] ERROR:',
            err
        );

        res.status(500).json({
            error: 'Failed to compute recommended jobs.',
            debug: {
                message: err.message,
                durationMs: Date.now() - startedAt
            }
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
                COUNT(DISTINCT CASE WHEN j.status = 'active' THEN j.id END) AS open_jobs
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
        const jobId = parseInt(req.params.id, 10);
        if (Number.isNaN(jobId)) return res.status(400).json({ error: 'Invalid job id.' });

        const jobs = getAllJobsWithSkills();
        const job = jobs.find((j) => j.id === jobId);
        if (!job) return res.status(404).json({ error: 'Job not found.' });

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

        const verifiedSkills = req.session.userId ? db.prepare('SELECT s.name FROM learning_progress lp JOIN skills s ON s.id = lp.skill_id WHERE lp.user_id = ? AND lp.status = \'verified\'').all(req.session.userId).map((row) => row.name) : [];\n\n        let company = null;

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

        res.json({
            job,
            company,
            matchScore,
            matchingSkills,
            missingSkills,
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

router.post('/:id/apply', requireAuth, (req, res) => {
    try {
        const jobId = parseInt(req.params.id, 10);

        if (Number.isNaN(jobId)) {
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
            'SELECT id, title, status, application_deadline FROM jobs WHERE id = ?'
        ).get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        if (job.status !== 'active') {
            return res.status(400).json({
                error: 'This job is not currently accepting applications.'
            });
        }

        if (
            job.application_deadline &&
            new Date(job.application_deadline + 'T23:59:59') < new Date()
        ) {
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

        res.status(201).json({
            success: true,
            applicationId: Number(info.lastInsertRowid),
            jobId,
            resumeAttached: Boolean(resume)
        });
    } catch (err) {
        console.error('[POST /api/jobs/:id/apply] error:', err);
        res.status(500).json({
            error: 'Failed to submit your application.'
        });
    }
});

router.get('/:id/application', requireAuth, (req, res) => {
    try {
        const jobId = parseInt(req.params.id, 10);

        const application = db.prepare(
            'SELECT id, status, applied_at, updated_at FROM applications WHERE job_id = ? AND user_id = ?'
        ).get(jobId, req.session.userId);

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
