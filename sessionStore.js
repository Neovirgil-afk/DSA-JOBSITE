'use strict';

const session = require('express-session');
const { db } = require('./database');

// Store sessions in SQLite instead of Express' in-memory store, which loses
// sessions on restart and is unsuitable for production.
class SQLiteSessionStore extends session.Store {
    constructor() {
        super();
        this.getStatement = db.prepare(
            'SELECT session_data, expires_at FROM sessions WHERE sid = ?'
        );
        this.setStatement = db.prepare(
            'INSERT INTO sessions (sid, session_data, expires_at) VALUES (?, ?, ?) ' +
            'ON CONFLICT(sid) DO UPDATE SET session_data = excluded.session_data, ' +
            'expires_at = excluded.expires_at'
        );
        this.deleteStatement = db.prepare('DELETE FROM sessions WHERE sid = ?');
        this.touchStatement = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
    }

    expirationFor(sessionData) {
        const cookie = sessionData && sessionData.cookie;
        if (cookie && cookie.expires) {
            const expiresAt = new Date(cookie.expires).getTime();
            if (Number.isFinite(expiresAt)) return expiresAt;
        }
        const maxAge = Number(cookie && cookie.originalMaxAge);
        return Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 86400000);
    }

    get(sid, callback) {
        try {
            const row = this.getStatement.get(sid);
            if (!row) return callback(null, null);
            if (row.expires_at <= Date.now()) {
                this.deleteStatement.run(sid);
                return callback(null, null);
            }
            let sessionData;
            try {
                sessionData = JSON.parse(row.session_data);
            } catch (error) {
                this.deleteStatement.run(sid);
                return callback(error);
            }
            return callback(null, sessionData);
        } catch (error) {
            return callback(error);
        }
    }

    set(sid, sessionData, callback) {
        try {
            const expiresAt = this.expirationFor(sessionData);
            if (expiresAt <= Date.now()) {
                this.deleteStatement.run(sid);
            } else {
                this.setStatement.run(sid, JSON.stringify(sessionData), expiresAt);
            }
            if (callback) callback(null);
        } catch (error) {
            if (callback) return callback(error);
            throw error;
        }
    }

    touch(sid, sessionData, callback) {
        try {
            this.touchStatement.run(this.expirationFor(sessionData), sid);
            if (callback) callback(null);
        } catch (error) {
            if (callback) return callback(error);
            throw error;
        }
    }

    destroy(sid, callback) {
        try {
            this.deleteStatement.run(sid);
            if (callback) callback(null);
        } catch (error) {
            if (callback) return callback(error);
            throw error;
        }
    }
}

module.exports = SQLiteSessionStore;
