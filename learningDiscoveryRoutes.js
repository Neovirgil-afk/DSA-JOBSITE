const express = require('express');
const { requireAuth } = require('./auth');
const { getLesson, getAvailableLessons } = require('./LearningLessons');
const { getLearningResources } = require('./LearningResources');
const { getUserSkillNames } = require('./JobMatchingService');
const { db } = require('./database');

const router = express.Router();

function requireCandidate(req, res, next) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user || user.role !== 'candidate') {
        return res.status(403).json({ error: 'Only candidate accounts can discover learning topics.' });
    }
    next();
}

router.get('/', requireAuth, requireCandidate, (req, res) => {
    try {
        const query = String(req.query.q || '').trim().slice(0, 100);
        if (query.length < 2) {
            return res.json({ query, suggestions: [], message: 'Enter at least 2 characters to discover learning topics.' });
        }

        const user = db.prepare('SELECT target_job FROM users WHERE id = ?').get(req.session.userId);
        const currentSkills = getUserSkillNames(req.session.userId);
        const available = getAvailableLessons();
        const lowerQuery = query.toLowerCase();
        const words = lowerQuery.split(/\s+/);
        const exact = available.filter((item) =>
            item.skill.toLowerCase().includes(lowerQuery) ||
            lowerQuery.includes(item.skill.toLowerCase())
        );
        const related = available.filter((item) =>
            !exact.some((match) => match.skill.toLowerCase() === item.skill.toLowerCase()) &&
            words.some((word) => word.length > 2 && item.skill.toLowerCase().includes(word))
        );

        const suggestions = [
            ...exact.map((item) => ({
                skill: item.skill,
                reason: 'Matches your search and has a beginner lesson on JobPath.',
                hasLesson: true,
                resources: getLearningResources(item.skill)
            })),
            ...related.slice(0, 4).map((item) => ({
                skill: item.skill,
                reason: 'A related skill you may want to explore.',
                hasLesson: true,
                resources: getLearningResources(item.skill)
            }))
        ];

        if (!suggestions.some((item) => item.skill.toLowerCase() === lowerQuery)) {
            suggestions.unshift({
                skill: query,
                reason: user?.target_job
                    ? 'Explore this topic alongside your ' + user.target_job + ' career goal—or just for personal interest.'
                    : 'Explore this topic for your career or personal interest.',
                hasLesson: Boolean(getLesson(query)),
                resources: getLearningResources(query)
            });
        }

        const seen = new Set();
        const unique = suggestions.filter((item) => {
            const key = item.skill.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 8);

        res.json({ query, targetJob: user?.target_job || null, currentSkills, suggestions: unique });
    } catch (err) {
        console.error('[GET /api/learning/discover] error:', err);
        res.status(500).json({ error: 'Unable to search learning topics right now.' });
    }
});

module.exports = router;
