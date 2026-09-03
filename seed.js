

const bcrypt = require('bcryptjs');
const { SKILLS_LIST } = require('./skillsList');

const JOBS = [
    {
        title: 'Backend Developer',
        company: 'NimbusTech Solutions',
        location: 'Manila, Philippines',
        category: 'IT & Software',
        salary: '₱35,000 - ₱55,000',
        employment_type: 'Full-time',
        description: 'Build and maintain server-side logic and APIs for our core platform.',
        requiredSkills: ['Java', 'SQL', 'Git', 'Spring Boot', 'REST API'],
    },
    {
        title: 'Java Developer',
        company: 'CoreStack Systems',
        location: 'Cebu, Philippines',
        category: 'IT & Software',
        salary: '₱32,000 - ₱50,000',
        employment_type: 'Full-time',
        description: 'Develop enterprise Java applications following OOP best practices.',
        requiredSkills: ['Java', 'OOP', 'SQL', 'Git', 'Spring Boot'],
    },
    {
        title: 'Frontend Developer',
        company: 'PixelForge Studio',
        location: 'Remote',
        category: 'IT & Software',
        salary: '₱28,000 - ₱45,000',
        employment_type: 'Full-time',
        description: 'Craft responsive, accessible user interfaces for web products.',
        requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git'],
    },
    {
        title: 'Data Analyst',
        company: 'Insight Metrics Inc.',
        location: 'Makati, Philippines',
        category: 'Data',
        salary: '₱30,000 - ₱48,000',
        employment_type: 'Full-time',
        description: 'Turn raw data into actionable business insights and dashboards.',
        requiredSkills: ['Python', 'SQL', 'Excel', 'Statistics', 'Power BI'],
    },
    {
        title: 'Full Stack Developer',
        company: 'Bright Path Digital',
        location: 'Remote',
        category: 'IT & Software',
        salary: '₱40,000 - ₱60,000',
        employment_type: 'Full-time',
        description: 'Own features end-to-end across frontend and backend.',
        requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git'],
    },
    {
        title: 'Software Developer',
        company: 'Quantify Labs',
        location: 'Taguig, Philippines',
        category: 'IT & Software',
        salary: '₱33,000 - ₱52,000',
        employment_type: 'Full-time',
        description: 'General-purpose software engineering role across internal tools.',
        requiredSkills: ['Java', 'Git', 'SQL', 'OOP'],
    },
    {
        title: 'Web Developer',
        company: 'Clearview Agency',
        location: 'Davao, Philippines',
        category: 'IT & Software',
        salary: '₱25,000 - ₱40,000',
        employment_type: 'Full-time',
        description: 'Build and maintain client websites and landing pages.',
        requiredSkills: ['HTML', 'CSS', 'JavaScript', 'Git'],
    },
    {
        title: 'Data Scientist',
        company: 'Insight Metrics Inc.',
        location: 'Makati, Philippines',
        category: 'Data',
        salary: '₱45,000 - ₱70,000',
        employment_type: 'Full-time',
        description: 'Build predictive models and statistical analyses at scale.',
        requiredSkills: ['Python', 'SQL', 'Statistics', 'Power BI'],
    },
    {
        title: 'DevOps Engineer',
        company: 'CloudBridge Systems',
        location: 'Remote',
        category: 'IT & Software',
        salary: '₱45,000 - ₱65,000',
        employment_type: 'Full-time',
        description: 'Automate deployment pipelines and manage cloud infrastructure.',
        requiredSkills: ['Git', 'Docker', 'AWS', 'SQL'],
    },
    {
        title: 'Security Analyst',
        company: 'ShieldWorks',
        location: 'Quezon City, Philippines',
        category: 'Cybersecurity',
        salary: '₱35,000 - ₱55,000',
        employment_type: 'Full-time',
        description: 'Monitor systems and respond to security incidents.',
        requiredSkills: ['Network Security', 'Git', 'SQL'],
    },
    {
        title: 'Security Engineer',
        company: 'ShieldWorks',
        location: 'Quezon City, Philippines',
        category: 'Cybersecurity',
        salary: '₱42,000 - ₱65,000',
        employment_type: 'Full-time',
        description: 'Design and harden secure systems and pentest applications.',
        requiredSkills: ['Network Security', 'Penetration Testing', 'AWS'],
    },
    {
        title: 'IT Support Specialist',
        company: 'Helpdesk Pro',
        location: 'Pasig, Philippines',
        category: 'IT & Software',
        salary: '₱20,000 - ₱30,000',
        employment_type: 'Full-time',
        description: 'Provide first-line technical support to end users.',
        requiredSkills: ['Git', 'SQL'],
    },
    {
        title: 'Graphic Designer',
        company: 'Studio Nine',
        location: 'Remote',
        category: 'Design',
        salary: '₱22,000 - ₱35,000',
        employment_type: 'Full-time',
        description: 'Design marketing visuals, branding, and social media assets.',
        requiredSkills: ['Photoshop', 'Figma'],
    },
    {
        title: 'UX/UI Designer',
        company: 'PixelForge Studio',
        location: 'Remote',
        category: 'Design',
        salary: '₱30,000 - ₱48,000',
        employment_type: 'Full-time',
        description: 'Design intuitive product experiences and interactive prototypes.',
        requiredSkills: ['Figma', 'HTML', 'CSS'],
    },
    {
        title: 'Marketing Specialist',
        company: 'BrightWave Marketing',
        location: 'Manila, Philippines',
        category: 'Marketing',
        salary: '₱24,000 - ₱38,000',
        employment_type: 'Full-time',
        description: 'Plan and execute digital marketing campaigns.',
        requiredSkills: ['Excel', 'Statistics'],
    },
    {
        title: 'Spring Boot Developer',
        company: 'CoreStack Systems',
        location: 'Cebu, Philippines',
        category: 'IT & Software',
        salary: '₱35,000 - ₱55,000',
        employment_type: 'Full-time',
        description: 'Specialize in building microservices with Spring Boot.',
        requiredSkills: ['Java', 'Spring Boot', 'REST API', 'SQL', 'Docker'],
    },
];

