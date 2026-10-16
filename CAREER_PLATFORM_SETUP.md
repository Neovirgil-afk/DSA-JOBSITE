# Career Platform Upgrade

This upgrade adds an in-app Career Center and supporting APIs for notifications, interview scheduling, application-linked messaging, candidate analytics, and administration.

## New pages

- `/career-center.html` — candidate notifications, interview schedule, application-linked messages, career activity, and job recommendations. Employer accounts use the page for applicant conversations and interview scheduling.
- `/admin.html` — protected platform overview, recent users/jobs/applications, and job-listing visibility controls.

## New API endpoints

- `GET /api/notifications` — current user's notifications and unread count.
- `PATCH /api/notifications/:id/read` — mark one owned notification read.
- `POST /api/notifications/read-all` — mark all of the current user's notifications read.
- `GET /api/interviews` — interviews visible to the signed-in candidate, employer, or administrator.
- `POST /api/interviews` — employer schedules an interview for an application belonging to that employer.
- `PATCH /api/interviews/:id` — employer/admin updates an interview status.
- `GET /api/messages` — conversations attached to the user's applications.
- `GET /api/messages/:applicationId` — read a conversation the user is allowed to access.
- `POST /api/messages/:applicationId` — send a message to the other party on that application.
- `GET /api/analytics/me` — candidate activity summary and ranked job recommendations.
- `GET /api/admin/overview`, `GET /api/admin/users`, `PATCH /api/admin/jobs/:id/status` — administrator-only controls.

The server creates in-app notifications when candidates apply, employers change application status, interviews are scheduled/cancelled, and messages are sent. These are in-app notifications; email, SMS, push delivery, and external calendar sync are not included in this batch.

## Configure an administrator

There is deliberately no public admin registration or endpoint that lets a user promote themselves.

1. Create the account you want to use as the administrator through the existing registration flow.
2. Add this line to the local `.env` file in the project root (use the exact email registered to that account):
   `ADMIN_EMAIL=your-admin-email@example.com`
3. Restart the server. On startup, the account matching `ADMIN_EMAIL` is assigned the `admin` role.
4. Sign in with that account and open `/admin.html`.

For Render, set `ADMIN_EMAIL` in the service's Environment settings, then redeploy/restart. Never commit real credentials or secrets to GitHub. If you change the configured email, the old account is not automatically demoted; change roles deliberately through your trusted database administration process.

## Recommended manual verification

1. Start the app and check `/api/health` returns `{ "status": "ok" }`.
2. Sign in as a candidate, apply to an active job, and confirm an application notification appears in Career Center.
3. Sign in as the employer who owns that job, update the application status, and confirm the candidate receives a notification.
4. From the employer Career Center, schedule an interview using an application ID shown in the employer applicant list. Confirm the candidate sees it.
5. Send a message from either side and verify the other side can read and reply to it.
6. Sign in as the configured admin and verify the dashboard loads. Confirm non-admin accounts receive a forbidden response from admin endpoints.
7. Test on desktop and mobile, and check the server console for errors.

This document describes the intended endpoints and test plan. The implementation has been committed to the repository, but browser-level and end-to-end tests still need to be run locally.


## Security and production configuration

- Set a strong, private `SESSION_SECRET` environment variable in production. The server intentionally refuses to start in production if it is missing.
- On Render, set `NODE_ENV=production` and `SESSION_SECRET` in the service's Environment settings. HTTPS cookies are enabled automatically when `NODE_ENV=production`; the server trusts one reverse proxy for Render's HTTPS termination.
- Keep the local development fallback secret only for local use. Never commit `.env` or real secrets.
- Login and registration endpoints for candidates and employers are limited to 20 attempts per IP and endpoint per 15-minute window. The current limiter is in-memory and resets on restart; deployments with multiple server instances should use a shared rate-limit store.
- Session IDs are regenerated when candidate or employer accounts register or log in. JSON and form request bodies are capped at 1 MB.
- After pulling, test candidate and employer registration/login, logout, the Remember Me option, and all existing Career Center/admin flows. These changes have passed JavaScript syntax checks; full browser and deployment tests still need to be run.
