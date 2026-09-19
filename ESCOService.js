const ESCO_API_BASE = 'https://ec.europa.eu/esco/api';
const ESCO_VERSION = 'v1.2.0';
const MAX_QUERIES = 20;
const RESULTS_PER_QUERY = 5;
const REQUEST_TIMEOUT_MS = 7000;

function cleanQuery(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[|•▪●]+/g, ' ')
        .trim();
}

function getQueryCandidates(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map(cleanQuery)
        .filter((line) => line.length >= 8 && line.length <= 220);

    const sentences = String(text || '')
        .split(/[.!?;]+/)
        .map(cleanQuery)
        .filter((line) => line.length >= 12 && line.length <= 220);

    const candidates = [];
    const seen = new Set();

    for (const value of [...lines, ...sentences]) {
        const normalized = value.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        // Skip obvious contact/header lines. They rarely contain useful skills.
        if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(value)) continue;
        if (/^https?:\/\//i.test(value)) continue;

        candidates.push(value);
        if (candidates.length >= MAX_QUERIES) break;
    }

    return candidates;
}

function extractResults(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?._embedded?.results)) return payload._embedded.results;
    if (Array.isArray(payload?._embedded?.items)) return payload._embedded.items;
    return [];
}

function getSkillName(item) {
    if (!item || typeof item !== 'object') return null;

    const preferredLabel = item.preferredLabel;
    if (typeof preferredLabel === 'string') return preferredLabel;
    if (preferredLabel && typeof preferredLabel === 'object') {
        return preferredLabel.en || preferredLabel['en-US'] || Object.values(preferredLabel)[0] || null;
    }

    return item.title || item.name || item.label || null;
}

async function searchESCO(query) {
    const params = new URLSearchParams({
        text: query,
        type: 'skill',
        language: 'en',
        limit: String(RESULTS_PER_QUERY),
        selectedVersion: ESCO_VERSION,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${ESCO_API_BASE}/search?${params.toString()}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`ESCO API returned HTTP ${response.status}`);
        }

        return extractResults(await response.json());
    } finally {
        clearTimeout(timer);
    }
}

function addResult(map, item, queryIndex, resultIndex) {
    const name = getSkillName(item);
    if (!name || name.length < 2 || name.length > 160) return;

    const key = name.trim().toLowerCase();
    const current = map.get(key);

    // Earlier results and earlier queries are treated as stronger matches.
    const score = (MAX_QUERIES - queryIndex) * 10 + (RESULTS_PER_QUERY - resultIndex);

    if (!current || score > current.score) {
        map.set(key, {
            name: name.trim(),
            score,
        });
    }
}

async function detectSkillsFromESCO(text) {
    const queries = getQueryCandidates(text);
    const detected = new Map();

    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
        const query = queries[queryIndex];

        try {
            const results = await searchESCO(query);

            // Keep only the first few ranked ESCO results for each resume fragment.
            results.slice(0, 3).forEach((item, resultIndex) => {
                addResult(detected, item, queryIndex, resultIndex);
            });
        } catch (error) {
            // API failure should never prevent the resume from being scanned.
            console.error('[ESCO] Skill lookup failed:', error.message);
        }
    }

    return [...detected.values()]
        .sort((a, b) => b.score - a.score)
        .map((item) => item.name);
}

module.exports = {
    detectSkillsFromESCO,
};
