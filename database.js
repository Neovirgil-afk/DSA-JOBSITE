

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

/*
 * Lightweight migrations for databases created before the employer area.
 * SQLite supports ADD COLUMN for existing tables, so the current local/
 * deployed database can gain the new fields without being recreated.
 */
function addColumnIfMissing(table, column, definition) {
    const columns = db.pragma(`table_info(${table})`);
    if (!columns.some((entry) => entry.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

addColumnIfMissing('users', 'role', "TEXT NOT NULL DEFAULT 'candidate'");

addColumnIfMissing('jobs', 'responsibilities', 'TEXT');
addColumnIfMissing('jobs', 'qualifications', 'TEXT');
addColumnIfMissing('jobs', 'work_schedule', 'TEXT');
addColumnIfMissing('jobs', 'benefits', 'TEXT');
addColumnIfMissing('jobs', 'application_requirements', 'TEXT');
addColumnIfMissing('jobs', 'application_deadline', 'TEXT');
addColumnIfMissing('jobs', 'how_to_apply', 'TEXT');
addColumnIfMissing('jobs', 'contact_information', 'TEXT');
addColumnIfMissing('jobs', 'status', "TEXT NOT NULL DEFAULT 'active'");
addColumnIfMissing('jobs', 'employer_id', 'INTEGER');
addColumnIfMissing('jobs', 'created_at', 'TEXT');
addColumnIfMissing('jobs', 'updated_at', 'TEXT');

addColumnIfMissing('company_profiles', 'industry', 'TEXT');
addColumnIfMissing('company_profiles', 'company_size', 'TEXT');
addColumnIfMissing('company_profiles', 'location', 'TEXT');
addColumnIfMissing('company_profiles', 'founded_year', 'TEXT');
addColumnIfMissing('company_profiles', 'benefits', 'TEXT');
addColumnIfMissing('company_profiles', 'user_id', 'INTEGER');

db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        resume_id INTEGER,
        status TEXT NOT NULL DEFAULT 'new',
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(job_id, user_id),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (resume_id) REFERENCES user_resumes(id) ON DELETE SET NULL
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS application_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )
`);

module.exports = { db, isFreshDatabase: !dbExisted };
