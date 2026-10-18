const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const authRateLimit = require('./authRateLimit');

const router = express.Router();

function establishSession(req, userId, maxAge, callback) {
    req.session.regenerate((regenerateError) => {
        if (regenerateError) return callback(regenerateError);
        req.session.userId = Number(userId);
        req.session.cookie.maxAge = maxAge;
        req.session.save(callback);
    });
}


/* =========================================================
   REGISTER
   ========================================================= */

router.post('/register', authRateLimit, (req, res) => {

    try {

        const {
            fullName,
            email,
            password,
            confirmPassword,
            education,
            degree,
            targetJob,
            location
        } = req.body || {};


        /* ---------- REQUIRED FIELDS ---------- */

        if (
            !fullName ||
            !email ||
            !password ||
            !confirmPassword ||
            !education ||
            !degree ||
            !targetJob ||
            !location
        ) {

            return res.status(400).json({
                error: 'All fields are required.'
            });

        }


        if (typeof fullName !== 'string' || typeof email !== 'string' ||
            typeof password !== 'string' || typeof confirmPassword !== 'string' ||
            typeof education !== 'string' || typeof degree !== 'string' ||
            typeof targetJob !== 'string' || typeof location !== 'string') {
            return res.status(400).json({ error: 'All fields must contain text values.' });
        }

        /* ---------- PASSWORD LENGTH ---------- */

        if (password.length < 6 || password.length > 1024) {
            return res.status(400).json({ error: 'Password must be between 6 and 1024 characters.' });
        }



        /* ---------- PASSWORD MATCH ---------- */

        if (password !== confirmPassword) {

            return res.status(400).json({
                error:
                    'Passwords do not match.'
            });

        }


        /* ---------- CLEAN AND VALIDATE VALUES ---------- */

        if ([fullName, email, education, degree, targetJob, location].some((value) => typeof value !== 'string')) {
            return res.status(400).json({ error: 'All profile fields must be text.' });
        }

        const cleanFullName = fullName.trim().slice(0, 120);
        const cleanEmail = email.toLowerCase().trim();
        if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: 'Enter a valid email address.' });
        }
        if (cleanFullName.length < 2 || cleanFullName.length > 120) {
            return res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
        }

        const cleanEducation = education.trim().slice(0, 160);
        const cleanDegree = degree.trim().slice(0, 160);
        const cleanTargetJob = targetJob.trim().slice(0, 160);
        const cleanLocation = location.trim().slice(0, 160);


        /* ---------- CHECK DUPLICATE EMAIL ---------- */

        const existing =
            db.prepare(
                'SELECT id FROM users WHERE email = ?'
            ).get(cleanEmail);


        if (existing) {

            return res.status(409).json({
                error:
                    'An account with that email already exists.'
            });

        }


        /* ---------- HASH PASSWORD ---------- */

        const passwordHash =
            bcrypt.hashSync(
                password,
                10
            );


        /* ---------- INSERT USER ---------- */

        const info =
            db.prepare(`
                INSERT INTO users (
                    full_name,
                    email,
                    password_hash,
                    education,
                    degree,
                    target_job,
                    location
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                cleanFullName,
                cleanEmail,
                passwordHash,
                cleanEducation,
                cleanDegree,
                cleanTargetJob,
                cleanLocation
            );


        /* Regenerate the session ID after registration to prevent fixation. */
        establishSession(req, info.lastInsertRowid, 1000 * 60 * 60 * 24, (sessionError) => {
            if (sessionError) {
                console.error('[register] session error:', sessionError);
                return res.status(500).json({ error: 'Account created, but sign-in failed. Please log in.' });
            }

            res.json({ success: true, userId: info.lastInsertRowid, fullName: cleanFullName, role: 'candidate' });
        });


    } catch (err) {

        console.error(
            '[register] error:',
            err
        );


        res.status(500).json({
            error:
                'Something went wrong while creating your account.'
        });

    }

});


/* =========================================================
   LOGIN
   ========================================================= */

router.post('/login', authRateLimit, (req, res) => {

    try {

        const {
            email,
            password,
            rememberMe
        } = req.body || {};


        /* ---------- REQUIRED FIELDS ---------- */

        if (!email || !password) {

            return res.status(400).json({
                error:
                    'Email and password are required.'
            });

        }


        if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024) {
            return res.status(400).json({ error: 'Enter a valid email and password.' });
        }

        /* ---------- FIND USER ---------- */

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());


        if (!user) {

            return res.status(401).json({
                error:
                    'Invalid email or password.'
            });

        }

        if (user.role === 'employer') {

            return res.status(403).json({
                error:
                    'This is an employer account. Please use the Employer Area to log in.'
            });

        }


        /* ---------- CHECK PASSWORD ---------- */

        const valid =
            bcrypt.compareSync(
                password,
                user.password_hash
            );


        if (!valid) {

            return res.status(401).json({
                error:
                    'Invalid email or password.'
            });

        }


        const maxAge = rememberMe
            ? 1000 * 60 * 60 * 24 * 30
            : 1000 * 60 * 60 * 24;

        establishSession(req, user.id, maxAge, (sessionError) => {
            if (sessionError) {
                console.error('[login] session error:', sessionError);
                return res.status(500).json({ error: 'Login succeeded, but the session could not be saved. Please try again.' });
            }

            res.json({ success: true, userId: user.id, fullName: user.full_name, role: user.role || 'candidate' });
        });


    } catch (err) {

        console.error(
            '[login] error:',
            err
        );


        res.status(500).json({
            error:
                'Something went wrong while logging in.'
        });

    }

});


/* =========================================================
   LOGOUT
   ========================================================= */

router.post('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error('[logout] session destruction failed:', error);
            return res.status(500).json({ error: 'Could not log out. Please try again.' });
        }

        res.clearCookie('jobpath.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });
        return res.json({ success: true });
    });
});


/* =========================================================
   CURRENT USER
   ========================================================= */

router.get('/me', (req, res) => {

    if (!req.session.userId) {

        return res.status(401).json({
            error:
                'Not logged in.'
        });

    }


    const user =
        db.prepare(`
            SELECT
                id,
                full_name,
                email,
                education,
                degree,
                target_job,
                location,
                role
            FROM users
            WHERE id = ?
        `).get(
            req.session.userId
        );


    if (!user) {

        return res.status(401).json({
            error:
                'Not logged in.'
        });

    }


    res.json({
        user
    });

});


/* =========================================================
   CANDIDATE APPLICATION HISTORY
   ========================================================= */

router.get('/applications', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not logged in.' });
        }

        const user = db.prepare(
            'SELECT role FROM users WHERE id = ?'
        ).get(req.session.userId);

        if (!user || user.role !== 'candidate') {
            return res.status(403).json({
                error: 'Only candidate accounts can view applications.'
            });
        }

        const applications = db.prepare(
            'SELECT a.id, a.status, a.applied_at, a.updated_at, j.id AS job_id, j.title AS job_title, j.company, j.location, j.employment_type, j.salary FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? ORDER BY datetime(a.applied_at) DESC, a.id DESC'
        ).all(req.session.userId);

        const historyQuery = db.prepare(
            'SELECT status, changed_at FROM application_history WHERE application_id = ? ORDER BY datetime(changed_at) ASC, id ASC'
        );
        applications.forEach((application) => {
            application.history = historyQuery.all(application.id);
        });

        res.json({ success: true, applications });
    } catch (err) {
        console.error('[GET /api/auth/applications] error:', err);
        res.status(500).json({ error: 'Failed to load application history.' });
    }
});


/* =========================================================
   GET ALL SKILLS
   ========================================================= */

/*
    Used by the Profile page/modal.

    We get the skills directly from the existing
    skills table instead of creating another skill list.
*/

router.get('/skills', (req, res) => {

    try {

        const skills =
            db.prepare(`
                SELECT
                    id,
                    name,
                    category
                FROM skills
                ORDER BY category ASC, name ASC
            `).all();


        res.json({
            success: true,
            skills
        });


    } catch (err) {

        console.error(
            '[GET /api/auth/skills] error:',
            err
        );


        res.status(500).json({
            error:
                'Failed to load skills.'
        });

    }

});


/* =========================================================
   GET PROFILE
   ========================================================= */

router.get('/profile', (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                error:
                    'Not logged in.'
            });

        }


        /* ---------- USER INFORMATION ---------- */

        const user =
            db.prepare(`
                SELECT
                    id,
                    full_name,
                    email,
                    education,
                    degree,
                    target_job,
                    location,
                    role
                FROM users
                WHERE id = ?
            `).get(
                req.session.userId
            );


        if (!user) {

            return res.status(401).json({
                error:
                    'Not logged in.'
            });

        }

        if (user.role !== 'candidate') {
            return res.status(403).json({
                error: 'Only candidate accounts can access the candidate profile.'
            });
        }


        /* ---------- USER SKILLS ---------- */

        const skills =
            db.prepare(`
                SELECT
                    s.id,
                    s.name,
                    s.category,
                    us.source
                FROM user_skills us
                JOIN skills s
                    ON s.id = us.skill_id
                WHERE us.user_id = ?
                ORDER BY s.category ASC, s.name ASC
            `).all(
                req.session.userId
            );


        /* ---------- RESPONSE ---------- */

        res.json({

            success: true,

            profile: {
                ...user,
                skills
            }

        });


    } catch (err) {

        console.error(
            '[GET /api/auth/profile] error:',
            err
        );


        res.status(500).json({
            error:
                'Failed to load profile.'
        });

    }

});


/* =========================================================
   UPDATE PROFILE FROM RESUME BUILDER
   ========================================================= */

router.put('/profile', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not logged in.' });
        }

        const currentUser = db.prepare(
            'SELECT role FROM users WHERE id = ?'
        ).get(req.session.userId);

        if (!currentUser || currentUser.role !== 'candidate') {
            return res.status(403).json({ error: 'Only candidate accounts can update the candidate profile.' });
        }

        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ error: 'Profile data must be an object.' });
        }

        const fields = [
            ['full_name', 120],
            ['education', 160],
            ['degree', 160],
            ['location', 160],
            ['target_job', 160]
        ];

        for (const [field, maxLength] of fields) {
            if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
                return res.status(400).json({ error: 'Profile fields must contain text values.' });
            }
            if (typeof body[field] === 'string' && body[field].trim().length > maxLength) {
                return res.status(400).json({ error: field.replace(/_/g, ' ') + ' must be ' + maxLength + ' characters or fewer.' });
            }
        }

        const fullName = (body.full_name || '').trim();
        const education = (body.education || '').trim();
        const degree = (body.degree || '').trim();
        const location = (body.location || '').trim();
        const targetJob = (body.target_job || '').trim();

        if (fullName.length < 2) {
            return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
        }

        db.prepare(`
            UPDATE users
            SET full_name = ?,
                education = ?,
                degree = ?,
                location = ?,
                target_job = ?
            WHERE id = ?
        `).run(
            fullName,
            education || null,
            degree || null,
            location || null,
            targetJob || null,
            req.session.userId
        );

        const profile = db.prepare(`
            SELECT id, full_name, email, education, degree, target_job, location
            FROM users
            WHERE id = ?
        `).get(req.session.userId);

        if (!profile) {
            return res.status(401).json({ error: 'Not logged in.' });
        }

        res.json({ success: true, profile });
    } catch (err) {
        console.error('[PUT /api/auth/profile] error:', err);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});


/* =========================================================
   SAVE PROFILE SKILLS
   ========================================================= */

router.put('/profile/skills', (req, res) => {

    try {

        if (!req.session.userId) {

            return res.status(401).json({
                error:
                    'Not logged in.'
            });

        }

        const currentUser = db.prepare(
            'SELECT role FROM users WHERE id = ?'
        ).get(req.session.userId);

        if (!currentUser || currentUser.role !== 'candidate') {
            return res.status(403).json({
                error: 'Only candidate accounts can edit profile skills.'
            });
        }


        const skillIds = req.body?.skillIds;
        const rawSkillNames = req.body?.skillNames;


        /* ---------- VALIDATE INPUT ---------- */

        if (!Array.isArray(skillIds) || (rawSkillNames !== undefined && !Array.isArray(rawSkillNames))) {

            return res.status(400).json({
                error:
                    'skillIds must be an array.'
            });

        }


        const cleanedSkillNames = [...new Map(
            (Array.isArray(rawSkillNames) ? rawSkillNames : [])
                .map((value) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 80))
                .filter((name) => name.length > 0)
                .map((name) => [name.toLowerCase(), name])
        ).values()].slice(0, 100);

        /* ---------- CLEAN SKILL IDS ---------- */

        const cleanedSkillIds =
            [
                ...new Set(
                    skillIds
                        .map(
                            (id) => Number(id)
                        )
                        .filter(
                            (id) =>
                                Number.isInteger(id) &&
                                id > 0
                        )
                )
            ];


        /* ---------- VERIFY SKILLS EXIST ---------- */

        const validSkills =
            cleanedSkillIds.length
                ? db.prepare(`
                    SELECT id
                    FROM skills
                    WHERE id IN (
                        ${cleanedSkillIds
                            .map(() => '?')
                            .join(', ')}
                    )
                `).all(
                    ...cleanedSkillIds
                )
                : [];


        const validSkillIds =
            new Set(
                validSkills.map(
                    (skill) => skill.id
                )
            );


        /* =================================================
           TRANSACTION

           Replace the user's current manual skills with
           the newly selected skills.
           ================================================= */

        const transaction =
            db.transaction(() => {

                /* ---------- REMOVE OLD SKILLS ---------- */

                db.prepare(`
                    DELETE FROM user_skills
                    WHERE user_id = ?
                      AND source = 'manual'
                `).run(
                    req.session.userId
                );


                /* ---------- CREATE USER-ENTERED SKILLS ---------- */
                const findSkill = db.prepare('SELECT id FROM skills WHERE name = ? COLLATE NOCASE LIMIT 1');
                const createSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)');
                for (const name of cleanedSkillNames) {
                    let existing = findSkill.get(name);
                    if (!existing) {
                        createSkill.run(name, 'Custom');
                        existing = findSkill.get(name);
                    }
                    if (existing) validSkillIds.add(Number(existing.id));
                }

                /* ---------- INSERT NEW SKILLS ---------- */

                const insert =
                    db.prepare(`
                        INSERT OR IGNORE INTO user_skills (
                            user_id,
                            skill_id,
                            source
                        )
                        VALUES (?, ?, 'manual')
                    `);


                for (const skillId of validSkillIds) {

                    insert.run(
                        req.session.userId,
                        skillId
                    );

                }

            });


        transaction();


        /* ---------- RETURN SAVED SKILLS ---------- */

        const savedSkills =
            db.prepare(`
                SELECT
                    s.id,
                    s.name,
                    s.category,
                    us.source
                FROM user_skills us
                JOIN skills s
                    ON s.id = us.skill_id
                WHERE us.user_id = ?
                ORDER BY s.category ASC, s.name ASC
            `).all(
                req.session.userId
            );


        res.json({

            success: true,

            skills:
                savedSkills

        });


    } catch (err) {

        console.error(
            '[PUT /api/auth/profile/skills] error:',
            err
        );


        res.status(500).json({
            error:
                'Failed to save profile skills.'
        });

    }

});


/* =========================================================
   APPLICATION DETAILS
   ========================================================= */

router.get('/applications/:id', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not logged in.' });
        }

        const applicationId = Number(req.params.id);
        if (!Number.isInteger(applicationId) || applicationId <= 0) {
            return res.status(400).json({ error: 'Invalid application id.' });
        }

        const application = db.prepare(
            'SELECT a.id, a.status, a.applied_at, a.updated_at, j.id AS job_id, j.title AS job_title, j.company, j.location, j.employment_type, j.salary, j.description FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND a.user_id = ?'
        ).get(applicationId, req.session.userId);

        if (!application) {
            return res.status(404).json({ error: 'Application not found.' });
        }

        const requiredSkills = db.prepare(
            'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ? ORDER BY s.name ASC'
        ).all(application.job_id).map((row) => row.name);

        const userSkills = db.prepare(`
            SELECT DISTINCT s.name
            FROM skills s
            WHERE s.id IN (
                SELECT us.skill_id
                FROM user_skills us
                WHERE us.user_id = ?
                UNION
                SELECT lp.skill_id
                FROM learning_progress lp
                WHERE lp.user_id = ?
                  AND lp.status = 'verified'
            )
        `).all(req.session.userId, req.session.userId).map((row) => row.name);

        const userSkillSet = new Set(userSkills.map((skill) => skill.toLowerCase()));
        const matchingSkills = requiredSkills.filter((skill) => userSkillSet.has(skill.toLowerCase()));
        const missingSkills = requiredSkills.filter((skill) => !userSkillSet.has(skill.toLowerCase()));
        const matchScore = requiredSkills.length
            ? Math.round((matchingSkills.length / requiredSkills.length) * 100)
            : 0;

        const history = db.prepare(
            'SELECT status, changed_at FROM application_history WHERE application_id = ? ORDER BY datetime(changed_at) ASC, id ASC'
        ).all(applicationId);

        res.json({
            success: true,
            application,
            requiredSkills,
            matchingSkills,
            missingSkills,
            matchScore,
            history
        });
    } catch (err) {
        console.error('[GET /api/auth/applications/:id] error:', err);
        res.status(500).json({ error: 'Failed to load application details.' });
    }
});


module.exports = router;