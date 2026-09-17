const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const pdfPoppler = require('pdf-poppler');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const HashTable = require('./HashTable');
const { SKILLS_LIST } = require('./skillsList');

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
async function ocrPdf(filePath) {
    const info = await pdfPoppler.info(filePath);
    const totalPages = Number(info?.pages) || 0;
    const pagesToScan = Math.min(totalPages, OCR_MAX_PAGES);
    const pageTexts = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpath-ocr-'));
    const worker = await createWorker('eng');

    try {
        console.log(`[OCR] PDF has ${totalPages} page(s). Scanning ${pagesToScan}...`);

        for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber++) {
            console.log(`[OCR] Rendering page ${pageNumber}/${pagesToScan} with Poppler...`);

            const outputPrefix = `page-${pageNumber}`;

            await pdfPoppler.convert(filePath, {
                format: 'png',
                out_dir: tempDir,
                out_prefix: outputPrefix,
                page: pageNumber,
                density: OCR_DENSITY,
            });

            const renderedFiles = fs.readdirSync(tempDir)
                .filter((file) => file.toLowerCase().endsWith('.png'));

            if (renderedFiles.length === 0) {
                throw new Error(`Poppler did not produce an image for page ${pageNumber}.`);
            }

            const imagePath = path.join(tempDir, renderedFiles[renderedFiles.length - 1]);
            const imageBuffer = fs.readFileSync(imagePath);

            console.log(`[OCR] Recognizing page ${pageNumber}...`);
            const result = await worker.recognize(imageBuffer);
            const pageText = result?.data?.text || '';

            pageTexts.push(pageText);
            console.log(`[OCR] Page ${pageNumber} complete (${pageText.length} characters).`);

            for (const file of renderedFiles) {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                } catch (_) {
                    // Ignore cleanup errors; the temp directory is removed below.
                }
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
