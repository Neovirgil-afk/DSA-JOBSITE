const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { execFile } = require('child_process');
const { promisify } = require('util');
const mammoth = require('mammoth');

// pdf-poppler only supports Windows. Render runs Linux, so use the
// system Poppler commands there instead of loading the Windows-only package.
const execFileAsync = promisify(execFile);
const pdfPoppler = process.platform === 'win32' ? require('pdf-poppler') : null;
const { createWorker } = require('tesseract.js');
const HashTable = require('./HashTable');
const { SKILLS_LIST } = require('./skillsList');
const { detectSkillsFromESCO } = require('./ESCOService');

const OCR_MAX_PAGES = 5;
const OCR_DENSITY = 180;

async function extractPdfText(filePath) {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });

    try {
        const result = await parser.getText();
        return result.text || '';
    } finally {
        await parser.destroy();
    }
}

async function extractTextFromFile(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.pdf') return extractPdfText(filePath);

    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
    }

    throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
}

// Render scanned PDF pages to PNG using Poppler, then send those images to Tesseract.
// pdf-poppler bundles its Poppler binaries for Windows, so this avoids the
// PDF.js compatibility problems we were getting from pdf-to-img.
async function getPdfPageCount(filePath) {
    if (pdfPoppler) {
        const info = await pdfPoppler.info(filePath);
        return Number(info?.pages) || 0;
    }

    const { stdout } = await execFileAsync('pdfinfo', [filePath]);
    const match = stdout.match(/^Pages:\s+(\d+)/mi);
    return match ? Number(match[1]) : 0;
}

async function renderPdfPage(filePath, pageNumber, outputPrefix) {
    if (pdfPoppler) {
        await pdfPoppler.convert(filePath, {
            format: 'png',
            out_dir: path.dirname(outputPrefix),
            out_prefix: path.basename(outputPrefix),
            page: pageNumber,
            density: OCR_DENSITY,
        });

        const renderedFiles = fs.readdirSync(path.dirname(outputPrefix))
            .filter((file) => file.toLowerCase().endsWith('.png'));

        if (renderedFiles.length === 0) {
            throw new Error(`Poppler did not produce an image for page ${pageNumber}.`);
        }

        return path.join(path.dirname(outputPrefix), renderedFiles[renderedFiles.length - 1]);
    }

    const outputFile = `${outputPrefix}-${pageNumber}.png`;

    await execFileAsync('pdftoppm', [
        '-png',
        '-r', String(OCR_DENSITY),
        '-f', String(pageNumber),
        '-l', String(pageNumber),
        '-singlefile',
        filePath,
        `${outputPrefix}-${pageNumber}`,
    ]);

    return outputFile;
}

// Render scanned PDF pages to PNG using Poppler, then send those images to Tesseract.
// Windows uses pdf-poppler; Linux (including Render) uses the system Poppler CLI.
async function ocrPdf(filePath) {
    const totalPages = await getPdfPageCount(filePath);
    const pagesToScan = Math.min(totalPages, OCR_MAX_PAGES);
    const pageTexts = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpath-ocr-'));
    const worker = await createWorker('eng');

    try {
        console.log(`[OCR] PDF has ${totalPages} page(s). Scanning ${pagesToScan}...`);

        for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber++) {
            console.log(`[OCR] Rendering page ${pageNumber}/${pagesToScan} with Poppler...`);

            const outputPrefix = path.join(tempDir, 'page');
            const imagePath = await renderPdfPage(filePath, pageNumber, outputPrefix);

            if (!fs.existsSync(imagePath)) {
                throw new Error(`Poppler did not produce an image for page ${pageNumber}.`);
            }

            const imageBuffer = fs.readFileSync(imagePath);
            console.log(`[OCR] Recognizing page ${pageNumber}...`);
            const result = await worker.recognize(imageBuffer);
            const pageText = result?.data?.text || '';

            pageTexts.push(pageText);
            console.log(`[OCR] Page ${pageNumber} complete (${pageText.length} characters).`);

            try {
                fs.unlinkSync(imagePath);
            } catch (_) {
                // Ignore cleanup errors; the temp directory is removed below.
            }
        }
    } finally {
        await worker.terminate();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return {
        text: pageTexts.join('\n\n'),
        pagesScanned: pageTexts.length,
        totalPages,
    };
}

function buildSkillLookupTable() {
    const table = new HashTable();
    for (const skill of SKILLS_LIST) {
        table.set(skill.name.toLowerCase(), skill.name);
    }
    return table;
}

const SKILLS_SECTION_HEADERS = [
    /^skills?$/i,
    /^technical skills?$/i,
    /^professional skills?$/i,
    /^core skills?$/i,
    /^key skills?$/i,
    /^skills? and competencies$/i,
    /^core competencies$/i,
    /^competencies$/i,
    /^areas of expertise$/i,
    /^areas of competency$/i,
    /^expertise$/i,
];

const RESUME_SECTION_HEADERS = [
    /^summary$/i,
    /^professional summary$/i,
    /^profile$/i,
    /^objective$/i,
    /^experience$/i,
    /^work experience$/i,
    /^professional experience$/i,
    /^employment history$/i,
    /^education$/i,
    /^projects?$/i,
    /^certifications?$/i,
    /^awards?$/i,
    /^achievements?$/i,
    /^references?$/i,
    /^languages?$/i,
    /^interests?$/i,
    /^volunteer experience$/i,
    /^publications?$/i,
];

