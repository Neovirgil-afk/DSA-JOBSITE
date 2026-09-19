

const bcrypt = require('bcryptjs');
const { SKILLS_LIST } = require('./skillsList');


const COMPANY_PROFILES = {
    'NimbusTech Solutions': {
        description: 'Technology company building cloud-based business software and digital platforms.',
        email: 'careers@nimbustech.example',
        phone: '+63 2 8000 1001',
        website: 'https://nimbustech.example',
    },
    'CoreStack Systems': {
        description: 'Software engineering company focused on enterprise applications and backend systems.',
        email: 'careers@corestack.example',
        phone: '+63 32 800 2001',
        website: 'https://corestack.example',
    },
    'PixelForge Studio': {
        description: 'Digital product studio creating websites, interfaces, and interactive web experiences.',
        email: 'careers@pixelforge.example',
        phone: '+63 2 8000 3001',
        website: 'https://pixelforge.example',
    },
    'Insight Metrics Inc.': {
        description: 'Data-focused team delivering analytics, dashboards, and business intelligence solutions.',
        email: 'careers@insightmetrics.example',
        phone: '+63 2 8000 4001',
        website: 'https://insightmetrics.example',
    },
    'Bright Path Digital': {
        description: 'Digital agency building end-to-end web products for growing businesses.',
        email: 'careers@brightpath.example',
        phone: '+63 2 8000 5001',
        website: 'https://brightpath.example',
    },
    'Quantify Labs': {
        description: 'Software team developing internal tools and practical technology solutions.',
        email: 'careers@quantifylabs.example',
        phone: '+63 2 8000 6001',
        website: 'https://quantifylabs.example',
    },
    'Clearview Agency': {
        description: 'Web agency specializing in client websites, landing pages, and digital experiences.',
        email: 'careers@clearview.example',
        phone: '+63 82 800 7001',
        website: 'https://clearview.example',
    },
    'CloudBridge Systems': {
        description: 'Cloud engineering company focused on infrastructure, automation, and deployment systems.',
        email: 'careers@cloudbridge.example',
        phone: '+63 2 8000 8001',
        website: 'https://cloudbridge.example',
    },
    'ShieldWorks': {
        description: 'Cybersecurity team focused on monitoring, secure systems, and application protection.',
        email: 'careers@shieldworks.example',
        phone: '+63 2 8000 9001',
        website: 'https://shieldworks.example',
    },
    'Helpdesk Pro': {
        description: 'IT support provider helping organizations keep their users and systems productive.',
        email: 'careers@helpdeskpro.example',
        phone: '+63 2 8010 1001',
        website: 'https://helpdeskpro.example',
    },
    'Studio Nine': {
        description: 'Creative studio producing branding, marketing visuals, and digital design assets.',
        email: 'careers@studionine.example',
        phone: '+63 2 8010 1101',
        website: 'https://studionine.example',
    },
    'BrightWave Marketing': {
        description: 'Digital marketing team focused on campaigns, growth, and measurable business results.',
        email: 'careers@brightwave.example',
        phone: '+63 2 8010 1201',
        website: 'https://brightwave.example',
    },
};

