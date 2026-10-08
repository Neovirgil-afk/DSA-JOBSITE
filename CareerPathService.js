const { db } = require('./database');
const Graph = require('./Graph');
const { Tree, TreeNode } = require('./Tree');
const { CATEGORY_TREE } = require('./seed');
const { getLearningResources } = require('./LearningResources');

/*
 * Default learning paths are used when a job does not have a row in
 * career_paths yet. This keeps the Learning Hub relevant even when new jobs
 * are added to the job database before their database career path is seeded.
 */
const DEFAULT_CAREER_PATHS = {
    'Marketing Specialist': [
        'Digital Marketing',
        'Market Research',
        'Content Marketing',
        'Social Media Marketing',
        'SEO',
        'Email Marketing',
        'Data Analytics',
    ],
};

function getCareerPathForJob(jobId, userSkillNames = []) {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return null;

    const pathRow = db.prepare('SELECT * FROM career_paths WHERE job_id = ? LIMIT 1').get(jobId);

    let skillNames = [];

    if (pathRow) {
        const stepRows = db.prepare(`
            SELECT s.name, cps.step_order FROM career_path_skills cps
            JOIN skills s ON s.id = cps.skill_id
            WHERE cps.career_path_id = ?
            ORDER BY cps.step_order ASC
        `).all(pathRow.id);

        skillNames = stepRows.map((r) => r.name);
    }

    // If the database has no career path yet, use a job-specific local path.
    // This is especially useful for newly added jobs such as Marketing Specialist.
    if (!skillNames.length && DEFAULT_CAREER_PATHS[job.title]) {
        skillNames = DEFAULT_CAREER_PATHS[job.title];
    }

    // Newly posted jobs may not have a seeded career path yet.
    // Use their required skills as a safe fallback so the Learning Hub
    // still has a path instead of silently returning zero steps.
    if (!skillNames.length) {
        skillNames = db.prepare(
            'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ? ORDER BY js.skill_id ASC'
        ).all(jobId).map((row) => row.name);
    }

    // Normalize and deduplicate path skills case-insensitively.
    // This prevents malformed career-path data from creating repeated steps.
    const seenSkills = new Set();
    skillNames = skillNames
        .map((skill) => String(skill ?? '').trim())
        .filter((skill) => {
            const normalized = skill.toLowerCase();
            if (!normalized || seenSkills.has(normalized)) return false;
            seenSkills.add(normalized);
            return true;
        });

    // Chain skills in sequence, ending at the job node.
    const graph = new Graph();
    const jobNode = `JOB:${job.title}`;

    for (let i = 0; i < skillNames.length; i++) {
        graph.addNode(skillNames[i]);
        if (i > 0) graph.addEdge(skillNames[i - 1], skillNames[i]);
    }

    if (skillNames.length > 0) {
        graph.addEdge(skillNames[skillNames.length - 1], jobNode);
    } else {
        graph.addNode(jobNode);
    }

    // Confirms the graph traversal actually connects the first skill to the job.
    const path = skillNames.length > 0
        ? graph.bfsPath(skillNames[0], jobNode)
        : [jobNode];

    const userSkillSetLower = new Set(userSkillNames.map((s) => s.toLowerCase()));

    const steps = skillNames.map((name, idx) => ({
        order: idx + 1,
        skill: name,
        completed: userSkillSetLower.has(name.toLowerCase()),
        resources: getLearningResources(name),
    }));

    return {
        job,
        steps,
        graphPath: path,
        targetLabel: job.title,
    };
}

function getCategoryTree() {
    const tree = new Tree('All Categories');

    for (const [topCategory, subMap] of Object.entries(CATEGORY_TREE)) {
        const topNode = tree.root.addChild(new TreeNode(topCategory));
        for (const [subCategory, jobTitles] of Object.entries(subMap)) {
            const subNode = topNode.addChild(new TreeNode(subCategory));
            const seenJobs = new Set();

            for (const jobTitle of jobTitles) {
                const normalized = String(jobTitle ?? '').trim().toLowerCase();
                if (!normalized || seenJobs.has(normalized)) continue;
                seenJobs.add(normalized);
                subNode.addChild(new TreeNode(jobTitle, { isJob: true }));
            }
        }
    }

    return tree.traverse();
}

module.exports = { getCareerPathForJob, getCategoryTree };
