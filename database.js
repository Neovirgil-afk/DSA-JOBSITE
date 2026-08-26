

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'jobpath.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const dbExisted = fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Always (re)apply schema — CREATE TABLE IF NOT EXISTS makes this safe on every boot.
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

module.exports = { db, isFreshDatabase: !dbExisted };