function ensureCompanyProfiles(db) {
    const insert = db.prepare(`
        INSERT OR IGNORE INTO company_profiles
        (company_name, description, email, phone, website)
        VALUES (?, ?, ?, ?, ?)
    `);

    const sync = db.transaction(() => {
        for (const [company, profile] of Object.entries(COMPANY_PROFILES)) {
            insert.run(
                company,
                profile.description,
                profile.email,
                profile.phone,
                profile.website
            );
        }
    });

    sync();
}

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


    {
        title: 'Accountant',
        company: 'LedgerWorks Philippines',
        location: 'Makati, Philippines',
        category: 'Business & Finance',
        salary: '₱28,000 - ₱45,000',
        employment_type: 'Full-time',
        description: 'Prepare financial records, reconciliations, reports, and accounting documentation.',
        requiredSkills: ['Accounting', 'Financial Reporting', 'Excel', 'Financial Analysis'],
    },
    {
        title: 'Financial Analyst',
        company: 'Prime Finance Group',
        location: 'Makati, Philippines',
        category: 'Business & Finance',
        salary: '₱35,000 - ₱55,000',
        employment_type: 'Full-time',
        description: 'Analyze financial data, forecasts, budgets, and business performance.',
        requiredSkills: ['Financial Analysis', 'Financial Modeling', 'Excel', 'Budgeting', 'Statistics'],
    },
    {
        title: 'Human Resources Specialist',
        company: 'PeopleFirst Services',
        location: 'Pasig, Philippines',
        category: 'Human Resources',
        salary: '₱25,000 - ₱40,000',
        employment_type: 'Full-time',
        description: 'Support recruitment, employee relations, onboarding, and HR documentation.',
        requiredSkills: ['Human Resources Management', 'Recruitment', 'Employee Relations', 'Microsoft Office'],
    },
    {
        title: 'Registered Nurse',
        company: 'CareWell Medical Center',
        location: 'Lipa, Philippines',
        category: 'Healthcare',
        salary: '₱30,000 - ₱50,000',
        employment_type: 'Full-time',
        description: 'Provide patient care, clinical support, medication administration, and health documentation.',
        requiredSkills: ['Patient Care', 'Clinical Assessment', 'Medication Administration', 'Infection Control', 'CPR'],
    },
    {
        title: 'Medical Technologist',
        company: 'HealthLab Diagnostics',
        location: 'Batangas, Philippines',
        category: 'Healthcare',
        salary: '₱25,000 - ₱40,000',
        employment_type: 'Full-time',
        description: 'Perform laboratory testing, specimen handling, analysis, and laboratory documentation.',
        requiredSkills: ['Medical Laboratory', 'Laboratory Testing', 'Specimen Collection', 'Clinical Laboratory Science'],
    },
    {
        title: 'Healthcare Administrator',
        company: 'CareWell Medical Center',
        location: 'Manila, Philippines',
        category: 'Healthcare Administration',
        salary: '₱30,000 - ₱48,000',
        employment_type: 'Full-time',
        description: 'Coordinate healthcare operations, records, scheduling, and administrative services.',
        requiredSkills: ['Healthcare Administration', 'Healthcare Management', 'Medical Records', 'Microsoft Office'],
    },
    {
        title: 'High School Teacher',
        company: 'Bright Future Academy',
        location: 'Batangas, Philippines',
        category: 'Education',
        salary: '₱25,000 - ₱40,000',
        employment_type: 'Full-time',
        description: 'Plan lessons, teach students, assess learning, and manage classroom activities.',
        requiredSkills: ['Teaching', 'Lesson Planning', 'Classroom Management', 'Educational Assessment'],
    },
    {
        title: 'Instructional Designer',
        company: 'LearnTech Solutions',
        location: 'Remote',
        category: 'Education',
        salary: '₱30,000 - ₱50,000',
        employment_type: 'Full-time',
        description: 'Design learning materials, online courses, assessments, and instructional experiences.',
        requiredSkills: ['Instructional Design', 'Curriculum Development', 'Educational Assessment', 'E-Learning'],
    },
    {
        title: 'Civil Engineer',
        company: 'BuildRight Engineering',
        location: 'Batangas, Philippines',
        category: 'Engineering',
        salary: '₱30,000 - ₱50,000',
        employment_type: 'Full-time',
        description: 'Plan, design, analyze, and supervise civil engineering and construction projects.',
        requiredSkills: ['Civil Engineering', 'AutoCAD', 'Structural Analysis', 'Project Management'],
    },
    {
        title: 'Mechanical Engineer',
        company: 'Precision Manufacturing',
        location: 'Laguna, Philippines',
        category: 'Engineering',
        salary: '₱30,000 - ₱50,000',
        employment_type: 'Full-time',
        description: 'Design mechanical systems, analyze components, and support manufacturing operations.',
        requiredSkills: ['Mechanical Engineering', 'AutoCAD', 'CAD', 'Engineering Design', 'Project Management'],
    },
    {
        title: 'Electrical Engineer',
        company: 'PowerGrid Engineering',
        location: 'Quezon City, Philippines',
        category: 'Engineering',
        salary: '₱32,000 - ₱52,000',
        employment_type: 'Full-time',
        description: 'Design, test, and maintain electrical systems and engineering projects.',
        requiredSkills: ['Electrical Engineering', 'Electrical Design', 'Circuit Design', 'AutoCAD', 'Project Management'],
    },
    {
        title: 'Laboratory Research Assistant',
        company: 'Pacific Research Institute',
        location: 'Manila, Philippines',
        category: 'Science & Research',
        salary: '₱24,000 - ₱38,000',
        employment_type: 'Full-time',
        description: 'Assist with laboratory experiments, research documentation, sample preparation, and data analysis.',
        requiredSkills: ['Laboratory Research', 'Scientific Research', 'Data Analysis', 'Laboratory Testing', 'Statistics'],
    },
    {
        title: 'Hotel Operations Supervisor',
        company: 'HarborView Hotel',
        location: 'Boracay, Philippines',
        category: 'Hospitality & Tourism',
        salary: '₱25,000 - ₱40,000',
        employment_type: 'Full-time',
        description: 'Supervise hotel operations, guest services, staff coordination, and daily hospitality activities.',
        requiredSkills: ['Hotel Operations', 'Guest Services', 'Hospitality Management', 'Staff Management'],
    },
    {
        title: 'Event Coordinator',
        company: 'Premier Events PH',
        location: 'Manila, Philippines',
        category: 'Hospitality & Tourism',
        salary: '₱22,000 - ₱35,000',
        employment_type: 'Full-time',
        description: 'Coordinate events, vendors, schedules, logistics, and client requirements.',
        requiredSkills: ['Event Management', 'Event Planning', 'Project Management', 'Customer Service'],
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
        title: 'Content Writer',
        company: 'Storyline Media',
        location: 'Remote',
        category: 'Media & Communication',
        salary: '₱22,000 - ₱38,000',
        employment_type: 'Full-time',
        description: 'Create clear written content for digital platforms, campaigns, and publications.',
        requiredSkills: ['Copywriting', 'Content Writing', 'Research', 'SEO'],
    },
    {
        title: 'Paralegal Assistant',
        company: 'Civic Legal Services',
        location: 'Makati, Philippines',
        category: 'Legal',
        salary: '₱25,000 - ₱40,000',
        employment_type: 'Full-time',
        description: 'Support legal professionals with research, documentation, records, and case preparation.',
        requiredSkills: ['Legal Research', 'Legal Documentation', 'Case Management', 'Microsoft Office'],
    },
    {
        title: 'Automotive Technician',
        company: 'MotorWorks Philippines',
        location: 'Batangas, Philippines',
        category: 'Skilled Trades',
        salary: '₱20,000 - ₱35,000',
        employment_type: 'Full-time',
        description: 'Inspect, diagnose, maintain, and repair automotive systems and components.',
        requiredSkills: ['Automotive Repair', 'Vehicle Diagnostics', 'Mechanical Maintenance', 'Electrical Systems'],
    },
    {
        title: 'Electrician',
        company: 'SafeLine Electrical Services',
        location: 'Batangas, Philippines',
        category: 'Skilled Trades',
        salary: '₱20,000 - ₱35,000',
        employment_type: 'Full-time',
        description: 'Install, maintain, troubleshoot, and repair electrical wiring and equipment.',
        requiredSkills: ['Electrical Installation', 'Electrical Wiring', 'Electrical Maintenance', 'Troubleshooting'],
    },

