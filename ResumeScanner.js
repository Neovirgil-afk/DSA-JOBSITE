const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const HashTable = require('./HashTable');
const { SKILLS_LIST } = require('./skillsList');

const OCR_MAX_PAGES = 5;
const OCR_SCALE = 2.5;

let pdfjsReadyPromise = null;

async function extractPdfText(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
}

async function extractTextFromFile(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.pdf') {
        return extractPdfText(filePath);
    }

    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
    }

    throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
}

async function loadPdfJs() {
    if (!pdfjsReadyPromise) {
        const { definePDFJSModule } = await import('unpdf');
        pdfjsReadyPromise = definePDFJSModule(() => import('pdfjs-dist'));
    }

    return pdfjsReadyPromise;
}

// OCR fallback for image-only/scanned PDFs.
// PDF.js renders each page into a PNG, then Tesseract.js reads the PNG.
async function ocrPdf(filePath) {
    await loadPdfJs();

    const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
    const pdfBuffer = fs.readFileSync(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const totalPages = pdf.numPages;
    const pagesToScan = Math.min(totalPages, OCR_MAX_PAGES);

    let worker;
    const pageTexts = [];

    try {
        worker = await createWorker('eng', 1, {
            logger: (message) => {
                if (message.status === 'recognizing text' && message.progress > 0) {
                    console.log(`[OCR] ${Math.round(message.progress * 100)}%`);
                }
            },
        });

        for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber++) {
            console.log(`[OCR] Rendering page ${pageNumber}/${pagesToScan}...`);

            const image = await renderPageAsImage(pdf, pageNumber, {
                canvasImport: () => import('@napi-rs/canvas'),
                scale: OCR_SCALE,
            });

            const result = await worker.recognize(Buffer.from(image));
            pageTexts.push(result.data.text || '');
        }
    } finally {
        if (worker) {
            await worker.terminate();
        }

        if (pdf && typeof pdf.destroy === 'function') {
            await pdf.destroy();
        }
    }

    return {
        text: pageTexts.join('\n\n'),
        pagesScanned: pagesToScan,
        totalPages,
    };
}

// Build a Hash Table once for fast case-insensitive skill matching.
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
        // Escape regex characters so skills like C++, C#, .NET and UI/UX are safe.
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const startsWithWordChar = /[a-z0-9]/.test(key[0] || '');
        const endsWithWordChar = /[a-z0-9]/.test(key[key.length - 1] || '');

        const pattern = startsWithWordChar && endsWithWordChar
            ? new RegExp(`\\b${escaped}\\b`, 'i')
            : new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');

        if (pattern.test(lowerText)) {
            detected.push(originalName);
        }
    }

    return detected;
}

function extractEmail(text) {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
}

// Very rough heuristic: first non-empty line that isn't an email/phone is often the name.
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

    // A scanned PDF can look full of text but have no PDF text layer.
    // If normal extraction is empty/nearly empty, render the pages and run OCR.
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
            warning: ocrUsed
                ? 'OCR completed but no readable text was found. You can add your skills manually in your profile.'
                : 'No readable text was found. If this is a scanned/image-only PDF, OCR could not read it. Please add your skills manually in your profile.',
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
