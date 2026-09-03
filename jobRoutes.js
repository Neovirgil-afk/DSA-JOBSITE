
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

router.get('/recommended', requireAuth, (req, res) => {
    try {
        const ranked = getRankedJobsForUser(req.session.userId);
        res.json({ jobs: ranked });
    } catch (err) {
        console.error('[GET /api/jobs/recommended] error:', err);
        res.status(500).json({ error: 'Failed to compute recommended jobs.' });
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
            ? getCareerPathForJob(jobId, require('../services/JobMatchingService').getUserSkillNames(req.session.userId))
            : getCareerPathForJob(jobId, []);

        res.json({ job, matchScore, matchingSkills, missingSkills, careerPath });
    } catch (err) {
        console.error('[GET /api/jobs/:id] error:', err);
        res.status(500).json({ error: 'Failed to load job details.' });
    }
});

module.exports = router;