const CATEGORY_TREE = {
    Technology: {
        'Software Development': ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Software Developer', 'Web Developer', 'Java Developer', 'Spring Boot Developer', 'DevOps Engineer', 'IT Support Specialist'],
        Data: ['Data Analyst', 'Data Scientist'],
        Cybersecurity: ['Security Analyst', 'Security Engineer'],
    },
    Design: {
        'Visual & Product Design': ['Graphic Designer', 'UX/UI Designer', 'Graphic Designer'],
    },
    Business: {
        'Finance & Accounting': ['Accountant', 'Financial Analyst'],
        'Human Resources': ['Human Resources Specialist'],
        Marketing: ['Marketing Specialist'],
    },
    Healthcare: {
        Nursing: ['Registered Nurse'],
        Laboratory: ['Medical Technologist', 'Laboratory Research Assistant'],
        Administration: ['Healthcare Administrator'],
    },
    Education: {
        Teaching: ['High School Teacher'],
        'Learning Design': ['Instructional Designer'],
    },
    Engineering: {
        Civil: ['Civil Engineer'],
        Mechanical: ['Mechanical Engineer'],
        Electrical: ['Electrical Engineer'],
    },
    'Hospitality & Tourism': {
        Hospitality: ['Hotel Operations Supervisor'],
        Events: ['Event Coordinator'],
    },
    'Media & Communication': {
        Writing: ['Content Writer'],
    },
    Legal: {
        Support: ['Paralegal Assistant'],
    },
    'Skilled Trades': {
        Automotive: ['Automotive Technician'],
        Electrical: ['Electrician'],
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
        ensureCompanyProfiles(db);
        console.log('[seed] Database already populated — syncing company profiles.');
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
    ensureCompanyProfiles(db);
    console.log('[seed] Done. Demo login: demo@jobpath.com / demo123');
}

module.exports = { seedIfNeeded, CATEGORY_TREE, CAREER_PATHS };
