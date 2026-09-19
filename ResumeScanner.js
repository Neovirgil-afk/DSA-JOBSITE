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
const OCR_DENSITY = 300;

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
        '-scale-to', '2400',
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
function parseOCRTSVLines(tsv) {
    const lineMap = new Map();

    for (const rawLine of String(tsv || '').split(/\\r?\\n/)) {
        if (!rawLine || rawLine.startsWith('level\\t')) continue;

        const parts = rawLine.split('\\t');
        if (parts.length < 12 || Number(parts[0]) !== 5) continue;

        const pageNum = parts[1];
        const blockNum = parts[2];
        const paragraphNum = parts[3];
        const lineNum = parts[4];
        const left = Number(parts[6]);
        const top = Number(parts[7]);
        const width = Number(parts[8]);
        const height = Number(parts[9]);
        const confidence = Number(parts[10]);
        const text = parts.slice(11).join('\\t').trim();

        if (
            !Number.isFinite(left) ||
            !Number.isFinite(top) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            !text ||
            confidence < 0
        ) {
            continue;
        }

        const key = [
            pageNum,
            blockNum,
            paragraphNum,
            lineNum,
        ].join(':');

        if (!lineMap.has(key)) {
            lineMap.set(key, {
                text: '',
                bbox: {
                    x0: left,
                    y0: top,
                    x1: left + width,
                    y1: top + height,
                },
            });
        }

        const line = lineMap.get(key);
        line.text = line.text
            ? `${line.text} ${text}`
            : text;

        line.bbox.x0 = Math.min(line.bbox.x0, left);
        line.bbox.y0 = Math.min(line.bbox.y0, top);
        line.bbox.x1 = Math.max(line.bbox.x1, left + width);
        line.bbox.y1 = Math.max(line.bbox.y1, top + height);
    }

    return Array.from(lineMap.values()).sort((a, b) => {
        if (a.bbox.y0 !== b.bbox.y0) {
            return a.bbox.y0 - b.bbox.y0;
        }

        return a.bbox.x0 - b.bbox.x0;
    });
}

function findOCRSkillsHeader(lines) {
    const headers = (lines || []).filter((line) => {
        const text = String(line?.text || '').trim();
        return /^skills?$/i.test(text) && line?.bbox;
    });

    if (headers.length === 0) return null;

    return headers.sort((a, b) => {
        const aHeight = a.bbox.y1 - a.bbox.y0;
        const bHeight = b.bbox.y1 - b.bbox.y0;
        return bHeight - aHeight;
    })[0];
}

