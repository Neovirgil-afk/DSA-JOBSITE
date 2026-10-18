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
    'Marketing Specialist': ['Digital Marketing', 'Market Research', 'Content Marketing', 'Social Media Marketing', 'SEO', 'Email Marketing', 'Data Analytics'],
    'Digital Marketing Specialist': ['Digital Marketing', 'Market Research', 'Content Marketing', 'Social Media Marketing', 'SEO', 'Email Marketing', 'Data Analytics'],
    'SEO Specialist': ['Digital Marketing', 'Market Research', 'SEO', 'Content Marketing', 'Data Analytics'],
    'Content Writer': ['Market Research', 'Content Marketing', 'SEO', 'Digital Marketing'],
    'Social Media Specialist': ['Digital Marketing', 'Market Research', 'Social Media Marketing', 'Content Marketing', 'Data Analytics'],
    'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'Git', 'React'],
    'UI Developer': ['HTML', 'CSS', 'JavaScript', 'Git', 'React'],
    'Full Stack Developer': ['HTML', 'CSS', 'JavaScript', 'Git', 'React', 'Node.js', 'SQL'],
    'Backend Developer': ['JavaScript', 'Node.js', 'SQL', 'Git', 'Network Security'],
    'Node.js Developer': ['JavaScript', 'Node.js', 'SQL', 'Git', 'Network Security'],
    'Java Developer': ['Java', 'SQL', 'Git', 'Network Security'],
    'Data Analyst': ['SQL', 'Python', 'Data Analytics', 'Market Research'],
    'Data Scientist': ['Python', 'SQL', 'Data Analytics', 'Market Research'],
    'Cybersecurity Analyst': ['Network Security', 'Penetration Testing', 'AWS', 'Git'],
    'Security Engineer': ['Network Security', 'Penetration Testing', 'AWS', 'Git'],
    'Penetration Tester': ['Network Security', 'Penetration Testing', 'Git'],
    'Cloud Engineer': ['AWS', 'Network Security', 'Git', 'Node.js'],
    'Business Analyst': ['Market Research', 'Data Analytics', 'SQL', 'Digital Marketing'],
    'Marketing Analyst': ['Market Research', 'Data Analytics', 'Digital Marketing', 'SQL']
};

// Match exact titles first, then common role-title variants. Avoid choosing a random
// career path just because a job record happens to have some unrelated skills attached.
function getRoleSpecificPath(title) {
    const normalized = String(title || '').trim().toLowerCase();
    if (!normalized) return null;

    const exact = Object.keys(DEFAULT_CAREER_PATHS).find((role) => role.toLowerCase() === normalized);
    if (exact) return DEFAULT_CAREER_PATHS[exact];

    const roleMatchers = [
        [/frontend|front-end|front end|ui developer/, 'Frontend Developer'],
        [/full.?stack/, 'Full Stack Developer'],
        [/backend|back-end|back end|node\.js developer/, 'Backend Developer'],
        [/java developer|spring boot/, 'Java Developer'],
        [/data analyst|business intelligence|bi analyst/, 'Data Analyst'],
        [/data scientist|machine learning/, 'Data Scientist'],
        [/cyber.?security|security analyst|security engineer/, 'Cybersecurity Analyst'],
        [/penetration tester|pentester/, 'Penetration Tester'],
        [/cloud engineer|cloud administrator/, 'Cloud Engineer'],
        [/seo specialist|seo analyst/, 'SEO Specialist'],
        [/content writer|copywriter|content specialist/, 'Content Writer'],
        [/social media/, 'Social Media Specialist'],
        [/marketing analyst/, 'Marketing Analyst'],
        [/marketing/, 'Marketing Specialist'],
        [/business analyst/, 'Business Analyst']
    ];

    const match = roleMatchers.find(([pattern]) => pattern.test(normalized));
    return match ? DEFAULT_CAREER_PATHS[match[1]] : null;
}

function getCareerPathForJob(jobId, userSkillNames = []) {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return null;

    const roleSpecificPath = getRoleSpecificPath(job.title);
    const pathRow = db.prepare('SELECT * FROM career_paths WHERE job_id = ? LIMIT 1').get(jobId);

    let skillNames = [];

    // Prefer an ordered path curated for the actual target role. Database paths remain
    // the fallback for roles that do not have a matching curriculum template.
    if (roleSpecificPath?.length) {
        skillNames = roleSpecificPath;
    } else if (pathRow) {
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
