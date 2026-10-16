'use strict';

// Lightweight per-process limiter for authentication endpoints.
// For multi-instance deployments, use a shared store such as Redis.
const windows = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function authRateLimit(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = ip + ':' + req.baseUrl + req.path;
    let entry = windows.get(key);

    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + WINDOW_MS };
        windows.set(key, entry);
    }

    if (entry.count >= MAX_ATTEMPTS) {
        const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
            error: 'Too many authentication attempts. Please wait a little and try again.'
        });
    }

    entry.count += 1;

    // Bound memory use if many different IPs hit the authentication endpoints.
    if (windows.size > 10000) {
        for (const [storedKey, storedEntry] of windows) {
            if (now >= storedEntry.resetAt) windows.delete(storedKey);
        }
        if (windows.size > 10000) windows.clear();
    }

    next();
}

module.exports = authRateLimit;
