const express = require('express');
const { db } = require('./database');
const { requireAuth } = require('./auth');
const { getLesson, getAvailableLessons, gradeQuiz } = require('./LearningLessons');
const { getLearningResources } = require('./LearningResources');
const { getUserSkillNames, getRankedJobsForUser } = require('./JobMatchingService');
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

router.post('/assessment/complete', requireAuth, (req, res) => {
    try {
        const result = gradeQuiz(req.body?.skill, req.body?.answers);
        if (!result) return res.status(400).json({ error: 'Invalid assessment.' });

        const skillRow = db.prepare(
            'SELECT id, name FROM skills WHERE lower(name) = lower(?) LIMIT 1'
        ).get(result.skill);
        if (!skillRow) {
            return res.status(404).json({ error: 'Skill is not available in the JobSite skill catalog.' });
        }

        db.prepare(
            "INSERT INTO learning_progress (user_id, skill_id, status, score, total_questions, completed_at) VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(user_id, skill_id) DO UPDATE SET status = excluded.status, score = excluded.score, total_questions = excluded.total_questions, completed_at = excluded.completed_at"
        ).run(
            req.session.userId,
            skillRow.id,
            result.passed ? 'verified' : 'needs_review',
            result.score,
            result.total,
            result.passed ? 1 : 0
        );

        if (!result.passed) {
            return res.json({
                ...result,
                verified: false,
                message: 'Keep practicing the lesson and try again.'
            });
        }

        db.prepare(
            "INSERT INTO user_skills (user_id, skill_id, source) VALUES (?, ?, 'simulator') ON CONFLICT(user_id, skill_id) DO UPDATE SET source = 'simulator'"
        ).run(req.session.userId, skillRow.id);

        const updatedSkills = getUserSkillNames(req.session.userId);
        const rankedJobs = getRankedJobsForUser(req.session.userId);

        res.json({
            ...result,
            verified: true,
            skill: skillRow.name,
            updatedSkills,
            topMatches: rankedJobs.slice(0, 6),
            message: skillRow.name + ' has been verified and added to your skills.'
        });
    } catch (err) {
        console.error('[POST /api/learning/assessment/complete] error:', err);
        res.status(500).json({ error: 'Failed to save assessment result.' });
    }
});

module.exports = router;
