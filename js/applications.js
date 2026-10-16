'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const list = document.querySelector('#applicationsList');
    const count = document.querySelector('#applicationCount');
    const searchInput = document.querySelector('#applicationSearch');
    const statusFilter = document.querySelector('#applicationStatusFilter');
    const sortSelect = document.querySelector('#applicationSort');
    const filterSummary = document.querySelector('#applicationFilterSummary');
    const clearFilters = document.querySelector('#clearApplicationFilters');
    const exportButton = document.querySelector('#exportApplications');
    const printButton = document.querySelector('#printApplications');
    const statusOverview = document.querySelector('#applicationStatusOverview');
    let allApplications = [];
    let visibleApplications = [];
    const requestedApplicationId = Number(new URLSearchParams(window.location.search).get('applicationId')) || 0;
    let initialDeepLinkHandled = false;

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function statusLabel(status) {
        const labels = { new: 'Applied', reviewing: 'Under Review', shortlisted: 'Shortlisted', interview: 'Interview', hired: 'Hired', rejected: 'Rejected' };
        return labels[status] || 'Applied';
    }

    function formatApplicationDate(value, fallback = 'Date unavailable') {
        if (!value) return fallback;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
    }

    function nextStepForStatus(status) {
        const guidance = {
            new: 'Your application has been submitted. Keep an eye out for an update from the employer.',
            reviewing: 'The employer is reviewing your application. Prepare to explain how your skills fit the role.',
            shortlisted: 'You have been shortlisted. Check your messages and get ready for the next hiring step.',
            interview: 'An interview is in progress or being arranged. Review the job requirements and prepare questions.',
            hired: 'Congratulations! Review any offer details and confirm the next steps with the employer.',
            rejected: 'This application has closed without a match. Keep applying to roles that fit your skills.'
        };
        return guidance[status] || guidance.new;
    }


    const interviewPrepTasks = [
        'Review the job description and required skills',
        'Prepare examples of relevant projects or experience',
        'Practice a short introduction about yourself',
        'Write down questions to ask the employer',
        'Check the interview time, link, or location'
    ];

    function getInterviewPrepKey(applicationId) {
        return 'jobsite:interview-prep:' + String(applicationId);
    }

    function getInterviewNotesKey(applicationId) {
        return 'jobsite:interview-notes:' + String(applicationId);
    }

    function readInterviewNotes(applicationId) {
        try {
            return localStorage.getItem(getInterviewNotesKey(applicationId)) || '';
        } catch (_) {
            return '';
        }
    }

    function renderInterviewNotes(app) {
        if (!['shortlisted', 'interview'].includes(String(app.status || ''))) return '';
        return `
            <div class="application-interview-notes">
                <label for="interview-notes-${escapeHtml(app.id)}">My interview notes</label>
                <textarea id="interview-notes-${escapeHtml(app.id)}" data-interview-notes-app="${escapeHtml(app.id)}" maxlength="1500" rows="3" placeholder="Add talking points, examples, or questions for this role...">${escapeHtml(readInterviewNotes(app.id))}</textarea>
                <div class="application-interview-notes-footer">
                    <span data-interview-notes-count="${escapeHtml(app.id)}">${readInterviewNotes(app.id).length}/1500 characters</span>
                    <span data-interview-notes-status="${escapeHtml(app.id)}" aria-live="polite">Saved on this device</span>
                </div>
            </div>
        `;
    }

    function readInterviewPrep(applicationId) {
        try {
            const parsed = JSON.parse(localStorage.getItem(getInterviewPrepKey(applicationId)) || '[]');
            return Array.isArray(parsed) ? parsed.filter(index => Number.isInteger(index) && index >= 0 && index < interviewPrepTasks.length) : [];
        } catch (_) {
            return [];
        }
    }

    function renderInterviewPrep(app) {
        if (!['shortlisted', 'interview'].includes(String(app.status || ''))) return '';
        const completed = readInterviewPrep(app.id);
        return `
            <section class="application-interview-prep" aria-label="Interview preparation checklist">
                <div class="application-interview-prep-heading">
                    <strong>Interview prep</strong>
                    <span data-prep-progress="${escapeHtml(app.id)}">${completed.length}/${interviewPrepTasks.length} ready</span>
                </div>
                <div class="application-interview-prep-tasks">
                    ${interviewPrepTasks.map((task, index) => `
                        <label>
                            <input type="checkbox" data-prep-app="${escapeHtml(app.id)}" data-prep-task="${index}" ${completed.includes(index) ? 'checked' : ''}>
                            <span>${escapeHtml(task)}</span>
                        </label>
                    `).join('')}
                </div>
                <p class="application-interview-prep-note">Checklist is saved in this browser on this device.</p>
            </section>
        `;
    }

    function waitingAgeForApplication(app) {
        const status = String(app.status || 'new');
        if (status !== 'new' && status !== 'reviewing') return '';
        const appliedAt = new Date(app.applied_at);
        if (!app.applied_at || Number.isNaN(appliedAt.getTime())) return '';
        const days = Math.max(0, Math.floor((Date.now() - appliedAt.getTime()) / 86400000));
        if (days >= 14) return '<span class="application-waiting-age is-long">Waiting ' + days + ' days for an update</span>';
        if (days >= 7) return '<span class="application-waiting-age is-medium">Waiting ' + days + ' days for an update</span>';
        return '';
    }

    function renderStatusOverview() {
        const totals = { new: 0, reviewing: 0, shortlisted: 0, interview: 0, hired: 0, rejected: 0 };
        allApplications.forEach(app => {
            const status = String(app.status || 'new');
            if (Object.prototype.hasOwnProperty.call(totals, status)) totals[status] += 1;
            else totals.new += 1;
        });
        Object.entries(totals).forEach(([status, total]) => {
            const value = document.querySelector('#statusCount' + status.charAt(0).toUpperCase() + status.slice(1));
            if (value) value.textContent = String(total);
        });
        if (statusOverview) {
            statusOverview.querySelectorAll('[data-status-filter]').forEach(button => {
                const active = statusFilter.value === button.dataset.statusFilter;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', String(active));
            });
        }
    }

    function applyFilters() {
        renderStatusOverview();
        const query = String(searchInput.value || '').trim().toLowerCase();
        const selectedStatus = statusFilter.value;
        let filtered = allApplications.filter(app => {
            const matchesStatus = selectedStatus === 'all' || String(app.status || 'new') === selectedStatus;
            const haystack = [app.title, app.company, app.location, app.employment_type].join(' ').toLowerCase();
            return matchesStatus && (!query || haystack.includes(query));
        });

        // Notification deep links should take priority over stale tracker filters.
        const linkedApplicationExists = requestedApplicationId > 0 &&
            allApplications.some(app => Number(app.id) === requestedApplicationId);
        if (linkedApplicationExists && !initialDeepLinkHandled &&
            !filtered.some(app => Number(app.id) === requestedApplicationId)) {
            searchInput.value = '';
            statusFilter.value = 'all';
            filtered = allApplications.slice();
        }

        filtered.sort((a, b) => {
            const dateA = new Date(a.applied_at).getTime();
            const dateB = new Date(b.applied_at).getTime();
            const safeDateA = Number.isFinite(dateA) ? dateA : 0;
            const safeDateB = Number.isFinite(dateB) ? dateB : 0;
            if (sortSelect.value === 'oldest') return safeDateA - safeDateB;
            if (sortSelect.value === 'status') return statusLabel(a.status).localeCompare(statusLabel(b.status)) || safeDateB - safeDateA;
            if (sortSelect.value === 'waiting') {
                const pendingA = ['new', 'reviewing'].includes(String(a.status || 'new')) ? 1 : 0;
                const pendingB = ['new', 'reviewing'].includes(String(b.status || 'new')) ? 1 : 0;
                return pendingB - pendingA || safeDateA - safeDateB;
            }
            return safeDateB - safeDateA;
        });
        renderFiltered(filtered);
        if (requestedApplicationId > 0 && !initialDeepLinkHandled) {
            initialDeepLinkHandled = true;
            const target = document.getElementById('application-' + requestedApplicationId);
            if (target) {
                target.setAttribute('tabindex', '-1');
                window.setTimeout(() => {
                    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
                    target.focus({ preventScroll: true });
                }, 80);
            } else if (allApplications.some(app => Number(app.id) === requestedApplicationId)) {
                filterSummary.textContent = 'The linked application is hidden by your current filters. Clear filters to view it.';
            } else {
                filterSummary.textContent = 'The linked application could not be found in your application list.';
            }
        }
    }

    function renderFiltered(applications) {
        visibleApplications = applications;
        if (exportButton) exportButton.disabled = applications.length === 0;
        if (printButton) printButton.disabled = applications.length === 0;
        count.textContent = String(allApplications.length);
        filterSummary.textContent = applications.length === allApplications.length
            ? allApplications.length + (allApplications.length === 1 ? ' application' : ' applications')
            : 'Showing ' + applications.length + ' of ' + allApplications.length + ' applications';
        if (!applications.length) {
            if (allApplications.length) {
                list.innerHTML = '<div class="applications-empty"><div class="applications-empty-icon">⌕</div><h2>No matching applications</h2><p>Try another keyword or status, or clear your filters.</p><button class="btn btn-primary" type="button" id="emptyClearFilters">Clear filters</button></div>';
                document.querySelector('#emptyClearFilters')?.addEventListener('click', resetFilters);
            } else {
                list.innerHTML = '<div class="applications-empty"><div class="applications-empty-icon">💼</div><h2>No applications yet</h2><p>Find a job that matches your skills and start your career journey.</p><a class="btn btn-primary" href="/">Browse Jobs</a></div>';
            }
            return;
        }

        list.innerHTML = applications.map(app => {
            const history = Array.isArray(app.history) && app.history.length ? app.history : [{ status: app.status, changed_at: app.applied_at }];
            return `
                <article class="application-card ${Number(app.id) === requestedApplicationId ? 'application-card--highlight' : ''}" id="application-${escapeHtml(app.id)}">
                    <div class="application-card-main">
                        <span class="application-company">${escapeHtml(app.company || 'Company')}</span>
                        <h2>${escapeHtml(app.title || 'Job')}</h2>
                        <div class="application-meta">
                            <span>${escapeHtml(app.location || 'Remote')}</span>
                            ${app.employment_type ? `<span>${escapeHtml(app.employment_type)}</span>` : ''}
                            ${app.salary ? `<span>${escapeHtml(app.salary)}</span>` : ''}
                        </div>
                        <div class="application-assets">
                            <span class="application-resume-badge ${app.resume_id ? 'has-resume' : 'no-resume'}">${app.resume_id ? '✓ Resume attached' : 'No resume attached'}</span>
                            ${app.resume_name ? `<span class="application-resume-name">${escapeHtml(app.resume_name)}</span>` : ''}
                            <span class="application-job-state ${app.job_status === 'active' ? 'is-open' : 'is-closed'}">${app.job_status === 'active' ? 'Job active' : 'Job closed'}</span>
                        </div>
                    </div>
                    <div class="application-card-side">
                        <span class="application-status application-status--${escapeHtml(app.status)}">${statusLabel(app.status)}</span>
                        <small>Applied ${escapeHtml(formatApplicationDate(app.applied_at))}</small>
                        ${waitingAgeForApplication(app)}
                        <p class="application-next-step"><b>Next step:</b> ${escapeHtml(nextStepForStatus(app.status))}</p>
                        ${renderInterviewPrep(app)}
                        ${renderInterviewNotes(app)}
                        <div class="application-timeline-mini" aria-label="Application status history">${history.map(item => `<span><b>${escapeHtml(statusLabel(item.status))}</b><em>${escapeHtml(formatApplicationDate(item.changed_at))}</em></span>`).join('')}</div>
                        <a href="/?job=${encodeURIComponent(app.job_id)}" class="application-view-link">View job details →</a>
                    </div>
                </article>
            `;
        }).join('');
    }

    function exportVisibleApplications() {
        if (!visibleApplications.length) return;
        const columns = [
            ['Job Title', app => app.title],
            ['Company', app => app.company],
            ['Status', app => statusLabel(app.status)],
            ['Applied Date', app => formatApplicationDate(app.applied_at, '')],
            ['Location', app => app.location],
            ['Employment Type', app => app.employment_type],
            ['Salary', app => app.salary],
            ['Resume Attached', app => app.resume_id ? 'Yes' : 'No'],
            ['Resume Name', app => app.resume_name]
        ];
        const csvCell = value => { const text = String(value ?? ''); const safe = (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) ? "'" + text : text; return '"' + safe.replace(/"/g, '""') + '"'; };
        const rows = [
            columns.map(column => csvCell(column[0])).join(','),
            ...visibleApplications.map(app => columns.map(column => csvCell(column[1](app))).join(','))
        ];
        const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'jobsite-applications-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function resetFilters() {
        searchInput.value = '';
        statusFilter.value = 'all';
        sortSelect.value = 'newest';
        applyFilters();
    }

    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    clearFilters.addEventListener('click', resetFilters);
    exportButton?.addEventListener('click', exportVisibleApplications);
    printButton?.addEventListener('click', () => {
        if (visibleApplications.length) window.print();
    });

    list.addEventListener('input', event => {
        const textarea = event.target.closest('textarea[data-interview-notes-app]');
        if (!textarea) return;
        const applicationId = textarea.dataset.interviewNotesApp;
        const count = list.querySelector('[data-interview-notes-count="' + CSS.escape(applicationId) + '"]');
        const status = list.querySelector('[data-interview-notes-status="' + CSS.escape(applicationId) + '"]');
        if (count) count.textContent = textarea.value.length + '/1500 characters';
        try {
            localStorage.setItem(getInterviewNotesKey(applicationId), textarea.value);
            if (status) status.textContent = 'Saved on this device';
        } catch (_) {
            if (status) status.textContent = 'Could not save — check browser storage';
        }
    });

    list.addEventListener('change', event => {
        const checkbox = event.target.closest('input[data-prep-app][data-prep-task]');
        if (!checkbox) return;
        const applicationId = checkbox.dataset.prepApp;
        const taskIndex = Number(checkbox.dataset.prepTask);
        if (!applicationId || !Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= interviewPrepTasks.length) return;
        const completed = new Set(readInterviewPrep(applicationId));
        if (checkbox.checked) completed.add(taskIndex);
        else completed.delete(taskIndex);
        try {
            localStorage.setItem(getInterviewPrepKey(applicationId), JSON.stringify([...completed].sort((a, b) => a - b)));
            const progress = Array.from(list.querySelectorAll('[data-prep-progress]')).find(el => el.dataset.prepProgress === applicationId);
            if (progress) progress.textContent = completed.size + '/' + interviewPrepTasks.length + ' ready';
        } catch (_) {
            const card = checkbox.closest('.application-interview-prep');
            if (card) {
                const note = card.querySelector('.application-interview-prep-note');
                if (note) note.textContent = 'Could not save progress in this browser. Check browser storage settings.';
            }
        }
    });
    statusOverview?.querySelectorAll('[data-status-filter]').forEach(button => {
        button.addEventListener('click', () => {
            statusFilter.value = statusFilter.value === button.dataset.statusFilter ? 'all' : button.dataset.statusFilter;
            applyFilters();
        });
    });

    try {
        const response = await fetch('/api/applications', { credentials: 'include' });
        if (response.status === 401 || response.status === 403) {
            sessionStorage.setItem('jobsite_redirect_after_login', window.location.pathname + window.location.search + window.location.hash);
            list.innerHTML = '<div class="applications-empty"><h2>Please log in</h2><p>Log in to view your applications.</p><a class="btn btn-primary" href="/">Go to JobSite</a></div>';
            filterSummary.textContent = 'Sign in to see your personal application tracker.';
            return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load applications.');
        allApplications = Array.isArray(data.applications) ? data.applications : [];
        applyFilters();
    } catch (error) {
        list.innerHTML = '<div class="applications-empty"><h2>Could not load applications</h2><p>' + escapeHtml(error.message) + '</p><button class="btn btn-primary" type="button" id="retryApplications">Try Again</button></div>';
        document.querySelector('#retryApplications')?.addEventListener('click', () => window.location.reload());
    }
});
