const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('./database');

const router = express.Router();


/* =========================================================
   REGISTER
   ========================================================= */

router.post('/register', (req, res) => {

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
        } = req.body;


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


        /* ---------- PASSWORD LENGTH ---------- */

        if (password.length < 6) {

            return res.status(400).json({
                error:
                    'Password must be at least 6 characters.'
            });

        }


        /* ---------- PASSWORD MATCH ---------- */

        if (password !== confirmPassword) {

            return res.status(400).json({
                error:
                    'Passwords do not match.'
            });

        }


        /* ---------- CLEAN VALUES ---------- */

        const cleanFullName =
            fullName.trim();

        const cleanEmail =
            email.toLowerCase().trim();

        const cleanEducation =
            education.trim();

        const cleanDegree =
            degree.trim();

        const cleanTargetJob =
            targetJob.trim();

        const cleanLocation =
            location.trim();


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


        /* ---------- CREATE SESSION ---------- */

        req.session.userId =
            info.lastInsertRowid;


        /* ---------- RESPONSE ---------- */

        res.json({

            success: true,

            userId:
                info.lastInsertRowid,

            fullName:
                cleanFullName

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

router.post('/login', (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        /* ---------- REQUIRED FIELDS ---------- */

        if (!email || !password) {

            return res.status(400).json({
                error:
                    'Email and password are required.'
            });

        }


        /* ---------- FIND USER ---------- */

        const user =
            db.prepare(
                'SELECT * FROM users WHERE email = ?'
            ).get(
                email.toLowerCase().trim()
            );


        if (!user) {

            return res.status(401).json({
                error:
                    'Invalid email or password.'
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


        /* ---------- CREATE SESSION ---------- */

        req.session.userId =
            user.id;


        /* ---------- RESPONSE ---------- */

        res.json({

            success: true,

            userId:
                user.id,

            fullName:
                user.full_name

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

    req.session.destroy(() => {

        res.json({
            success: true
        });

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
                location
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


module.exports = router;