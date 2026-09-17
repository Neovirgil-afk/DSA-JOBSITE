const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const HashTable = require('./HashTable');
const { SKILLS_LIST } = require('./skillsList');

const OCR_MAX_PAGES = 5;
const OCR_SCALE = 2.5;

async function extractPdfText(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
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

// Render a PDF page to a PNG without going through PDF.js.
// Poppler/pdf-to-image is intentionally avoided so this remains npm-based.
async function ocrPdf(filePath) {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(filePath, { scale: OCR_SCALE });
    const worker = await createWorker('eng');
    const pageTexts = [];
    let totalPages = 0;

    try {
        for await (const image of document) {
            totalPages++;
            if (totalPages > OCR_MAX_PAGES) break;

            console.log(`[OCR] Rendering page ${totalPages}/${OCR_MAX_PAGES}...`);
            const result = await worker.recognize(image);
            pageTexts.push(result.data.text || '');

            console.log(`[OCR] Page ${totalPages} complete.`);
        }
    } finally {
        await worker.terminate();
    }

    return {
        text: pageTexts.join('\n\n'),
        pagesScanned: pageTexts.length,
        totalPages: totalPages,
    };
}

function buildSkillLookupTable() {
    const table = new HashTable();
    for (const skill of SKILLS_LIST) {
        table.set(skill.name.toLowerCase(), skill.name);
    }
    return table;
}

function detectSkills(text) {
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
            console.error('[ResumeScanner] OCR failed:', error.message);
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

    const detectedSkills = detectSkills(text);
    let warning = null;

    if (detectedSkills.length === 0) {
        warning = 'No known skills were detected. Try adding them manually in your profile.';
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

module.exports = { scanResume, detectSkills };
