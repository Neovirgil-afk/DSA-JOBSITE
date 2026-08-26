

const { db } = require('../database/database');
const { calculateMatches } = require('../algorithms/JobMatcher');
const { mergeSort } = require('../algorithms/Sorting');

// Loads every job with its list of required skill names attached.
function getAllJobsWithSkills() {
    const jobs = db.prepare('SELECT * FROM jobs').all();
    const skillStmt = db.prepare(`
        SELECT s.name FROM job_skills js
        JOIN skills s ON s.id = js.skill_id
        WHERE js.job_id = ?
    `);

    return jobs.map((job) => ({
        ...job,
        requiredSkills: skillStmt.all(job.id).map((r) => r.name),
    }));
}

function getUserSkillNames(userId) {
    const rows = db.prepare(`
        SELECT s.name FROM user_skills us
        JOIN skills s ON s.id = us.skill_id
        WHERE us.user_id = ?
    `).all(userId);
    return rows.map((r) => r.name);
}

// Returns all jobs ranked by match score (highest first) for a given user.
function getRankedJobsForUser(userId) {
    const jobs = getAllJobsWithSkills();
    const userSkills = getUserSkillNames(userId);
    return calculateMatches(jobs, userSkills);
}

// Used by the What-If Simulator: pass an arbitrary skill array instead of a stored user.
function getRankedJobsForSkillSet(skillNames) {
    const jobs = getAllJobsWithSkills();
    return calculateMatches(jobs, skillNames);
}

// Simple text/category/location search across jobs, sorted alphabetically via Merge Sort DSA.
function searchJobs({ q, category, location }) {
    let jobs = getAllJobsWithSkills();

    if (q) {
        const query = q.toLowerCase();
        jobs = jobs.filter((job) =>
            job.title.toLowerCase().includes(query) ||
            job.requiredSkills.some((s) => s.toLowerCase().includes(query)) ||
            (job.category || '').toLowerCase().includes(query)
        );
    }
    if (category) {
        jobs = jobs.filter((job) => (job.category || '').toLowerCase() === category.toLowerCase());
    }
    if (location) {
        const loc = location.toLowerCase();
        jobs = jobs.filter((job) => (job.location || '').toLowerCase().includes(loc));
    }

    //sort search results using manually implemented Merge Sort
    return mergeSort(jobs, (a, b) => a.title.localeCompare(b.title));
}

module.exports = {
    getAllJobsWithSkills,
    getUserSkillNames,
    getRankedJobsForUser,
    getRankedJobsForSkillSet,
    searchJobs,
};
