const express = require('express');
const { db } = require('./database');
const { requireAuth } = require('./auth');
const { getLesson, getAvailableLessons } = require('./LearningLessons');
const { getLearningResources } = require('./LearningResources');
const { getUserSkillNames } = require('./JobMatchingService');
const { getCareerPathForJob } = require('./CareerPathService');

const router = express.Router();

router.get('/catalog', requireAuth, (req, res) => {
    res.json({ lessons: getAvailableLessons() });
});

router.get('/skill/:skill', requireAuth, (req, res) => {
    const skill = decodeURIComponent(req.params.skill || '').trim();
    const lesson = getLesson(skill);
    if (!lesson) {
        return res.status(404).json({ error: 'No beginner lesson is available for this skill yet.' });
    }
    res.json({ lesson, resources: getLearningResources(skill) });
});

router.get('/recommended', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const userSkills = getUserSkillNames(userId);
        const owned = new Set(userSkills.map((skill) => skill.toLowerCase()));
        const user = db.prepare('SELECT target_job FROM users WHERE id = ?').get(userId);
        let recommendations = [];

        if (user && user.target_job) {
            const job = db.prepare('SELECT id FROM jobs WHERE title = ? LIMIT 1').get(user.target_job);
            if (job) {
                const path = getCareerPathForJob(job.id, userSkills);
                recommendations = (path?.steps || [])
                    .filter((step) => !owned.has(step.skill.toLowerCase()))
                    .map((step) => ({
                        skill: step.skill,
                        reason: 'Recommended for your ' + user.target_job + ' career path.',
                        resources: getLearningResources(step.skill),
                        hasLesson: Boolean(getLesson(step.skill))
                    }));
            }
        }

        if (!recommendations.length) {
            recommendations = getAvailableLessons()
                .filter((item) => !owned.has(item.skill.toLowerCase()))
                .slice(0, 6)
                .map((item) => ({
                    ...item,
                    reason: 'A beginner-friendly skill you can learn on JobSite.',
                    resources: getLearningResources(item.skill),
                    hasLesson: true
                }));
        }

        res.json({
            targetJob: user?.target_job || null,
            currentSkills: userSkills,
            recommendations,
            availableLessons: getAvailableLessons()
        });
    } catch (err) {
        console.error('[GET /api/learning/recommended] error:', err);
        res.status(500).json({ error: 'Failed to load learning recommendations.' });
    }
});

module.exports = router;
