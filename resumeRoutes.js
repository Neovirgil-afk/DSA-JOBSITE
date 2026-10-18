
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

        if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
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

        // This endpoint is intentionally embeddable only by this same site,
        // so the Profile page can show the user's resume in its preview modal.
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');

        res.sendFile(filePath, {
            headers: {
                'Content-Disposition': `inline; filename="${safeFilename}"`,
                'Cache-Control': 'private, no-store, max-age=0',
                'Pragma': 'no-cache',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'SAMEORIGIN'
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

const CAREER_PROFILES = [{"title":"Administrative Assistant","field":"Administration & Operations","terms":["administrative","office management","scheduling","calendar","filing","documentation","data entry","records","coordination","clerical"],"why":"Organization, documentation, coordination, or office support appear relevant."},{"title":"Accounting Assistant","field":"Accounting & Finance","terms":["accounting","bookkeeping","accounts payable","accounts receivable","reconciliation","financial statements","tax","audit","payroll","ledger","budget","finance"],"why":"Financial records, numerical accuracy, budgeting, or accounting appear relevant."},{"title":"Business Analyst","field":"Business & Strategy","terms":["business analysis","requirements","process improvement","stakeholder","business process","reporting","kpi","workflow","market research","strategy"],"why":"Analysis, process improvement, or business decision support appear relevant."},{"title":"Sales Representative","field":"Sales & Customer Relations","terms":["sales","revenue","lead generation","negotiation","account management","client acquisition","sales target","customer relations","crm"],"why":"Client interaction, persuasion, relationship building, or target-driven work appear relevant."},{"title":"Customer Service Representative","field":"Customer Experience","terms":["customer service","customer support","call center","complaint resolution","customer satisfaction","communication","service desk","help desk"],"why":"Communication and customer problem-solving appear relevant."},{"title":"Marketing Coordinator","field":"Marketing & Communications","terms":["marketing","campaign","brand","market research","seo","social media","content marketing","advertising","email marketing","analytics","promotion"],"why":"Promotion, audience research, content, or campaign work appear relevant."},{"title":"Content Writer / Editor","field":"Writing & Communications","terms":["writing","copywriting","editing","proofreading","articles","blog","technical writing","documentation","content creation","journalism","research paper"],"why":"Writing, research, editing, or content development appear relevant."},{"title":"Graphic Designer","field":"Creative & Design","terms":["graphic design","visual design","illustration","typography","branding","photoshop","illustrator","figma","layout","creative portfolio"],"why":"Visual communication, design tools, or creative projects appear relevant."},{"title":"Human Resources Assistant","field":"People & Human Resources","terms":["human resources","recruitment","recruiting","onboarding","employee relations","talent acquisition","interview scheduling","training","personnel"],"why":"Recruitment, training, employee support, or people coordination appear relevant."},{"title":"Teacher / Learning Facilitator","field":"Education & Training","terms":["teaching","teacher","lesson plan","classroom","tutoring","education","training","facilitation","curriculum","student assessment","instruction"],"why":"Teaching, mentoring, explaining concepts, or learning support appear relevant."},{"title":"Research Assistant","field":"Research & Academia","terms":["research","literature review","data collection","survey","experiment","academic","thesis","laboratory","analysis","research assistant","publication"],"why":"Research, investigation, data collection, or academic projects appear relevant."},{"title":"Data Analyst","field":"Data & Analytics","terms":["data analysis","excel","spreadsheets","sql","statistics","dashboard","power bi","tableau","visualization","python","reporting","quantitative"],"why":"Data, spreadsheets, metrics, reports, or analytical tools appear relevant."},{"title":"Software / Web Developer","field":"Technology","terms":["javascript","python","java","software development","web development","html","css","api","database","programming","git","application development"],"why":"Coding, software projects, or application-building experience appear relevant."},{"title":"IT Support Specialist","field":"Technology & IT Support","terms":["technical support","troubleshooting","computer hardware","networking","windows","linux","system administration","ticketing","it support","cybersecurity"],"why":"Technology troubleshooting, systems, hardware, or user support appear relevant."},{"title":"Healthcare Administration Assistant","field":"Healthcare Operations","terms":["healthcare","hospital","clinic","medical records","patient records","health information","appointment scheduling","medical billing","health administration"],"why":"Records, coordination, or administrative experience may transfer to healthcare."},{"title":"Patient Care Support","field":"Healthcare & Community Care","terms":["nursing","patient care","clinical","caregiving","first aid","vital signs","medical assistant","elderly care","health sciences","patient safety"],"why":"Care or clinical training may be relevant; some roles require professional licensing."},{"title":"Logistics Coordinator","field":"Logistics & Supply Chain","terms":["logistics","inventory","warehouse","supply chain","procurement","shipping","dispatch","distribution","stock control","delivery","fleet"],"why":"Stock, shipments, suppliers, schedules, or operational flow appear relevant."},{"title":"Project Coordinator","field":"Project & Operations Management","terms":["project management","project coordinator","timeline","milestone","budget tracking","team coordination","agile","scrum","deliverables","planning","implementation"],"why":"Planning, team coordination, deadlines, or project delivery appear relevant."},{"title":"Hospitality Associate","field":"Hospitality & Tourism","terms":["hospitality","hotel","tourism","front desk","guest relations","reservation","food service","restaurant","event coordination","travel","guest experience"],"why":"Service, guest relations, scheduling, or hospitality experience appear relevant."},{"title":"Food Service Associate","field":"Food Service","terms":["culinary","cooking","food preparation","kitchen","food safety","food handling","baking","restaurant operations","menu","catering"],"why":"Food preparation, kitchen, catering, or food-safety experience appear relevant."},{"title":"Civil Engineering Technician","field":"Engineering & Construction","terms":["civil engineering","construction","autocad","technical drawing","blueprint","surveying","structural","quantity surveying","site inspection","building","cad"],"why":"Technical drawing, construction, engineering coursework, or site experience appear relevant."},{"title":"Electrical Technician","field":"Skilled Trades & Engineering","terms":["electrical","electrician","wiring","circuit","electronics","maintenance","electrical installation","troubleshooting","instrumentation","safety standards"],"why":"Electrical, electronics, maintenance, or hands-on technical training appear relevant."},{"title":"Community Outreach Associate","field":"Community & Public Service","terms":["community outreach","volunteer","nonprofit","ngo","public service","social work","advocacy","community development","case management","youth program"],"why":"Community involvement, service, advocacy, or people-support programs appear relevant."},{"title":"Laboratory / Environmental Assistant","field":"Science & Environment","terms":["environmental science","biology","chemistry","laboratory","lab assistant","sample testing","quality control","sustainability","field work","microbiology"],"why":"Scientific coursework, lab practice, testing, or environmental work appear relevant."},{"title":"Quality Assurance Associate","field":"Quality & Compliance","terms":["quality assurance","quality control","inspection","compliance","standard operating procedure","sop","testing","defect tracking","documentation","iso"],"why":"Accuracy, testing, standards, or process consistency appear relevant."},{"title":"Retail Associate","field":"Retail & Merchandising","terms":["retail","merchandising","point of sale","pos","cash handling","store operations","sales associate","customer transactions","stock replenishment"],"why":"Customer service, transactions, product handling, or store operations appear relevant."},{"title":"Financial Services Associate","field":"Banking & Financial Services","terms":["banking","financial services","loans","credit","risk assessment","insurance","investment","financial planning","client portfolio"],"why":"Numerical, client-service, finance, or risk-related experience appear relevant."},{"title":"Event Coordinator","field":"Events & Creative Operations","terms":["event planning","events","conference","production coordination","vendor management","venue","program schedule","sponsorship","live event"],"why":"Coordinating people, schedules, logistics, or creative events appear relevant."},{"title":"Social Media Coordinator","field":"Digital Media & Communications","terms":["social media","content calendar","community management","instagram","tiktok","facebook","engagement","short-form video","content strategy"],"why":"Digital communication, content planning, audience engagement, or media work appear relevant."}];
function recommendCareersFromResume(resumeText) {
 const text=String(resumeText||'').toLowerCase().split(/\s+/).join(' ').slice(0,120000);
 if(text.trim().length<40)return [];
 const searchable=' '+text+' ';
 const found=CAREER_PROFILES.map(p=>{
  const evidence=p.terms.filter(term=>searchable.includes(' '+term.toLowerCase()+' '));
  return {...p,evidence:evidence.slice(0,4),rawScore:evidence.reduce((n,t)=>n+(t.includes(' ')?2:1),0)};
 }).filter(p=>p.rawScore>0).sort((a,b)=>b.rawScore-a.rawScore);
 const output=[],fields=new Set();
 for(const p of found){
  if(fields.has(p.field))continue;
  fields.add(p.field);
  output.push({...p,confidence:p.rawScore>=6?'Strong resume signal':p.rawScore>=3?'Some resume evidence':'Possible direction'});
  if(output.length>=8)break;
 }
 return output;
}

router.post('/analyze', requireAuth, requireCandidate, (req, res) => {
 upload.single('resume')(req,res,async(err)=>{
  if(err)return handleUploadErrors(err,req,res,()=>{});
  try {
   if(!req.file)return res.status(400).json({error:'No file was uploaded.'});
   if(!hasValidResumeSignature(req.file.path,req.file.originalname)){fs.unlinkSync(req.file.path);return res.status(400).json({error:'The file content does not match a valid PDF or DOCX resume.'});}
   const result=await scanResume(req.file.path,req.file.originalname,{detectSkills:false});
   if(!result.resumeText||result.resumeText.trim().length<40)return res.status(422).json({error:result.warning||'We could not read enough text from this resume. Try a text-based PDF or DOCX file.'});
   res.json({success:true,extracted:{name:result.name,email:result.email,degree:result.degree},recommendedCareers:recommendCareersFromResume(result.resumeText),warning:result.warning,ocrUsed:result.ocrUsed||false,ocrPagesScanned:result.ocrPagesScanned||0,ocrTotalPages:result.ocrTotalPages||0});
  } catch(error){console.error('[resume/analyze] error:',error);res.status(500).json({error:'Unable to analyze this resume. Please check the file and try again.'});}
  finally {if(req.file?.path){try{if(fs.existsSync(req.file.path))fs.unlinkSync(req.file.path);}catch(e){console.error('[resume/analyze] cleanup failed:',e);}}}
 });
});

module.exports = router;