const CATEGORY_TREE = {
    Technology: {
        'Software Development': ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Software Developer', 'Web Developer', 'Java Developer', 'Spring Boot Developer', 'DevOps Engineer', 'IT Support Specialist'],
        Data: ['Data Analyst', 'Data Scientist'],
        Cybersecurity: ['Security Analyst', 'Security Engineer'],
    },
    Design: {
        'Visual & Product Design': ['Graphic Designer', 'UX/UI Designer'],
    },
    Business: {
        Marketing: ['Marketing Specialist'],
    },
};


const CAREER_PATHS = {
    'Backend Developer': ['Java', 'Git', 'Spring Boot', 'REST API'],
    'Java Developer': ['Java', 'OOP', 'Git', 'Spring Boot'],
    'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React'],
    'Data Analyst': ['Excel', 'SQL', 'Python', 'Power BI'],
    'Full Stack Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js'],
    'Data Scientist': ['Python', 'SQL', 'Statistics', 'Power BI'],
    'DevOps Engineer': ['Git', 'Docker', 'AWS'],
    'Security Engineer': ['Network Security', 'Penetration Testing', 'AWS'],
    'Spring Boot Developer': ['Java', 'Spring Boot', 'REST API', 'Docker'],
};

function seedIfNeeded(db) {
    const jobCount = db.prepare('SELECT COUNT(*) AS c FROM jobs').get().c;
    if (jobCount > 0) {
        console.log('[seed] Database already populated — skipping seed.');
        return;
    }

    console.log('[seed] Seeding database with skills, jobs, and demo user...');

    const insertSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)');
    const getSkillId = db.prepare('SELECT id FROM skills WHERE name = ?');

    const seedTx = db.transaction(() => {
        // 1) Skills
        for (const skill of SKILLS_LIST) {
            insertSkill.run(skill.name, skill.category);
        }

        // 2) Jobs + job_skills
        const insertJob = db.prepare(`
            INSERT INTO jobs (title, description, company, location, category, salary, employment_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertJobSkill = db.prepare('INSERT OR IGNORE INTO job_skills (job_id, skill_id, required) VALUES (?, ?, 1)');

        const jobIdByTitle = {};

        for (const job of JOBS) {
            const info = insertJob.run(
                job.title, job.description, job.company, job.location,
                job.category, job.salary, job.employment_type
            );
            const jobId = info.lastInsertRowid;
            jobIdByTitle[job.title] = jobId;

            for (const skillName of job.requiredSkills) {
                const skillRow = getSkillId.get(skillName);
                if (skillRow) insertJobSkill.run(jobId, skillRow.id);
            }
        }

        // 3) Career paths (graph edges as an ordered skill list per job)
        const insertPath = db.prepare('INSERT INTO career_paths (job_id, name) VALUES (?, ?)');
        const insertPathSkill = db.prepare('INSERT INTO career_path_skills (career_path_id, skill_id, step_order) VALUES (?, ?, ?)');

        for (const [jobTitle, skillSequence] of Object.entries(CAREER_PATHS)) {
            const jobId = jobIdByTitle[jobTitle];
            if (!jobId) continue;
            const pathInfo = insertPath.run(jobId, `Path to ${jobTitle}`);
            const pathId = pathInfo.lastInsertRowid;

            skillSequence.forEach((skillName, index) => {
                const skillRow = getSkillId.get(skillName);
                if (skillRow) insertPathSkill.run(pathId, skillRow.id, index + 1);
            });
        }

        // 4) Demo user
        const passwordHash = bcrypt.hashSync('demo123', 10);
        const insertUser = db.prepare(`
            INSERT INTO users (full_name, email, password_hash, education, degree, target_job, location)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const demoInfo = insertUser.run(
            'Demo User', 'demo@jobpath.com', passwordHash,
            'BS Information Technology', 'Bachelor of Science', 'Backend Developer', 'Manila, Philippines'
        );
        const demoUserId = demoInfo.lastInsertRowid;

        const demoSkills = ['Java', 'SQL', 'Git', 'HTML', 'CSS', 'JavaScript'];
        const insertUserSkill = db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, source) VALUES (?, ?, ?)');
        for (const skillName of demoSkills) {
            const skillRow = getSkillId.get(skillName);
            if (skillRow) insertUserSkill.run(demoUserId, skillRow.id, 'resume');
        }
    });

    seedTx();
    console.log('[seed] Done. Demo login: demo@jobpath.com / demo123');
}

module.exports = { seedIfNeeded, CATEGORY_TREE, CAREER_PATHS };
