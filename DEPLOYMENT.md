# JobPath deployment checklist

Use this checklist when deploying JobPath to Render or another Node.js host.

## Required configuration

- Set `NODE_ENV=production`.
- Set `SESSION_SECRET` to a long, random secret. Production startup intentionally fails when this value is missing or blank.
- Confirm the service uses the Node.js version supported by the project and its native dependencies.

## Persistent storage

The default SQLite database and resume-upload directories are inside the application directory. These defaults are suitable for local development, but they may be ephemeral on hosted platforms.

If the host supports a persistent disk mounted at `/var/data`, set:

- `JOBPATH_DB_PATH=/var/data/jobpath.db`
- `JOBPATH_UPLOAD_DIR=/var/data/uploads`

Attach and mount the persistent disk before setting these variables. Confirm the service account can read and write to the directory. SQLite WAL mode may create `jobpath.db-wal` and `jobpath.db-shm` files alongside the database; keep them on the same persistent disk and do not copy only the main database file while the service is running.

## Build and smoke check

Run:

```sh
npm install
npm run check
npm start
```

The repository's dependency lockfile must be reconciled with `package.json` before switching the install step to `npm ci`. Do not manually guess lockfile contents.

## After deployment

1. Open `/api/health` and confirm it returns HTTP 200 with a JSON status of `ok`.
2. Register a test candidate account and verify login and logout.
3. Save a resume in the builder, upload a valid PDF or DOCX, and verify invalid file content is rejected.
4. Apply to a test job and verify the application appears in the candidate and employer views as appropriate.
5. Restart or redeploy the service and verify the database records and uploaded resumes remain available.
6. Remove test accounts and test data before opening the site to real users.

A passing smoke check does not replace end-to-end testing of authentication, resume processing, applications, employer tools, or persistence.
