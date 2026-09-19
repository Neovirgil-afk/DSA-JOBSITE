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
    const pageData = [];
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
            pageData.push(result?.data || {});
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
        pageData,
        pagesScanned: pageTexts.length,
        totalPages,
    };
}

function cleanOCRSkillLine(line) {
    return String(line || '')
        .replace(/^[\\s•▪●◦*+«»®©·\\-–—]+/, '')
        .replace(/\\s+/g, ' ')
        .trim();
}

function extractSkillsSectionFromOCRData(pageData) {
    for (const data of pageData || []) {
        const lines = Array.isArray(data?.lines) ? data.lines : [];
        const skillHeaders = lines.filter((line) => {
            const text = String(line?.text || '').trim();
            return /^skills?$/i.test(text) && line?.bbox;
        });

        if (skillHeaders.length === 0) continue;

        // Prefer the large, standalone ALL-CAPS heading over occurrences of
        // the word "skills" inside work-history sentences.
        const header = skillHeaders.sort((a, b) => {
            const aHeight = (a.bbox?.y1 || 0) - (a.bbox?.y0 || 0);
            const bHeight = (b.bbox?.y1 || 0) - (b.bbox?.y0 || 0);
            return bHeight - aHeight;
        })[0];

        const headerBox = header.bbox;
        const headerX = Number(headerBox.x0 || 0);
        const headerY = Number(headerBox.y1 || 0);

        const candidateLines = lines
            .filter((line) => {
                const box = line?.bbox;
                if (!box) return false;

                const text = String(line.text || '').trim();
                if (!text) return false;

                const x0 = Number(box.x0 || 0);
                const y0 = Number(box.y0 || 0);

                // Keep text below the heading and inside the same right/left
                // column. This fixes multi-column OCR reading-order errors.
                return y0 > headerY + 5 && x0 >= headerX - 60;
            })
            .sort((a, b) => Number(a.bbox.y0) - Number(b.bbox.y0));

        const skills = [];

        for (const line of candidateLines) {
            const text = cleanOCRSkillLine(line.text);

            if (!text) continue;

            // Stop at another major section heading.
            const normalized = normalizeHeader(text);
            if (
                skills.length > 0 &&
                (
                    isResumeSectionHeader(normalized) ||
                    /^(?:career objective|education|experience|work experience|projects?|certifications?|awards?|summary|profile)$/i.test(normalized)
                )
            ) {
                break;
            }

            skills.push(text);
        }

        if (skills.length > 0) {
            console.log('[ResumeScanner] Skills extracted from OCR coordinates:', skills);
            return skills.join('\\n');
        }
    }

    return '';
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

function normalizeHeader(line) {
    return String(line || '')
        .replace(/[|•▪●·:;,_-]+/g, ' ')
        .replace(/[^a-zA-Z0-9&/ ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshteinDistance(a, b) {
    const left = String(a || '');
    const right = String(b || '');

    const previous = Array.from({ length: right.length + 1 }, (_, i) => i);

    for (let i = 1; i <= left.length; i++) {
        const current = [i];

        for (let j = 1; j <= right.length; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;

            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost
            );
        }

        previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
}

function isSkillsHeader(line) {
    const clean = normalizeHeader(line);
    const compact = clean.replace(/[^a-z]/gi, '').toLowerCase();

    if (compact === 'skills') return true;

    // OCR may slightly corrupt the heading, for example SKILIS or SKIILS.
    if (
        compact.length >= 4 &&
        compact.length <= 8 &&
        levenshteinDistance(compact, 'skills') <= 1
    ) {
        return true;
    }

    if (/^skills?\b/i.test(clean)) return true;
    if (/^(technical|professional|core|key)\s+skills?\b/i.test(clean)) return true;

    return SKILLS_SECTION_HEADERS.some((pattern) => pattern.test(clean));
}

function getSkillsHeaderContent(line) {
    const clean = String(line || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const match = clean.match(
        /^(?:technical\s+|professional\s+|core\s+|key\s+)?skills?\s*(?::|-|–|—)?\s*(.*)$/i
    );

    return match ? match[1].trim() : '';
}

function isResumeSectionHeader(line) {
    const clean = normalizeHeader(line);
    return RESUME_SECTION_HEADERS.some((pattern) => pattern.test(clean));
}

function collectSkillsAfterHeader(lines, headerIndex, headerContent = '') {
    const skillLines = [];

    if (
        headerContent &&
        !isSkillsHeader(headerContent) &&
        !isResumeSectionHeader(headerContent)
    ) {
        skillLines.push(headerContent);
    }

    for (let j = headerIndex + 1; j < lines.length; j++) {
        const nextLine = lines[j];

        if (isResumeSectionHeader(nextLine) && skillLines.length > 0) {
            break;
        }

        if (isSkillsHeader(nextLine) && skillLines.length > 0) {
            break;
        }

        if (nextLine) {
            skillLines.push(nextLine);
        }
    }

    return skillLines.join('\n').trim();
}

function extractSkillsSection(text) {
    const rawText = String(text || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');

    // OCR can contain inconsistent line endings. Normalize them first.
    const lines = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.trim());

    // First try exact/near-exact Skills headings.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const inlineMatch = line.match(
            /^(?:technical\s+|professional\s+|core\s+|key\s+)?skills?\s*[:\-–—]\s*(.+)$/i
        );

        if (inlineMatch) {
            const sections = [inlineMatch[1].trim()];
            let j = i + 1;

            while (j < lines.length && lines[j]) {
                if (isResumeSectionHeader(lines[j]) || isSkillsHeader(lines[j])) {
                    break;
                }

                sections.push(lines[j]);
                j++;
            }

            return sections.join('\n').trim();
        }

        if (!isSkillsHeader(line)) continue;

        const headerContent = getSkillsHeaderContent(line);
        const sectionText = collectSkillsAfterHeader(lines, i, headerContent);

        if (sectionText) {
            return sectionText;
        }
    }

    // Final OCR fallback: sometimes a multi-column PDF causes the
    // heading to be attached to the end of the previous sentence, e.g.
    // "problem-solving by SKILLS". Only accept "skills" when it is at the
    // end of a line so words such as "interpersonal skills" in work history
    // cannot accidentally become the Skills section.
    const trailingSkillsIndex = lines.findIndex((line) => /\bskills?\s*$/i.test(line));

    if (trailingSkillsIndex >= 0) {
        const matchedLine = lines[trailingSkillsIndex];
        const headerContent = getSkillsHeaderContent(matchedLine);
        const sectionText = collectSkillsAfterHeader(
            lines,
            trailingSkillsIndex,
            headerContent
        );

        if (sectionText) {
            return sectionText;
        }
    }

    return '';
}

function extractDeclaredSkillCandidates(skillsSection) {
    return String(skillsSection || '')
        .split(/\r?\n/)
        .map((line) => line
            .replace(/^[\s•▪●◦*\-–—]+/, '')
            .replace(/\s+/g, ' ')
            .trim())
        .filter((line) => line.length >= 2 && line.length <= 120)
        .filter((line) => !isResumeSectionHeader(line) && !isSkillsHeader(line));
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
    let ocrPageData = [];

    if (ext === '.pdf' && text.trim().length < 80) {
        try {
            console.log('[ResumeScanner] No usable PDF text layer. Starting OCR...');
            const ocrResult = await ocrPdf(filePath);

            if (ocrResult.text.trim().length > text.trim().length) {
                text = ocrResult.text;
                ocrUsed = true;
                ocrPageData = ocrResult.pageData || [];
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

    // Only use the resume's dedicated Skills section.
    // The applicant's declared skills are the source of truth.
    // Do NOT add ESCO suggestions here, because ESCO can return related
    // skills and phrases that were never actually listed on the resume.
    const coordinateSkillsSection = ocrUsed
        ? extractSkillsSectionFromOCRData(ocrPageData)
        : '';

    const skillsSection = coordinateSkillsSection || extractSkillsSection(text);
    const declaredSkillCandidates = extractDeclaredSkillCandidates(skillsSection);

    const detectedSkills = [];
    const seenSkills = new Set();

    for (const skill of declaredSkillCandidates) {
        const key = skill.toLowerCase();
        if (seenSkills.has(key)) continue;
        seenSkills.add(key);
        detectedSkills.push(skill);
    }

    const finalSkills = detectedSkills;

    console.log('[ResumeScanner] Skills section found:', Boolean(skillsSection));
    console.log('[ResumeScanner] Declared skill candidates:', declaredSkillCandidates);
    console.log('[ResumeScanner] Final detected skills:', finalSkills);

    if (!skillsSection && ocrUsed) {
        console.log('[ResumeScanner] OCR text tail for debugging:', text.slice(-1200));
    }

    let warning = null;

    if (!skillsSection) {
        warning = 'No Skills section was found in the resume. Add a Skills section so the analyzer knows which skills to save.';
    } else if (finalSkills.length === 0) {
        warning = 'No known skills were detected in the Skills section. Try adding them manually in your profile.';
    } else if (ocrUsed && ocrTotalPages > ocrPagesScanned) {
        warning = `OCR scanned the first ${ocrPagesScanned} of ${ocrTotalPages} pages.`;
    }

    return {
        rawTextLength: text.length,
        name: extractName(text),
        email: extractEmail(text),
        degree: extractDegree(text),
        detectedSkills: finalSkills,
        ocrUsed,
        ocrPagesScanned,
        ocrTotalPages,
        warning,
    };
}

module.exports = { scanResume, detectSkills, detectLocalSkills, extractSkillsSection };