function buildSkillsOCRRectangle(lines, header, imageBuffer) {
    const headerBox = header?.bbox;
    if (!headerBox) return null;

    const imageInfo = imageBuffer;
    if (!imageInfo) return null;

    // Tesseract coordinates use the rendered image's pixel space. We use
    // the image dimensions only to clamp the rectangle safely.
    // PNG dimensions are read from the IHDR header.
    if (
        imageInfo.length < 24 ||
        imageInfo.toString('ascii', 1, 4) !== 'PNG'
    ) {
        return null;
    }

    const imageWidth = imageInfo.readUInt32BE(16);
    const imageHeight = imageInfo.readUInt32BE(20);

    if (!imageWidth || !imageHeight) return null;

    const headerCenterX = (headerBox.x0 + headerBox.x1) / 2;
    const headerHeight = Math.max(1, headerBox.y1 - headerBox.y0);

    const below = (lines || []).filter((line) => {
        const box = line?.bbox;
        if (!box) return false;

        const centerX = (box.x0 + box.x1) / 2;
        return (
            box.y0 > headerBox.y1 &&
            box.y0 < headerBox.y1 + Math.max(900, headerHeight * 30) &&
            Math.abs(centerX - headerCenterX) <= 220
        );
    });

    const nextSection = below.find((line) => {
        const normalized = normalizeHeader(line.text);
        return isResumeSectionHeader(normalized) &&
            !/^skills?$/i.test(normalized);
    });

    const bottom = nextSection
        ? nextSection.bbox.y0 - 8
        : Math.min(imageHeight - 4, headerBox.y1 + Math.max(1000, headerHeight * 35));

    // Give the crop enough horizontal room for the actual sidebar, while
    // keeping it narrow enough to exclude the neighboring column.
    const columnLines = below.filter((line) => {
        const box = line.bbox;
        const centerX = (box.x0 + box.x1) / 2;
        return Math.abs(centerX - headerCenterX) <= 180;
    });

    const rightMost = columnLines.reduce(
        (max, line) => Math.max(max, line.bbox.x1),
        headerBox.x1
    );

    const leftMost = columnLines.reduce(
        (min, line) => Math.min(min, line.bbox.x0),
        headerBox.x0
    );

    const left = Math.max(0, Math.floor(leftMost - 40));
    const right = Math.min(imageWidth, Math.ceil(rightMost + 40));
    const top = Math.max(0, Math.floor(headerBox.y0 - 15));
    const height = Math.max(20, Math.min(imageHeight - top, Math.ceil(bottom - top)));

    if (right <= left || height <= 20) return null;

    return {
        left,
        top,
        width: right - left,
        height,
    };
}

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
            // Tesseract.js v6+ returns only text by default.
            // Request the structured block data so we can use bounding boxes
            // to correctly read multi-column resumes.
            const result = await worker.recognize(
                imageBuffer,
                {},
                { blocks: true, tsv: true }
            );

            const pageText = result?.data?.text || '';

            // Run a second OCR pass on the visual Skills column when the
            // first pass provides enough coordinate data to locate SKILLS.
            // This prevents Tesseract's normal reading order from mixing
            // Skills with text from another column.
            let skillsText = '';
            try {
                const tsv = result?.data?.tsv || '';
                const tsvLines = parseOCRTSVLines(tsv);
                const skillHeader = findOCRSkillsHeader(tsvLines);

                if (skillHeader) {
                    const box = buildSkillsOCRRectangle(
                        tsvLines,
                        skillHeader,
                        imageBuffer
                    );

                    if (box) {
                        console.log(
                            '[OCR] Running isolated Skills-column recognition...'
                        );

                        const skillsResult = await worker.recognize(
                            imageBuffer,
                            {
                                rectangle: box,
                            },
                            {}
                        );

                        skillsText = skillsResult?.data?.text || '';
                    }
                }
            } catch (error) {
                console.warn(
                    '[OCR] Isolated Skills recognition failed:',
                    error.message
                );
            }

            pageTexts.push(pageText);
            pageData.push({
                blocks: result?.data?.blocks || [],
                tsv: result?.data?.tsv || '',
                skillsText,
            });
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
        .replace(/^[\s•▪●◦*+«»®©·\-–—]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSkillsSectionFromOCRData(pageData) {
    function parseTSVLines(tsv) {
        const lines = [];
        const lineMap = new Map();

        for (const rawLine of String(tsv || '').split(/\r?\n/)) {
            if (!rawLine || rawLine.startsWith('level\t')) continue;

            const parts = rawLine.split('\t');
            if (parts.length < 12) continue;

            const level = Number(parts[0]);
            if (level !== 5) continue;

            const pageNum = parts[1];
            const blockNum = parts[2];
            const paragraphNum = parts[3];
            const lineNum = parts[4];
            const wordNum = parts[5];
            const left = Number(parts[6]);
            const top = Number(parts[7]);
            const width = Number(parts[8]);
            const height = Number(parts[9]);
            const confidence = Number(parts[10]);
            const text = parts.slice(11).join('\t').trim();

            if (
                !Number.isFinite(left) ||
                !Number.isFinite(top) ||
                !Number.isFinite(width) ||
                !Number.isFinite(height) ||
                !text ||
                confidence < 0
            ) {
                continue;
            }

            const key = [
                pageNum,
                blockNum,
                paragraphNum,
                lineNum,
            ].join(':');

            if (!lineMap.has(key)) {
                lineMap.set(key, {
                    text: '',
                    bbox: {
                        x0: left,
                        y0: top,
                        x1: left + width,
                        y1: top + height,
                    },
                    wordNum,
                });
            }

            const line = lineMap.get(key);
            line.text = line.text
                ? `${line.text} ${text}`
                : text;

            line.bbox.x0 = Math.min(line.bbox.x0, left);
            line.bbox.y0 = Math.min(line.bbox.y0, top);
            line.bbox.x1 = Math.max(line.bbox.x1, left + width);
            line.bbox.y1 = Math.max(line.bbox.y1, top + height);
        }

        for (const line of lineMap.values()) {
            lines.push(line);
        }

        return lines.sort((a, b) => {
            if (a.bbox.y0 !== b.bbox.y0) return a.bbox.y0 - b.bbox.y0;
            return a.bbox.x0 - b.bbox.x0;
        });
    }

    function getOCRLines(data) {
        const tsvLines = parseTSVLines(data?.tsv);
        if (tsvLines.length > 0) return tsvLines;

        const directLines = Array.isArray(data?.lines) ? data.lines : [];
        if (directLines.length > 0) return directLines;

        const result = [];
        const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

        for (const block of blocks) {
            for (const paragraph of block?.paragraphs || []) {
                for (const line of paragraph?.lines || []) {
                    result.push(line);
                }
            }
        }

        return result;
    }

    for (const data of pageData || []) {
        // Prefer the isolated second-pass OCR when available. Since this text
        // came from the Skills-column rectangle, it cannot contain the
        // neighboring work-history column.
        if (String(data?.skillsText || '').trim()) {
            const isolatedSkills = String(data.skillsText)
                .split(/\r?\n/)
                .map((line) => cleanOCRSkillLine(line))
                .filter(Boolean)
                .filter((line) => !/^skills?$/i.test(line))
                .filter((line) => line.length <= 80);

            if (isolatedSkills.length > 0) {
                return isolatedSkills.join('\n');
            }
        }

        const lines = getOCRLines(data);

        const skillHeaders = lines.filter((line) => {
            const text = String(line?.text || '').trim();
            return /^skills?$/i.test(text) && line?.bbox;
        });

        if (skillHeaders.length === 0) continue;

        // Pick the largest standalone "SKILLS" heading. This avoids treating
        // phrases such as "interpersonal skills" in work history as headings.
        const header = skillHeaders.sort((a, b) => {
            const aBox = a.bbox || {};
            const bBox = b.bbox || {};
            const aHeight = Number(aBox.y1 || 0) - Number(aBox.y0 || 0);
            const bHeight = Number(bBox.y1 || 0) - Number(bBox.y0 || 0);
            return bHeight - aHeight;
        })[0];

        const headerBox = header.bbox;
        const headerX = Number(headerBox.x0 || 0);
        const headerY = Number(headerBox.y1 || 0);
        const headerHeight = Math.max(
            1,
            Number(headerBox.y1 || 0) - Number(headerBox.y0 || 0)
        );

        // Do not trust OCR reading order for multi-column resumes.
        // First isolate the visual column containing the SKILLS heading.
        // We estimate the column width from nearby OCR lines and keep only
        // lines whose horizontal center stays close to the heading center.
        const headerCenterX = (
            Number(headerBox.x0 || 0) +
            Number(headerBox.x1 || headerBox.x0 || 0)
        ) / 2;

        const nearbyLines = lines.filter((line) => {
            const box = line?.bbox;
            if (!box) return false;

            const text = String(line.text || '').trim();
            if (!text) return false;

            const y0 = Number(box.y0 || 0);
            const y1 = Number(box.y1 || 0);
            return (
                y0 > headerY &&
                y0 <= headerY + Math.max(700, headerHeight * 20) &&
                y1 > headerY
            );
        });

        const sameColumnLines = nearbyLines.filter((line) => {
            const box = line.bbox;
            const centerX = (
                Number(box.x0 || 0) +
                Number(box.x1 || box.x0 || 0)
            ) / 2;

            return Math.abs(centerX - headerCenterX) <= 180;
        });

        const candidateLines = sameColumnLines
            .filter((line) => {
                const box = line?.bbox;
                const text = String(line.text || '').trim();
                if (!box || !text) return false;

                const x0 = Number(box.x0 || 0);
                const y0 = Number(box.y0 || 0);

                return y0 > headerY + Math.max(3, headerHeight * 0.25)
                    && Math.abs(x0 - headerX) <= 180;
            })
            .sort((a, b) => {
                const yDiff = Number(a.bbox.y0) - Number(b.bbox.y0);
                if (Math.abs(yDiff) > 4) return yDiff;
                return Number(a.bbox.x0) - Number(b.bbox.x0);
            });

        const skills = [];

        for (const line of candidateLines) {
            const text = cleanOCRSkillLine(line.text);
            if (!text) continue;

            const normalized = normalizeHeader(text);

            // Stop if another major resume section starts in this column.
            if (
                skills.length > 0 &&
                (
                    isResumeSectionHeader(normalized) ||
                    /^(?:career objective|education|experience|work experience|projects?|certifications?|awards?|summary|profile)$/i.test(normalized)
                )
            ) {
                break;
            }

            // A Skills section item should normally be short. Ignore large
            // OCR lines that clearly came from another part of the resume.
            if (text.length > 80) continue;

            skills.push(text);
        }

        if (skills.length > 0) {
            console.log('[ResumeScanner] Skills extracted from OCR coordinates:', skills);
            return skills.join('\n');
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
