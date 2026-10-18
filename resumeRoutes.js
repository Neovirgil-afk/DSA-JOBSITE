
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('./database');
const { requireAuth } = require('./auth');
const { scanResume } = require('./ResumeScanner');
const { SKILLS_LIST } = require('./skillsList');

const router = express.Router();

// Resume drafts, uploaded-file metadata, and scan results contain private data.
router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('Pragma', 'no-cache');
    next();
});

function requireCandidate(req, res, next) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user || user.role !== 'candidate') {
        return res.status(403).json({ error: 'Only candidate accounts can use resume tools.' });
    }
    next();
}

// Set JOBPATH_UPLOAD_DIR to a persistent-disk directory in production
// (for example, /var/data/uploads on a mounted Render disk).
const UPLOAD_DIR = process.env.JOBPATH_UPLOAD_DIR
    ? path.resolve(process.env.JOBPATH_UPLOAD_DIR)
    : path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
            return cb(new Error('Only PDF and DOCX files are allowed.'));
        }
        cb(null, true);
    },
});

function hasValidResumeSignature(filePath, originalName) {
    const extension = path.extname(String(originalName || '')).toLowerCase();
    const descriptor = fs.openSync(filePath, 'r');
    try {
        const header = Buffer.alloc(8);
        const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
        if (extension === '.pdf') {
            return bytesRead >= 5 && header.subarray(0, 5).toString('ascii') === '%PDF-';
        }
        if (extension === '.docx') {
            // DOCX is a ZIP-based Office Open XML package.
            return bytesRead >= 4 &&
                header[0] === 0x50 && header[1] === 0x4b &&
                header[2] === 0x03 && header[3] === 0x04;
        }
        return false;
    } finally {
        fs.closeSync(descriptor);
    }
}

function handleUploadErrors(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
}

// Keep the database skill table in sync when the skill dictionary grows.
// This matters for existing databases because seed.js intentionally skips
// reseeding once jobs already exist.
function ensureSkillDictionaryInDatabase() {
    const insertSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)');

    const syncSkills = db.transaction(() => {
        for (const skill of SKILLS_LIST) {
            insertSkill.run(skill.name, skill.category);
        }
    });

    syncSkills();
}

router.get('/builder', requireAuth, requireCandidate, (req, res) => {
    try {
        const row = db.prepare(`
            SELECT resume_data, updated_at
            FROM resume_builder
            WHERE user_id = ?
        `).get(req.session.userId);

        res.json({
            resume: row
                ? {
                    ...JSON.parse(row.resume_data),
                    updatedAt: row.updated_at
                }
                : null
        });
    } catch (error) {
        console.error('[resume/builder GET] error:', error);
        res.status(500).json({ error: 'Failed to load resume draft.' });
    }
});

function cleanText(value, maxLength) {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value).trim().slice(0, maxLength);
}

router.put('/builder', requireAuth, requireCandidate, (req, res) => {
    try {
        const data = req.body?.resume;

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return res.status(400).json({
                error: 'Resume data is required.'
            });
        }

        const clean = {
            fullName: cleanText(data.fullName, 120),
            email: cleanText(data.email, 254),
            phone: cleanText(data.phone, 40),
            location: cleanText(data.location, 160),
            summary: cleanText(data.summary, 3000),
            education: Array.isArray(data.education)
                ? data.education
                    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
                    .slice(0, 8)
                    .map((item) => ({
                    school: cleanText(item.school, 180),
                    degree: cleanText(item.degree, 180),
                    year: cleanText(item.year, 30)
                }))
                : [],
            experience: Array.isArray(data.experience)
                ? data.experience
                    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
                    .slice(0, 8)
                    .map((item) => ({
                    title: cleanText(item.title, 180),
                    company: cleanText(item.company, 180),
                    duration: cleanText(item.duration, 100),
                    description: cleanText(item.description, 2000)
                }))
                : [],
            projects: Array.isArray(data.projects)
                ? data.projects
                    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
                    .slice(0, 8)
                    .map((item) => ({
                    name: cleanText(item.name, 180),
                    description: cleanText(item.description, 2000)
                }))
                : [],
            certifications: Array.isArray(data.certifications)
                ? data.certifications
                    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
                    .slice(0, 8)
                    .map((item) => ({
                    name: cleanText(item.name, 180),
                    issuer: cleanText(item.issuer, 180),
                    year: cleanText(item.year, 30)
                }))
                : []
        };

        if (clean.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(clean.email)) {
            return res.status(400).json({ error: 'Enter a valid email address for the resume.' });
        }

        const json = JSON.stringify(clean);

        const saveResume = db.transaction(() => {
            db.prepare(`
                INSERT INTO resume_builder (user_id, resume_data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    resume_data = excluded.resume_data,
                    updated_at = CURRENT_TIMESTAMP
            `).run(req.session.userId, json);

            db.prepare(`
                UPDATE users
                SET full_name = ?,
                    location = ?,
                    education = ?,
                    degree = ?
                WHERE id = ?
            `).run(
                clean.fullName || null,
                clean.location || null,
                clean.education[0]?.school || null,
                clean.education[0]?.degree || null,
                req.session.userId
            );
        });

        saveResume();

        res.json({
            success: true,
            resume: clean
        });
    } catch (error) {
        console.error('[resume/builder PUT] error:', error);
        res.status(500).json({ error: 'Failed to save resume draft.' });
    }
});

