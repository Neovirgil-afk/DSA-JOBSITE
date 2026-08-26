
const HashTable = require('./HashTable');
const MaxHeap = require('./MaxHeap');

/**
 * @param {Array} jobs - array of { id, title, ...otherFields, requiredSkills: [skillNameLowerCase,...] }
 * @param {Array<string>} userSkills - array of skill names the user has (any case)
 * @returns {Array} jobs sorted highest match -> lowest, each augmented with
 *                   matchScore, matchingSkills, missingSkills
 */
function calculateMatches(jobs, userSkills) {
    // Hash Table: O(1) average membership check for "does the user have skill X"
    const userSkillSet = new HashTable();
    for (const skill of userSkills) {
        userSkillSet.set(skill.toLowerCase(), true);
    }

    const heap = new MaxHeap();

    for (const job of jobs) {
        const required = job.requiredSkills || [];
        const matching = required.filter((s) => userSkillSet.has(s.toLowerCase()));
        const missing = required.filter((s) => !userSkillSet.has(s.toLowerCase()));

        const matchScore = required.length === 0
            ? 0
            : Math.round((matching.length / required.length) * 100);

        const enrichedJob = {
            ...job,
            matchScore,
            matchingSkills: matching,
            missingSkills: missing,
        };

        // Max Heap: rank by matchScore so the best match is always on top
        heap.insert(matchScore, enrichedJob);
    }

    return heap.toSortedArray();
}

module.exports = { calculateMatches };
