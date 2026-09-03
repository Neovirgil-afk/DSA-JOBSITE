const HashTable = require('./HashTable');

function computeSkillGap(requiredSkills, userSkills) {
    const userSet = new HashTable();

    for (const skill of userSkills) {
        userSet.set(skill.toLowerCase(), true);
    }

    const have = requiredSkills.filter((s) =>
        userSet.has(s.toLowerCase())
    );

    const missing = requiredSkills.filter((s) =>
        !userSet.has(s.toLowerCase())
    );

    return { have, missing };
}

module.exports = { computeSkillGap };