router.get('/current', requireAuth, requireCandidate, (req, res) => {
    try {
        const resume = db.prepare(`
            SELECT original_name, stored_name, uploaded_at
            FROM user_resumes
            WHERE user_id = ?
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1
        `).get(req.session.userId);

        res.json({ resume: resume || null });
    } catch (error) {
        console.error('[resume/current] error:', error);
        res.status(500).json({ error: 'Failed to load resume status.' });
    }
});

// Serve the candidate's current resume through an authenticated endpoint.
router.get('/file', requireAuth, requireCandidate, (req, res) => {
    try {
        const resume = db.prepare(`
            SELECT original_name, stored_name
            FROM user_resumes
            WHERE user_id = ?
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1
        `).get(req.session.userId);

        if (!resume) {
            return res.status(404).json({ error: 'No resume uploaded.' });
        }

        const filePath = path.join(UPLOAD_DIR, path.basename(resume.stored_name));

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Resume file not found.' });
        }

        const safeFilename = path.basename(String(resume.original_name || 'resume.pdf'))
            .replace(/[\r\n"]/g, '')
            .slice(0, 180) || 'resume.pdf';

        res.sendFile(filePath, {
            headers: {
                'Content-Disposition': `inline; filename="${safeFilename}"`,
                'Cache-Control': 'private, no-store, max-age=0',
                'Pragma': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            }
        });
    } catch (error) {
        console.error('[resume/file] error:', error);
        res.status(500).json({ error: 'Failed to open resume.' });
    }
});

// Upload + scan + auto-save detected skills to the logged-in user's profile.
router.post('/scan', requireAuth, requireCandidate, (req, res) => {
    upload.single('resume')(req, res, async (err) => {
        if (err) return handleUploadErrors(err, req, res, () => {});

        try {
            if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });

            if (!hasValidResumeSignature(req.file.path, req.file.originalname)) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    error: 'The file content does not match a valid PDF or DOCX resume.'
                });
            }

            const result = await scanResume(req.file.path, req.file.originalname);

            const persistScan = db.transaction(() => {
                db.prepare(`
                    INSERT INTO user_resumes (user_id, original_name, stored_name)
                    VALUES (?, ?, ?)
                `).run(
                    req.session.userId,
                    path.basename(String(req.file.originalname || 'resume.pdf'))
                        .replace(/[\r\n"]/g, '')
                        .slice(0, 180) || 'resume.pdf',
                    path.basename(req.file.path)
                );

                // Make sure newly added skills exist even when using an older database.
                ensureSkillDictionaryInDatabase();

                // Replace previous resume-derived skills only when the new scan
                // actually detected skills. An unreadable/low-text resume should
                // not silently erase skills from the previous successful scan.
                const detectedSkills = Array.isArray(result.detectedSkills)
                    ? [...new Set(
                        result.detectedSkills
                            .map((skill) => String(skill ?? '').trim())
                            .filter(Boolean)
                    )]
                    : [];

                const insertDetectedSkill = db.prepare(
                    'INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)'
                );
                for (const skillName of detectedSkills) {
                    insertDetectedSkill.run(skillName, 'ESCO Skill');
                }

                const getSkillId = db.prepare(
                    'SELECT id, name FROM skills WHERE name = ? COLLATE NOCASE LIMIT 1'
                );
                const insertUserSkill = db.prepare(
                    'INSERT OR IGNORE INTO user_skills (user_id, skill_id, source) VALUES (?, ?, ?)'
                );

                const savedSkills = [];

                if (detectedSkills.length > 0) {
                    db.prepare(
                        "DELETE FROM user_skills WHERE user_id = ? AND source = 'resume'"
                    ).run(req.session.userId);

                    for (const skillName of detectedSkills) {
                        const skillRow = getSkillId.get(skillName);
                        if (skillRow) {
                            insertUserSkill.run(req.session.userId, skillRow.id, 'resume');
                            savedSkills.push(skillRow.name);
                        }
                    }
                } else {
                    const existingSkills = db.prepare(
                        "SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = ? AND us.source = 'resume' ORDER BY s.name COLLATE NOCASE ASC"
                    ).all(req.session.userId);

                    savedSkills.push(...existingSkills.map((skill) => skill.name));
                }

                // Update profile fields if they were empty and we found something useful.
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
                if (!user.degree && result.degree) {
                    db.prepare('UPDATE users SET degree = COALESCE(?, degree) WHERE id = ?')
                        .run(result.degree, req.session.userId);
                }

                return savedSkills;
            });

            const savedSkills = persistScan();
            res.json({
                success: true,
                extracted: {
                    name: result.name,
                    email: result.email,
                    degree: result.degree,
                },
                detectedSkills: savedSkills,
                warning: result.warning,
                ocrUsed: result.ocrUsed || false,
                ocrPagesScanned: result.ocrPagesScanned || 0,
                ocrTotalPages: result.ocrTotalPages || 0,
            });
        } catch (error) {
            // The file is not stored in user_resumes until scanning succeeds.
            // Remove failed uploads so invalid/corrupt files do not accumulate
            // in the server's upload directory.
            if (req.file?.path) {
                try {
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupError) {
                    console.error('[resume/scan] upload cleanup failed:', cleanupError);
                }
            }

            console.error('[resume/scan] error:', error);
            res.status(500).json({ error: 'Failed to scan resume. Please check the file and try again.' });
        }
    });
});

module.exports = router;
