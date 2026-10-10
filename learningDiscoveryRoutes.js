const express = require('express');
const { requireAuth } = require('./auth');
const { getLesson, getAvailableLessons } = require('./LearningLessons');
const { getLearningResources } = require('./LearningResources');
const { getUserSkillNames } = require('./JobMatchingService');
const { db } = require('./database');

const router = express.Router();

// Broad topics expand into practical subskills, including interests outside a user's target career.
const TOPIC_MAP = [
    { match: ['graphic design', 'visual design'], skills: ['Color Theory', 'Typography', 'Layout Design', 'Figma', 'Photoshop'] },
    { match: ['ui/ux', 'ui ux', 'user interface', 'user experience'], skills: ['UI/UX Design', 'Figma', 'Color Theory', 'Typography', 'HTML', 'CSS'] },
    { match: ['web development', 'web developer', 'frontend', 'front end'], skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git'] },
    { match: ['backend', 'back end', 'server side'], skills: ['Node.js', 'REST API', 'SQL', 'JavaScript', 'Git'] },
    { match: ['cybersecurity', 'cyber security', 'ethical hacking'], skills: ['Network Security', 'Penetration Testing', 'Python', 'Linux'] },
    { match: ['networking', 'computer network'], skills: ['Networking', 'Network Security', 'Linux', 'Cybersecurity'] },
    { match: ['data analytics', 'data analysis', 'data analyst'], skills: ['SQL', 'Excel', 'Statistics', 'Power BI', 'Python'] },
    { match: ['digital marketing', 'marketing'], skills: ['Digital Marketing', 'Content Marketing', 'SEO', 'Social Media Marketing', 'Market Research'] },
    { match: ['video editing', 'video editor'], skills: ['Video Editing', 'Storytelling', 'Color Theory', 'Photoshop'] },
    { match: ['photography', 'photo editing'], skills: ['Photography', 'Composition', 'Color Theory', 'Photoshop'] },
    { match: ['programming', 'coding'], skills: ['JavaScript', 'Python', 'Java', 'Git', 'SQL'] }
];
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
            return res.status(400).json({ error: 'Enter at least 2 characters to discover learning topics.' });
        }

        const user = db.prepare('SELECT target_job FROM users WHERE id = ?').get(req.session.userId);
        const currentSkills = getUserSkillNames(req.session.userId);
        const owned = new Set(currentSkills.map((skill) => skill.toLowerCase()));
        const available = getAvailableLessons();
        const lowerQuery = query.toLowerCase();
        const words = lowerQuery.split(/\\s+/).filter((word) => word.length > 2);
        const topic = TOPIC_MAP.find((entry) => entry.match.some((phrase) => lowerQuery.includes(phrase)));
        const exact = available.filter((item) =>
            item.skill.toLowerCase().includes(lowerQuery) ||
            lowerQuery.includes(item.skill.toLowerCase())
        );
        const related = available.filter((item) =>
            !exact.some((match) => match.skill.toLowerCase() === item.skill.toLowerCase()) &&
            words.some((word) => item.skill.toLowerCase().includes(word))
        );

        const candidates = [];
        if (topic) {
            candidates.push(...topic.skills.map((skill) => ({
                skill,
                reason: 'A useful building block for ' + query + '.'
            })));
        }
        candidates.push(...exact.map((item) => ({
            skill: item.skill,
            reason: 'Matches your search and has a beginner lesson on JobPath.'
        })));
        candidates.push(...related.slice(0, 4).map((item) => ({
            skill: item.skill,
            reason: 'A related skill you may want to explore.'
        })));
        candidates.unshift({
            skill: query,
            reason: user?.target_job
                ? 'Explore this topic alongside your ' + user.target_job + ' career goal—or just for personal interest.'
                : 'Explore this topic for your career or personal interest.'
        });

        const seen = new Set();
        const suggestions = candidates
            .filter((item) => {
                const key = item.skill.toLowerCase();
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 8)
            .map((item) => ({
                skill: item.skill,
                reason: item.reason,
                hasLesson: Boolean(getLesson(item.skill)),
                alreadyHave: owned.has(item.skill.toLowerCase()),
                resources: getLearningResources(item.skill)
            }));

        res.json({ query, targetJob: user?.target_job || null, currentSkills, suggestions });
    } catch (err) {
        console.error('[GET /api/learning/discover] error:', err);
        res.status(500).json({ error: 'Unable to search learning topics right now.' });
    }
});

module.exports = router;
