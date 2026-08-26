

const { db } = require('../database/database');
const Graph = require('../algorithms/Graph');
const { Tree } = require('../algorithms/Tree');
const { CATEGORY_TREE } = require('../database/seed');

function getCareerPathForJob(jobId, userSkillNames = []) {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return null;

    const pathRow = db.prepare('SELECT * FROM career_paths WHERE job_id = ? LIMIT 1').get(jobId);
    if (!pathRow) return { job, steps: [] };

    const stepRows = db.prepare(`
        SELECT s.name, cps.step_order FROM career_path_skills cps
        JOIN skills s ON s.id = cps.skill_id
        WHERE cps.career_path_id = ?
        ORDER BY cps.step_order ASC
    `).all(pathRow.id);

    //  chain skills in sequence, ending at the job node.
    const graph = new Graph();
    const jobNode = `JOB:${job.title}`;
    const skillNames = stepRows.map((r) => r.name);

    for (let i = 0; i < skillNames.length; i++) {
        const from = i === 0 ? skillNames[0] : skillNames[i - 1];
        graph.addNode(skillNames[i]);
        if (i > 0) graph.addEdge(skillNames[i - 1], skillNames[i]);
    }
    if (skillNames.length > 0) {
        graph.addEdge(skillNames[skillNames.length - 1], jobNode);
    } else {
        graph.addNode(jobNode);
    }

    // Confirms the graph traversal actually connects the first skill to the job.
    const path = skillNames.length > 0 ? graph.bfsPath(skillNames[0], jobNode) : [jobNode];

    const userSkillSetLower = new Set(userSkillNames.map((s) => s.toLowerCase()));
    const steps = skillNames.map((name, idx) => ({
        order: idx + 1,
        skill: name,
        completed: userSkillSetLower.has(name.toLowerCase()),
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
        const topNode = tree.root.addChild(new (require('../algorithms/Tree').TreeNode)(topCategory));
        for (const [subCategory, jobTitles] of Object.entries(subMap)) {
            const subNode = topNode.addChild(new (require('../algorithms/Tree').TreeNode)(subCategory));
            for (const jobTitle of jobTitles) {
                subNode.addChild(new (require('../algorithms/Tree').TreeNode)(jobTitle, { isJob: true }));
            }
        }
    }

    return tree.traverse();
}

module.exports = { getCareerPathForJob, getCategoryTree };