function isSkillsHeader(line) {
    const clean = line.replace(/[:|•▪●]+$/g, '').trim();
    return SKILLS_SECTION_HEADERS.some((pattern) => pattern.test(clean));
}

function isResumeSectionHeader(line) {
    const clean = line.replace(/[:|•▪●]+$/g, '').trim();
    return RESUME_SECTION_HEADERS.some((pattern) => pattern.test(clean));
}

function extractSkillsSection(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim());

    const sections = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Handles formats such as "Skills: Communication, Excel, Accounting".
        const inlineMatch = line.match(/^(?:technical\s+|professional\s+|core\s+|key\s+)?skills?\s*:\s*(.+)$/i);
        if (inlineMatch) {
            sections.push(inlineMatch[1]);
            let j = i + 1;

            while (j < lines.length && lines[j]) {
                if (isResumeSectionHeader(lines[j]) || isSkillsHeader(lines[j])) break;
                sections.push(lines[j]);
                j++;
            }

            return sections.join('\n').trim();
        }

        if (!isSkillsHeader(line)) continue;

        const skillLines = [];
        for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];

            if (isResumeSectionHeader(nextLine) && skillLines.length > 0) break;
            if (isSkillsHeader(nextLine) && skillLines.length > 0) break;

            if (nextLine) skillLines.push(nextLine);
        }

        const sectionText = skillLines.join('\n').trim();
        if (sectionText) return sectionText;
    }

    return '';
}

function detectLocalSkills(text) {
    const table = buildSkillLookupTable();
    const lowerText = text.toLowerCase();
    const detected = [];

    for (const [key, originalName] of table.entries()) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const startsWithWordChar = /[a-z0-9]/.test(key[0] || '');
        const endsWithWordChar = /[a-z0-9]/.test(key[key.length - 1] || '');

        const pattern = startsWithWordChar && endsWithWordChar
            ? new RegExp(`\\b${escaped}\\b`, 'i')
            : new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');

        if (pattern.test(lowerText)) detected.push(originalName);
    }

    return detected;
}

async function detectSkills(text) {
    const localSkills = detectLocalSkills(text);
    const apiSkills = await detectSkillsFromESCO(text);

    const combined = [];
    const seen = new Set();

    for (const skill of [...localSkills, ...apiSkills]) {
        const key = skill.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        combined.push(skill);
    }

    return combined;
}

function extractEmail(text) {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
}

function extractName(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines.slice(0, 5)) {
        if (line.includes('@')) continue;
        if (/^\+?\d[\d\s-]{6,}$/.test(line)) continue;
        if (line.length > 2 && line.length < 60) return line;
    }

    return null;
}

function extractDegree(text) {
    const degreePatterns = [
        /bachelor of [a-z\s]+/i,
        /bs\s+[a-z\s]+/i,
        /b\.s\.\s*[a-z\s]+/i,
        /master of [a-z\s]+/i,
    ];

    for (const pattern of degreePatterns) {
        const match = text.match(pattern);
        if (match) return match[0].trim();
    }

    return null;
}

async function scanResume(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    let text = await extractTextFromFile(filePath, originalName);
    let ocrUsed = false;
    let ocrPagesScanned = 0;
    let ocrTotalPages = 0;

    if (ext === '.pdf' && text.trim().length < 80) {
        try {
            console.log('[ResumeScanner] No usable PDF text layer. Starting OCR...');
            const ocrResult = await ocrPdf(filePath);

            if (ocrResult.text.trim().length > text.trim().length) {
                text = ocrResult.text;
                ocrUsed = true;
                ocrPagesScanned = ocrResult.pagesScanned;
                ocrTotalPages = ocrResult.totalPages;
            }
        } catch (error) {
            console.error('[ResumeScanner] OCR failed:', error.stack || error.message || error);
        }
    }

    if (!text || text.trim().length === 0) {
        return {
            rawTextLength: 0,
            name: null,
            email: null,
            degree: null,
            detectedSkills: [],
            ocrUsed,
            ocrPagesScanned,
            ocrTotalPages,
            warning: 'No readable text was found. Please add your skills manually in your profile.',
        };
    }

    // Only analyze the resume's dedicated Skills section.
    // This prevents ESCO from interpreting job descriptions, work history,
    // education text, and random phrases in the PDF as skills.
    const skillsSection = extractSkillsSection(text);
    const detectedSkills = skillsSection
        ? await detectSkills(skillsSection)
        : [];
    let warning = null;

    if (!skillsSection) {
        warning = 'No Skills section was found in the resume. Add a Skills section so the analyzer knows which skills to save.';
    } else if (detectedSkills.length === 0) {
        warning = 'No known skills were detected in the Skills section. Try adding them manually in your profile.';
    } else if (ocrUsed && ocrTotalPages > ocrPagesScanned) {
        warning = `OCR scanned the first ${ocrPagesScanned} of ${ocrTotalPages} pages.`;
    }

    return {
        rawTextLength: text.length,
        name: extractName(text),
        email: extractEmail(text),
        degree: extractDegree(text),
        detectedSkills,
        ocrUsed,
        ocrPagesScanned,
        ocrTotalPages,
        warning,
    };
}

module.exports = { scanResume, detectSkills, detectLocalSkills, extractSkillsSection };
