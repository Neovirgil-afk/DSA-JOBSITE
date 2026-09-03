

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { HashTable } = require('./HashTable');
const { SKILLS_LIST } = require('./skillsList');

async function extractTextFromFile(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.pdf') {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
    }

    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
    }

    throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
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
        // Word-boundary-ish match to reduce false positives (e.g. "C++" needs special handling)
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = /[a-z0-9]/.test(key[key.length - 1])
            ? new RegExp(`\\b${escaped}\\b`, 'i')
            : new RegExp(escaped, 'i'); // e.g. "C++"
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
    const text = await extractTextFromFile(filePath, originalName);

    if (!text || text.trim().length === 0) {
        return {
            rawTextLength: 0,
            name: null,
            email: null,
            degree: null,
            detectedSkills: [],
            warning: 'No readable text was found in this file. If it is a scanned/image-only PDF, please add your skills manually.',
        };
    }

    const detectedSkills = detectSkills(text);

    return {
        rawTextLength: text.length,
        name: extractName(text),
        email: extractEmail(text),
        degree: extractDegree(text),
        detectedSkills,
        warning: detectedSkills.length === 0 ? 'No known skills were detected. Try adding them manually in your profile.' : null,
    };
}

module.exports = { scanResume, detectSkills };
