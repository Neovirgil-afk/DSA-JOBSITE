
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('./database');
const { requireAuth } = require('./auth');
const { scanResume } = require('./ResumeScanner');
const { SKILLS_LIST } = require('./skillsList');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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

router.get('/current', requireAuth, (req, res) => {
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

// Upload + scan + auto-save detected skills to the logged-in user's profile.
router.post('/scan', requireAuth, (req, res) => {
    upload.single('resume')(req, res, async (err) => {
        if (err) return handleUploadErrors(err, req, res, () => {});

        try {
            if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });

            const result = await scanResume(req.file.path, req.file.originalname);

            db.prepare(`
                INSERT INTO user_resumes (user_id, original_name, stored_name)
                VALUES (?, ?, ?)
            `).run(
                req.session.userId,
                req.file.originalname,
                path.basename(req.file.path)
            );

            // Make sure newly added skills exist even when using an older database.
            ensureSkillDictionaryInDatabase();

            // Save detected skills into user_skills with source='resume'
            const getSkillId = db.prepare('SELECT id FROM skills WHERE name = ?');
            const insertUserSkill = db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, source) VALUES (?, ?, ?)');

            const savedSkills = [];
            for (const skillName of result.detectedSkills) {
                const skillRow = getSkillId.get(skillName);
                if (skillRow) {
                    insertUserSkill.run(req.session.userId, skillRow.id, 'resume');
                    savedSkills.push(skillName);
                }
            }

            // Update profile fields if they were empty and we found something useful.
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
            const updates = {};
            if (!user.degree && result.degree) updates.degree = result.degree;
            if (Object.keys(updates).length > 0) {
                db.prepare('UPDATE users SET degree = COALESCE(?, degree) WHERE id = ?')
                    .run(updates.degree || null, req.session.userId);
            }

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
            console.error('[resume/scan] error:', error);
            res.status(500).json({ error: 'Failed to scan resume. ' + error.message });
        }
    });
});

module.exports = router;
