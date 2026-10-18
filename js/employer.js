'use strict';

const EMPLOYER_LOAD_DELAY = 2000;

const state = {
    user: null,
    company: null,
    jobs: [],
    activeJobId: null,
    editingJobId: null,
    activeApplicationId: null,
    applicants: [],
    applicantSearch: '',
    applicantStatus: 'all',
    applicantMatch: 'all',
    applicantSort: 'match-desc',
    analytics: null
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {})
        }
    });

    let data = {};
    try {
        data = await response.json();
    } catch (_) {}

    if (!response.ok) {
        const error = new Error(data.error || 'Something went wrong.');
        error.status = response.status;
        throw error;
    }

    return data;
}

function showGateMessage(selector, message) {
    const element = $(selector);
    element.textContent = message || '';
    element.className = message ? 'employer-form-message show error' : 'employer-form-message';
}

function setApplicantActionMessage(message, kind = '') {
    const element = $('#applicantActionMessage');
    if (!element) return;
    element.textContent = message || '';
    element.className = 'employer-action-feedback' + (kind ? ' is-' + kind : '');
    element.hidden = !message;
}

function updateEmployerHeaderAction(loggedIn) {
    document.body.classList.toggle('employer-logged-in', loggedIn);
    document.body.classList.toggle('employer-logged-out', !loggedIn);
    const button = $('#employerLogout');
    button.hidden = false;
    button.textContent = loggedIn ? 'Log Out' : 'Back to Homepage';
    button.dataset.action = loggedIn ? 'logout' : 'home';
}

function showDashboard() {
    $('#employerGate').hidden = true;
    $('#employerDashboard').hidden = false;
    updateEmployerHeaderAction(true);
}

function showEmployerLoading() {
    const screen = $('#employerLoadingScreen');
    screen.classList.add('is-visible');
    screen.setAttribute('aria-hidden', 'false');
}

function hideEmployerLoading() {
    const screen = $('#employerLoadingScreen');
    screen.classList.remove('is-visible');
    screen.setAttribute('aria-hidden', 'true');
}

async function withEmployerLoading(work) {
    showEmployerLoading();
    const startedAt = performance.now();

    try {
        return await work();
    } finally {
        const elapsed = performance.now() - startedAt;
        const remaining = Math.max(0, EMPLOYER_LOAD_DELAY - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remaining));
        hideEmployerLoading();
    }
}

function showGate() {
    $('#employerGate').hidden = false;
    $('#employerDashboard').hidden = true;
    updateEmployerHeaderAction(false);
}

function switchAuthTab(mode) {
    document.querySelectorAll('.employer-auth-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.authTab === mode);
    });

    $('#employerLoginForm').hidden = mode !== 'login';
    $('#employerRegisterForm').hidden = mode !== 'register';
}

function switchPanel(panelName) {
    document.querySelectorAll('.employer-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.panel === panelName);
    });

    document.querySelectorAll('.employer-panel').forEach((panel) => {
        const active = panel.id === 'panel-' + panelName;
        panel.hidden = !active;
        panel.classList.toggle('active', active);
    });

    if (panelName === 'overview') loadDashboard();
    if (panelName === 'jobs') loadJobs();
    if (panelName === 'analytics') loadAnalytics();
    if (panelName === 'applicants') {
        loadJobs().then(() => {
            if (state.activeJobId) {
                loadApplicants(state.activeJobId);
            }
        });
    }
    if (panelName === 'company') loadCompany();
}

function setField(id, value) {
    const element = $('#' + id);
    if (element) element.value = value ?? '';
}

const selectedScheduleDays = new Set();
let selectedScheduleFlexible = false;

function formatScheduleTime(value) {
    if (!value) return '';
    const parts = value.split(':').map(Number);
    if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return value;
    const [hour, minute] = parts;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return displayHour + ':' + String(minute).padStart(2, '0') + ' ' + suffix;
}

function buildJobSalary() {
    const min = $('#jobSalaryMin').value.trim();
    const max = $('#jobSalaryMax').value.trim();
    const money = (value) => Number(value).toLocaleString('en-PH', { maximumFractionDigits: 0 });
    if (min && max) return '₱' + money(min) + '–₱' + money(max) + '/month';
    if (min) return 'From ₱' + money(min) + '/month';
    if (max) return 'Up to ₱' + money(max) + '/month';
    return '';
}

function updateSchedulePreview() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((day) => selectedScheduleDays.has(day));
    const preview = $('#jobSchedulePreview');
    const hidden = $('#jobSchedule');
    const start = $('#jobScheduleStart')?.value || '';
    const end = $('#jobScheduleEnd')?.value || '';
    const flexibleButton = $('#jobScheduleFlexible');
    if (!preview || !hidden) return;

    const dayText = days.length === 7 ? 'Every day' : days.join(', ');
    const timeText = selectedScheduleFlexible
        ? 'Flexible hours'
        : start && end
            ? formatScheduleTime(start) + '–' + formatScheduleTime(end)
            : start
                ? 'Starts at ' + formatScheduleTime(start)
                : end
                    ? 'Ends at ' + formatScheduleTime(end)
                    : '';
    const parts = [];
    if (dayText) parts.push(dayText);
    if (timeText) parts.push(timeText);
    hidden.value = parts.join(' · ');
    preview.textContent = parts.length ? parts.join(' · ') : 'Choose work days and set start/end times, or select Flexible hours.';
    if (flexibleButton) {
        flexibleButton.classList.toggle('is-selected', selectedScheduleFlexible);
        flexibleButton.setAttribute('aria-pressed', String(selectedScheduleFlexible));
    }

    document.querySelectorAll('[data-schedule-preset]').forEach((button) => {
        const presetDays = {
            mwf: ['Mon', 'Wed', 'Fri'],
            weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            weekends: ['Sat', 'Sun'],
            everyday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        }[button.dataset.schedulePreset] || [];
        const active = presetDays.length === days.length && presetDays.every((day) => selectedScheduleDays.has(day));
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-schedule-day]').forEach((button) => {
        const active = selectedScheduleDays.has(button.dataset.scheduleDay);
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function restoreJobSchedule(value) {
    selectedScheduleDays.clear();
    selectedScheduleFlexible = false;
    setField('jobScheduleStart', '');
    setField('jobScheduleEnd', '');
    const text = String(value || '');
    const dayAliases = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
    const dayMatches = text.match(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun/g) || [];
    dayMatches.forEach((day) => selectedScheduleDays.add(dayAliases[day] || day));

    if (/flexible/i.test(text)) {
        selectedScheduleFlexible = true;
    } else {
        const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
        if (timeMatch) {
            const to24Hour = (hourText, minuteText, suffix) => {
                let hour = Number(hourText) % 12;
                if (suffix.toUpperCase() === 'PM') hour += 12;
                return String(hour).padStart(2, '0') + ':' + String(Number(minuteText || 0)).padStart(2, '0');
            };
            setField('jobScheduleStart', to24Hour(timeMatch[1], timeMatch[2], timeMatch[3]));
            setField('jobScheduleEnd', to24Hour(timeMatch[4], timeMatch[5], timeMatch[6]));
        }
    }
    updateSchedulePreview();
}

function getJobFormPayload() {
    return {
        title: $('#jobTitle').value.trim(),
        category: $('#jobCategory').value.trim(),
        employmentType: $('#jobEmploymentType').value,
        salary: buildJobSalary(),
        location: $('#jobLocation').value.trim(),
        workSchedule: $('#jobSchedule').value.trim(),
        applicationDeadline: $('#jobDeadline').value,
        status: $('#jobStatus').value,
        description: $('#jobDescription').value.trim(),
        responsibilities: $('#jobResponsibilities').value.trim(),
        qualifications: $('#jobQualifications').value.trim(),
        skills: $('#jobSkills').value.trim(),
        benefits: $('#jobBenefits').value.trim(),
        applicationRequirements: $('#jobApplicationRequirements').value.trim(),
        howToApply: $('#jobHowToApply').value.trim(),
        contactInformation: $('#jobContactInformation').value.trim()
    };
}

function openJobEditor(job = null) {
    state.editingJobId = job ? Number(job.id) : null;

    $('#jobEditorTitle').textContent = job ? 'Edit Job Posting' : 'Create a Job';
    $('#jobEditorSubmit').textContent = job ? 'Save Changes' : 'Publish Job';
    $('#jobEditorMessage').textContent = '';
    $('#jobEditorMessage').className = 'employer-form-message';

    setField('jobEditId', job?.id || '');
    setField('jobTitle', job?.title || '');
    setField('jobCategory', job?.category || '');
    setField('jobEmploymentType', job?.employment_type || '');
    const salaryParts = String(job?.salary || '').match(/[\\d,]+/g) || [];
    setField('jobSalaryMin', salaryParts[0] ? Number(salaryParts[0].replace(/,/g, '')) : '');
    setField('jobSalaryMax', salaryParts[1] ? Number(salaryParts[1].replace(/,/g, '')) : '');
    setField('jobLocation', job?.location || '');
    setField('jobSchedule', job?.work_schedule || '');
    restoreJobSchedule(job?.work_schedule || '');
    setField('jobDeadline', job?.application_deadline || '');
    setField('jobStatus', job?.status || 'active');
    setField('jobDescription', job?.description || '');
    setField('jobResponsibilities', job?.responsibilities || '');
    setField('jobQualifications', job?.qualifications || '');
    setField('jobSkills', Array.isArray(job?.skills) ? job.skills.join(', ') : '');
    setField('jobBenefits', job?.benefits || '');
    setField('jobApplicationRequirements', job?.application_requirements || '');
    setField('jobHowToApply', job?.how_to_apply || '');
    setField('jobContactInformation', job?.contact_information || '');

    $('#jobEditorModal').hidden = false;
    document.body.classList.add('employer-modal-open');
    $('#jobTitle').focus();
}

function closeJobEditor() {
    $('#jobEditorModal').hidden = true;
    document.body.classList.remove('employer-modal-open');
}

async function loadDashboard() {
    try {
        const data = await api('/api/employer/dashboard');

        $('#statActiveJobs').textContent = data.stats.activeJobs;
        $('#statApplicants').textContent = data.stats.totalApplicants;
        $('#statNewApplicants').textContent = data.stats.newApplicants;
        $('#statExpiring').textContent = data.stats.expiringSoon;

        const list = $('#recentApplications');

        if (!data.recentApplications.length) {
            list.innerHTML = '<div class="employer-empty">No applications yet. Publish a job to start receiving candidates.</div>';
            return;
        }

        list.innerHTML = data.recentApplications.map((application) => {
            return '<button type="button" class="employer-recent-item" data-open-job-applicants="' +
                escapeHtml(application.job_id) + '">' +
                '<span class="employer-recent-avatar">👤</span>' +
                '<span class="employer-recent-main"><strong>' +
                escapeHtml(application.applicant_name) +
                '</strong><small>' +
                escapeHtml(application.job_title) +
                '</small></span>' +
                '<span class="employer-status employer-status--' +
                escapeHtml(application.status) + '">' +
                escapeHtml(application.status) +
                '</span>' +
                '</button>';
        }).join('');
    } catch (error) {
        console.error('[Employer] dashboard:', error);
    }
}

function renderAnalytics(data) {
    const stats = data?.stats || {};
    $('#analyticsTotalApplicants').textContent = stats.totalApplicants ?? 0;
    $('#analyticsShortlisted').textContent = stats.shortlisted ?? 0;
    $('#analyticsInterview').textContent = stats.interview ?? 0;
    $('#analyticsHired').textContent = stats.hired ?? 0;
    $('#analyticsAverageMatch').textContent = Math.round(stats.averageMatch || 0) + '%';

    const statusOrder = ['new', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected'];
    const statusLabels = {
        new: 'New',
        reviewing: 'Reviewing',
        shortlisted: 'Shortlisted',
        interview: 'Interview',
        hired: 'Hired',
        rejected: 'Rejected'
    };
    const statusCounts = data?.statusCounts || {};
    const total = Number(stats.totalApplicants || 0);
    const hired = Number(statusCounts.hired ?? stats.hired ?? 0);
    const waitingReview = Number(statusCounts.new || 0);
    const hiringRate = total ? Math.round((hired / total) * 100) : 0;

    $('#analyticsHiringRate').textContent = hiringRate + '%';
    $('#analyticsReviewQueue').textContent = waitingReview;
    $('#analyticsPipelineInsight').textContent = !total
        ? 'No applications yet. Publish a job and review incoming candidates to start building your hiring pipeline.'
        : waitingReview
            ? waitingReview + ' new application' + (waitingReview === 1 ? ' is' : 's are') + ' waiting for review. Start with these candidates, then update their status as they progress.'
            : hired
                ? 'You have hired ' + hired + ' of ' + total + ' applicant' + (total === 1 ? '' : 's') + '. Keep application statuses up to date to track your pipeline.'
                : 'No new applications are waiting for review. Check shortlisted candidates and interviews for your next hiring step.';

    $('#analyticsStatusList').innerHTML = statusOrder.map((status) => {
        const count = Number(statusCounts[status] || 0);
        const percent = total ? Math.round((count / total) * 100) : 0;
        return '<div class="employer-analytics-status-row">' +
            '<div><strong>' + escapeHtml(statusLabels[status]) + '</strong><span>' + count + ' applicant' + (count === 1 ? '' : 's') + '</span></div>' +
            '<div class="employer-analytics-bar"><i style="width:' + percent + '%"></i></div>' +
            '<b>' + percent + '%</b>' +
            '</div>';
    }).join('');

    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    $('#analyticsJobsList').innerHTML = jobs.length
        ? jobs.map((job) => {
            return '<div class="employer-analytics-job-row">' +
                '<div><strong>' + escapeHtml(job.title) + '</strong><span>' +
                escapeHtml(job.statusLabel) + ' · ' + Number(job.applicants) + ' applicants</span></div>' +
                '<strong>' + Math.round(job.averageMatch || 0) + '%</strong>' +
                '</div>';
        }).join('')
        : '<div class="employer-empty">No job postings yet.</div>';
}

async function loadAnalytics() {
    try {
        const data = await api('/api/employer/analytics');
        state.analytics = data;
        renderAnalytics(data);
    } catch (error) {
        console.error('[Employer] analytics:', error);
        $('#analyticsStatusList').innerHTML = '<div class="employer-empty">Unable to load analytics.</div>';
        $('#analyticsJobsList').innerHTML = '';
    }
}

async function loadJobs() {
    try {
        const data = await api('/api/employer/jobs');
        state.jobs = data.jobs || [];

        const list = $('#employerJobsList');

        if (!state.jobs.length) {
            list.innerHTML =
                '<div class="employer-empty employer-empty--large">' +
                '<strong>No job postings yet.</strong>' +
                '<span>Create your first posting to start building your applicant pool.</span>' +
                '<button type="button" class="btn btn-primary" id="emptyPostJob">+ Post a Job</button>' +
                '</div>';
        } else {
            list.innerHTML = state.jobs.map((job) => {
                const deadlineText = String(job.application_deadline || '');
                const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(deadlineText)
                    ? new Date(deadlineText + 'T23:59:59')
                    : null;
                const deadlinePassed = job.status === 'active' &&
                    deadlineDate &&
                    !Number.isNaN(deadlineDate.getTime()) &&
                    deadlineDate < new Date();

                const statusLabel = job.status === 'closed'
                    ? 'Closed'
                    : job.status === 'draft'
                        ? 'Draft'
                        : deadlinePassed
                            ? 'Deadline Passed'
                            : 'Active';

                return '<article class="employer-job-card">' +
                    '<div class="employer-job-card-top">' +
                        '<div>' +
                            '<span class="employer-status employer-status--' + escapeHtml(job.status) + '">' + statusLabel + '</span>' +
                            '<h3>' + escapeHtml(job.title) + '</h3>' +
                            '<p>' + escapeHtml(job.location || 'Remote') + ' · ' + escapeHtml(job.employment_type || 'Flexible') +
                                (job.application_deadline ? ' · Deadline: ' + escapeHtml(job.application_deadline) : '') +
                            '</p>' +
                        '</div>' +
                        '<strong class="employer-applicant-count">' + Number(job.applicant_count || 0) + '<small>Applicants</small></strong>' +
                    '</div>' +
                    '<div class="employer-job-skills">' +
                        (job.skills || []).slice(0, 6).map((skill) => '<span>' + escapeHtml(skill) + '</span>').join('') +
                    '</div>' +
                    '<div class="employer-job-actions">' +
                        '<button type="button" class="employer-secondary-button" data-edit-job="' + job.id + '">Edit</button>' +
                        '<button type="button" class="employer-secondary-button" data-view-applicants="' + job.id + '">Applicants</button>' +
                        '<select class="employer-inline-select" data-job-status="' + job.id + '">' +
                            '<option value="active"' + (job.status === 'active' ? ' selected' : '') + '>Active</option>' +
                            '<option value="draft"' + (job.status === 'draft' ? ' selected' : '') + '>Draft</option>' +
                            '<option value="closed"' + (job.status === 'closed' ? ' selected' : '') + '>Closed</option>' +
                        '</select>' +
                    '</div>' +
                '</article>';
            }).join('');
        }

        const select = $('#applicantJobSelect');
        select.innerHTML = state.jobs.length
            ? state.jobs.map((job) =>
                '<option value="' + job.id + '">' + escapeHtml(job.title) + '</option>'
            ).join('')
            : '<option value="">No jobs yet</option>';

        if (state.activeJobId && state.jobs.some((job) => Number(job.id) === Number(state.activeJobId))) {
            select.value = state.activeJobId;
        } else if (state.jobs.length) {
            state.activeJobId = Number(state.jobs[0].id);
            select.value = state.activeJobId;
        }

        return state.jobs;
    } catch (error) {
        $('#employerJobsList').innerHTML =
            '<div class="employer-empty">Unable to load your job postings.</div>';
        throw error;
    }
}

function setJobActionMessage(message, kind = '') {
    const element = $('#jobActionMessage');
    if (!element) return;
    element.textContent = message || '';
    element.className = 'employer-action-feedback' + (kind ? ' is-' + kind : '');
    element.hidden = !message;
}

async function updateJobStatus(jobId, status) {
    const select = $('#employerJobsList [data-job-status="' + CSS.escape(String(jobId)) + '"]');
    if (select) select.disabled = true;
    setJobActionMessage('Updating job posting status…');

    try {
        await api('/api/employer/jobs/' + jobId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });

        setJobActionMessage('Job posting status changed to ' + status + '.', 'success');
        await loadJobs();
        await loadDashboard();
    } catch (error) {
        setJobActionMessage(error.message || 'Could not update this job posting. Please try again.', 'error');
        await loadJobs().catch(() => {});
        await loadDashboard().catch(() => {});
    } finally {
        const refreshedSelect = $('#employerJobsList [data-job-status="' + CSS.escape(String(jobId)) + '"]');
        if (refreshedSelect) refreshedSelect.disabled = false;
    }
}

function getFilteredApplicants() {
    const query = state.applicantSearch.trim().toLowerCase();
    const minimumMatch = state.applicantMatch === 'all' ? 0 : Number(state.applicantMatch);

    return state.applicants.filter((applicant) => {
        const searchable = [
            applicant.full_name, applicant.email, applicant.degree, applicant.location,
            ...(applicant.skills || []), ...(applicant.matchingSkills || []), ...(applicant.missingSkills || [])
        ].join(' ').toLowerCase();

        return (!query || searchable.includes(query)) &&
            (state.applicantStatus === 'all' || applicant.status === state.applicantStatus) &&
            Number(applicant.matchScore || 0) >= minimumMatch;
    }).sort((a, b) => {
        const timestamp = (value) => {
            if (!value) return 0;
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
        };
        switch (state.applicantSort) {
            case 'match-asc': return Number(a.matchScore || 0) - Number(b.matchScore || 0);
            case 'newest': return timestamp(b.applied_at || b.created_at) - timestamp(a.applied_at || a.created_at);
            case 'oldest': return timestamp(a.applied_at || a.created_at) - timestamp(b.applied_at || b.created_at);
            case 'name-asc': return String(a.full_name || '').localeCompare(String(b.full_name || ''));
            default: return Number(b.matchScore || 0) - Number(a.matchScore || 0);
        }
    });
}

function exportFilteredApplicants() {
    const applicants = getFilteredApplicants();
    if (!applicants.length) {
        setApplicantActionMessage('There are no applicants in the current results to export.', 'error');
        return;
    }

    const activeJob = state.jobs.find((job) => Number(job.id) === Number(state.activeJobId));
    const columns = [
        ['Job Title', () => activeJob?.title || ''],
        ['Applicant Name', (applicant) => applicant.full_name],
        ['Email', (applicant) => applicant.email],
        ['Application ID', (applicant) => applicant.application_id],
        ['Status', (applicant) => applicant.status],
        ['Match Score', (applicant) => Number(applicant.matchScore || 0) + '%'],
        ['Applied Date', (applicant) => formatApplicantDate(applicant.applied_at || applicant.created_at)],
        ['Education', (applicant) => applicant.degree],
        ['Location', (applicant) => applicant.location],
        ['Matched Skills', (applicant) => (applicant.matchingSkills || []).join('; ')],
        ['Missing Skills', (applicant) => (applicant.missingSkills || []).join('; ')]
    ];
    const csvCell = (value) => { const text = String(value ?? ''); const safe = (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) ? "'" + text : text; return '"' + safe.replace(/"/g, '""') + '"'; };
    const rows = [
        columns.map(([heading]) => csvCell(heading)).join(','),
        ...applicants.map((applicant) => columns.map(([, value]) => csvCell(value(applicant))).join(','))
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jobsite-applicants-' + (activeJob ? String(activeJob.title || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'job') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setApplicantActionMessage('Exported ' + applicants.length + ' applicant' + (applicants.length === 1 ? '' : 's') + ' from the current filtered results.', 'success');
}

async function copyApplicantEmail(button) {
    const email = String(button?.dataset.email || '').trim();
    if (!email) {
        setApplicantActionMessage('This applicant does not have an email address listed.', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(email);
        setApplicantActionMessage('Copied ' + email + ' to your clipboard.', 'success');
    } catch (_) {
        setApplicantActionMessage('Clipboard access is unavailable. Open View Profile to see the applicant email and copy it manually.', 'error');
    }
}

function formatApplicantDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderApplicantPipelineCounts() {
    const statuses = ['all', 'new', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected'];
    statuses.forEach((status) => {
        const count = status === 'all'
            ? state.applicants.length
            : state.applicants.filter((applicant) => String(applicant.status || 'new') === status).length;
        const value = $('#applicantPipelineCounts [data-pipeline-count="' + status + '"]');
        if (value) value.textContent = String(count);
    });
    $('#applicantPipelineCounts')?.querySelectorAll('[data-pipeline-status]').forEach((button) => {
        const active = state.applicantStatus === button.dataset.pipelineStatus;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function renderApplicants() {
    renderApplicantPipelineCounts();
    const applicants = getFilteredApplicants();
    const exportButton = $('#exportApplicants');
    if (exportButton) exportButton.disabled = applicants.length === 0;
    const total = state.applicants.length;
    const topApplicant = applicants[0];
    const summary = $('#applicantSummary');
    const list = $('#applicantsList');
    if (!summary || !list) {
        console.error('[Employer] Applicant list containers are missing from the page.');
        setApplicantActionMessage('The applicant list could not render because part of the page is missing. Refresh and try again.', 'error');
        return;
    }

    summary.innerHTML =
        '<strong>' + applicants.length + '</strong> of <strong>' + total + '</strong> applicants shown' +
        (topApplicant ? ' · <strong>Top result: ' + escapeHtml(topApplicant.full_name) + ' (' + Number(topApplicant.matchScore) + '%)</strong>' : '');

    if (!total) {
        list.innerHTML = '<div class="employer-empty employer-empty--large"><strong>No applicants yet.</strong><span>Applications will appear here once candidates apply to this job.</span></div>';
        return;
    }
    if (!applicants.length) {
        $('#applicantsList').innerHTML = '<div class="employer-empty employer-empty--large"><strong>No applicants match these filters.</strong><span>Try clearing the search or changing the filters.</span></div>';
        return;
    }

    $('#applicantsList').innerHTML = applicants.map((applicant, index) => {
        return '<article class="employer-applicant-card">' +
            '<div class="employer-applicant-score"><strong>#' + Number(applicant.rank || index + 1) + '</strong><span>' + Number(applicant.matchScore) + '% match</span></div>' +
            '<div class="employer-applicant-main">' +
                '<div class="employer-applicant-heading"><div><h3>' + escapeHtml(applicant.full_name) + '</h3><p>' + escapeHtml(applicant.email) + '</p></div>' +
                '<span class="employer-status employer-status--' + escapeHtml(applicant.status) + '">' + escapeHtml(applicant.status) + '</span></div>' +
                '<div class="employer-applicant-meta"><span>Application #' + Number(applicant.application_id) + '</span>' +
                (formatApplicantDate(applicant.applied_at || applicant.created_at) ? '<span>Applied ' + escapeHtml(formatApplicantDate(applicant.applied_at || applicant.created_at)) + '</span>' : '') +
                '<span>' + escapeHtml(applicant.degree || 'Education not listed') + '</span><span>' + escapeHtml(applicant.location || 'Location not listed') + '</span></div>' +
                '<div class="employer-match-skills"><div><small>Matched</small>' +
                (applicant.matchingSkills || []).slice(0, 7).map((skill) => '<span class="match-have">' + escapeHtml(skill) + '</span>').join('') + '</div><div><small>Missing</small>' +
                (applicant.missingSkills || []).slice(0, 5).map((skill) => '<span class="match-missing">' + escapeHtml(skill) + '</span>').join('') + '</div></div>' +
                '<div class="employer-applicant-actions"><button type="button" class="employer-secondary-button" data-view-applicant="' + applicant.application_id + '">View Profile</button>' +
                (applicant.email ? '<button type="button" class="employer-secondary-button employer-copy-email" data-copy-applicant-email="' + escapeHtml(applicant.application_id) + '" data-email="' + escapeHtml(applicant.email) + '">Copy email</button>' : '') +
                '<select class="employer-inline-select" data-application-status="' + applicant.application_id + '">' +
                ['new','reviewing','shortlisted','interview','hired','rejected'].map((status) => '<option value="' + status + '"' + (applicant.status === status ? ' selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>').join('') +
                '</select></div></div></article>';
    }).join('');
}

async function loadApplicants(jobId) {
    if (!jobId) {
        state.applicants = [];
        const summary = $('#applicantSummary');
        const list = $('#applicantsList');
        if (summary) summary.textContent = '';
        if (list) list.innerHTML = '<div class="employer-empty">Select a job to view applicants.</div>';
        renderApplicantPipelineCounts();
        return;
    }

    state.activeJobId = Number(jobId);
    try {
        const data = await api('/api/employer/jobs/' + jobId + '/applicants');
        state.applicants = data.applicants || [];
        renderApplicants();
    } catch (error) {
        state.applicants = [];
        const list = $('#applicantsList');
        if (list) list.innerHTML = '<div class="employer-empty">Unable to load applicants.</div>';
        const summary = $('#applicantSummary');
        if (summary) summary.textContent = 'Unable to load applicants.';
        renderApplicantPipelineCounts();
    }
}
function renderApplicantTags(selector, skills, emptyText) {
    const element = $(selector);
    if (!element) {
        console.warn('[Employer] Applicant profile target not found:', selector);
        return;
    }
    const values = Array.isArray(skills) ? skills : [];

    element.innerHTML = values.length
        ? values.map((skill) => '<span>' + escapeHtml(skill) + '</span>').join('')
        : '<em>' + escapeHtml(emptyText) + '</em>';
}

function getApplicantNotesStorageKey(applicationId) {
    const account = state.company?.id ?? state.user?.id ?? state.company?.email ?? state.user?.email ?? 'employer';
    return 'jobsite:employer-notes:' + String(account) + ':' + String(applicationId);
}

function loadApplicantNotes(applicationId) {
    const textarea = $('#applicantPrivateNotes');
    const message = $('#applicantNotesMessage');
    if (!textarea || !message) return;
    try {
        textarea.value = localStorage.getItem(getApplicantNotesStorageKey(applicationId)) || '';
        message.textContent = 'Notes are stored in this browser only.';
    } catch (_) {
        textarea.value = '';
        message.textContent = 'Browser storage is unavailable; notes cannot be loaded.';
    }
    updateApplicantNotesCount();
}

function updateApplicantNotesCount() {
    const textarea = $('#applicantPrivateNotes');
    const count = $('#applicantNotesCount');
    if (textarea && count) count.textContent = textarea.value.length + ' / 2000';
}

function saveApplicantNotes() {
    const textarea = $('#applicantPrivateNotes');
    const message = $('#applicantNotesMessage');
    if (!textarea || !message || !state.activeApplicationId) {
        if (message) message.textContent = 'Open an applicant profile before saving notes.';
        return;
    }
    try {
        localStorage.setItem(getApplicantNotesStorageKey(state.activeApplicationId), textarea.value);
        message.textContent = 'Private notes saved in this browser.';
        message.classList.remove('is-error');
    } catch (_) {
        message.textContent = 'Could not save notes. Check browser storage settings.';
        message.classList.add('is-error');
    }
}

function renderApplicationHistory(history, appliedAt) {
    const element = $('#applicantProfileHistory');
    if (!element) {
        console.warn('[Employer] Applicant profile history container not found.');
        return;
    }
    const entries = Array.isArray(history) && history.length
        ? history
        : [{ status: 'new', changed_at: appliedAt }];

    element.innerHTML = entries.map((entry, index) => {
        const label = String(entry.status || 'new').replace(/^./, (char) => char.toUpperCase());
        const date = entry.changed_at ? new Date(entry.changed_at).toLocaleString() : 'Date unavailable';

        return '<div class="employer-activity-item">' +
            '<span class="employer-activity-dot"></span>' +
            '<div><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(date) + '</small></div>' +
            (index === entries.length - 1 ? '<span class="employer-activity-current">Current</span>' : '') +
            '</div>';
    }).join('');
}

function setApplicantProfileStatus(status) {
    const label = $('#applicantProfileStatus');
    const select = $('#applicantProfileStatusSelect');
    if (label) {
        label.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        label.className = 'employer-status employer-status--' + status;
    }
    if (select) select.value = status;
}

async function viewApplicant(applicationId) {
    const numericApplicationId = Number(applicationId);

    if (!Number.isInteger(numericApplicationId) || numericApplicationId <= 0) {
        throw new Error('Invalid application id.');
    }

    try {
        const data = await api('/api/employer/applicants/' + numericApplicationId);
        const applicant = data && data.applicant;
        if (!applicant || typeof applicant !== 'object') {
            throw new Error('Applicant profile data was not returned. Refresh the applicant list and try again.');
        }

        state.activeApplicationId = numericApplicationId;

        state.activeApplicationId = Number(applicationId);
        loadApplicantNotes(numericApplicationId);

        $('#applicantProfileTitle').textContent = applicant.full_name || 'Applicant';
        $('#applicantProfileSubtitle').textContent =
            (applicant.job_title || 'Job application') + ' · Applied ' +
            (formatApplicantDate(applicant.applied_at || applicant.created_at) || 'date unavailable');

        $('#applicantProfileName').textContent = applicant.full_name || 'Applicant';
        $('#applicantProfileEmail').textContent = applicant.email || 'Email not listed';
        $('#applicantProfileAvatar').textContent =
            (applicant.full_name || 'A').trim().charAt(0).toUpperCase();
        $('#applicantProfileLocation').textContent = applicant.location || 'Location not listed';
        $('#applicantProfileDegree').textContent = applicant.degree || applicant.education || 'Education not listed';
        $('#applicantProfileTarget').textContent = applicant.target_job || 'Not listed';
        $('#applicantProfileResume').textContent = applicant.resume_name || 'No resume attached';

        const resumeAction = $('#applicantProfileResumeAction');
        if (applicant.resume_name) {
            resumeAction.href = '/api/employer/applicants/' + applicationId + '/resume';
            resumeAction.textContent =
                String(applicant.resume_name).toLowerCase().endsWith('.pdf')
                    ? 'Open resume'
                    : 'Download resume';
            resumeAction.hidden = false;
        } else {
            resumeAction.hidden = true;
            resumeAction.removeAttribute('href');
        }

        $('#applicantProfileMatch').textContent = Number(applicant.matchScore || 0) + '%';

        renderApplicationHistory(applicant.history, applicant.applied_at);

        renderApplicantTags(
            '#applicantProfileMatchingSkills',
            applicant.matchingSkills,
            'No required skills matched yet.'
        );
        renderApplicantTags(
            '#applicantProfileMissingSkills',
            applicant.missingSkills,
            'All required skills are matched.'
        );
        renderApplicantTags(
            '#applicantProfileAllSkills',
            applicant.skills,
            'No skills detected.'
        );

        setApplicantProfileStatus(applicant.status || 'new');

        const modal = $('#applicantProfileModal');
        if (!modal) throw new Error('Applicant profile window is missing from this page. Refresh and try again.');
        modal.hidden = false;
        document.body.classList.add('employer-modal-open');
        const dialog = modal.querySelector('[role="dialog"]');
        if (dialog) dialog.scrollTop = 0;
    } catch (error) {
        setApplicantActionMessage(error.message || 'Could not open applicant profile.', 'error');
        console.error('[Employer] Could not open applicant profile:', error);
    }
}

function closeApplicantProfile() {
    const modal = $('#applicantProfileModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('employer-modal-open');
}

async function updateApplicationStatus(applicationId, status) {
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    setApplicantActionMessage('Updating application status…');
    document.querySelectorAll('[data-application-status="' + applicationId + '"], #applicantProfileStatusSelect').forEach((control) => {
        control.disabled = true;
    });

    try {
        await api('/api/employer/applications/' + applicationId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });

        if (Number(state.activeApplicationId) === Number(applicationId)) {
            setApplicantProfileStatus(status);
            await viewApplicant(applicationId);
        }

        await loadApplicants(state.activeJobId);
        await loadDashboard();
        setApplicantActionMessage('Application status updated to ' + label + '.', 'success');
    } catch (error) {
        await loadApplicants(state.activeJobId).catch(() => {});
        if (Number(state.activeApplicationId) === Number(applicationId)) {
            try {
                await viewApplicant(applicationId);
            } catch (_) {}
        }
        setApplicantActionMessage(error.message || 'Could not update application status. Please try again.', 'error');
    } finally {
        document.querySelectorAll('#applicantProfileStatusSelect').forEach((control) => {
            control.disabled = false;
        });
    }
}

async function loadCompany() {
    try {
        const data = await api('/api/employer/me');
        state.company = data.company;

        const company = data.company || {};
        setField('companyName', company.company_name);
        setField('companyIndustry', company.industry);
        setField('companyDescription', company.description);
        setField('companyEmail', company.email);
        setField('companyPhone', company.phone);
        setField('companyWebsite', company.website);
        setField('companySize', company.company_size);
        setField('companyLocation', company.location);
        setField('companyFoundedYear', company.founded_year);
        setField('companyBenefits', company.benefits);
    } catch (error) {
        console.error('[Employer] company:', error);
    }
}

async function loadEmployerSession() {
    try {
        const data = await api('/api/employer/me');

        state.user = data.user;
        state.company = data.company;

        $('#employerName').textContent = data.user?.full_name || 'Employer';
        $('#employerCompanyLabel').textContent =
            data.company?.company_name
                ? 'Managing ' + data.company.company_name
                : 'Manage your hiring workflow from one place.';

        showDashboard();

        await loadDashboard();
        await loadJobs();
    } catch (error) {
        showGate();

        if (error.status === 403) {
            showGateMessage('#employerLoginMessage', 'You are logged in with a candidate account. Please use an employer account for this area.');
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();
    showGateMessage('#employerLoginMessage', '');

    try {
        const data = await api('/api/employer/login', {
            method: 'POST',
            body: JSON.stringify({
                email: $('#employerLoginEmail').value.trim(),
                password: $('#employerLoginPassword').value
            })
        });

        state.user = data;
        await withEmployerLoading(() => loadEmployerSession());
    } catch (error) {
        showGateMessage('#employerLoginMessage', error.message);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    showGateMessage('#employerRegisterMessage', '');

    try {
        const data = await api('/api/employer/register', {
            method: 'POST',
            body: JSON.stringify({
                fullName: $('#employerFullName').value.trim(),
                email: $('#employerRegisterEmail').value.trim(),
                password: $('#employerRegisterPassword').value,
                confirmPassword: $('#employerRegisterConfirm').value,
                companyName: $('#employerCompanyName').value.trim(),
                companyDescription: $('#employerCompanyDescription').value.trim(),
                companyEmail: $('#employerCompanyEmail').value.trim(),
                companyPhone: $('#employerCompanyPhone').value.trim(),
                companyWebsite: $('#employerCompanyWebsite').value.trim()
            })
        });

        state.user = data;
        await withEmployerLoading(() => loadEmployerSession());
    } catch (error) {
        showGateMessage('#employerRegisterMessage', error.message);
    }
}

async function saveCompany(event) {
    event.preventDefault();

    const message = $('#companyMessage');
    message.textContent = 'Saving...';
    message.className = 'employer-form-message show success';

    try {
        const data = await api('/api/employer/company', {
            method: 'PUT',
            body: JSON.stringify({
                companyName: $('#companyName').value.trim(),
                industry: $('#companyIndustry').value.trim(),
                description: $('#companyDescription').value.trim(),
                email: $('#companyEmail').value.trim(),
                phone: $('#companyPhone').value.trim(),
                website: $('#companyWebsite').value.trim(),
                companySize: $('#companySize').value.trim(),
                location: $('#companyLocation').value.trim(),
                foundedYear: $('#companyFoundedYear').value.trim(),
                benefits: $('#companyBenefits').value.trim()
            })
        });

        state.company = data.company;
        $('#employerCompanyLabel').textContent =
            'Managing ' + (data.company.company_name || 'your company');

        message.textContent = 'Company profile saved.';
    } catch (error) {
        message.textContent = error.message;
        message.className = 'employer-form-message show error';
    }
}

async function saveJob(event) {
    event.preventDefault();

    const message = $('#jobEditorMessage');
    message.textContent = 'Saving job posting...';
    message.className = 'employer-form-message show success';

    try {
        const minimumSalary = $('#jobSalaryMin').value.trim();
        const maximumSalary = $('#jobSalaryMax').value.trim();
        if (minimumSalary && maximumSalary && Number(minimumSalary) > Number(maximumSalary)) {
            message.textContent = 'Maximum monthly pay must be greater than or equal to minimum monthly pay.';
            message.className = 'employer-form-message show error';
            $('#jobSalaryMax').focus();
            return;
        }

        const payload = getJobFormPayload();
        const editingId = state.editingJobId;

        await api(
            editingId
                ? '/api/employer/jobs/' + editingId
                : '/api/employer/jobs',
            {
                method: editingId ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            }
        );

        closeJobEditor();
        await loadJobs();
        await loadDashboard();
    } catch (error) {
        message.textContent = error.message;
        message.className = 'employer-form-message show error';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
        button.addEventListener('click', () => switchAuthTab(button.dataset.authTab));
    });

    document.querySelectorAll('.employer-tab').forEach((button) => {
        button.addEventListener('click', () => switchPanel(button.dataset.panel));
    });

    document.querySelectorAll('[data-open-panel]').forEach((button) => {
        button.addEventListener('click', () => switchPanel(button.dataset.openPanel));
    });

    $('#employerLoginForm').addEventListener('submit', handleLogin);
    $('#employerRegisterForm').addEventListener('submit', handleRegister);
    $('#companyForm').addEventListener('submit', saveCompany);
    $('#jobEditorForm').addEventListener('submit', saveJob);

    document.querySelectorAll('[data-schedule-preset]').forEach((button) => {
        button.addEventListener('click', () => {
            const presets = {
                mwf: ['Mon', 'Wed', 'Fri'],
                weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                weekends: ['Sat', 'Sun'],
                everyday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            };
            selectedScheduleDays.clear();
            (presets[button.dataset.schedulePreset] || []).forEach((day) => selectedScheduleDays.add(day));
            updateSchedulePreview();
        });
    });
    document.querySelectorAll('[data-schedule-day]').forEach((button) => {
        button.addEventListener('click', () => {
            const day = button.dataset.scheduleDay;
            if (selectedScheduleDays.has(day)) selectedScheduleDays.delete(day);
            else selectedScheduleDays.add(day);
            updateSchedulePreview();
        });
    });
    $('#jobScheduleStart')?.addEventListener('change', () => {
        selectedScheduleFlexible = false;
        updateSchedulePreview();
    });
    $('#jobScheduleEnd')?.addEventListener('change', () => {
        selectedScheduleFlexible = false;
        updateSchedulePreview();
    });
    $('#jobScheduleFlexible')?.addEventListener('click', () => {
        selectedScheduleFlexible = !selectedScheduleFlexible;
        if (selectedScheduleFlexible) {
            setField('jobScheduleStart', '');
            setField('jobScheduleEnd', '');
        }
        updateSchedulePreview();
    });

    $('#openPostJob').addEventListener('click', () => openJobEditor());
    $('#refreshEmployerAnalytics').addEventListener('click', loadAnalytics);
    $('#openPostJobFromJobs').addEventListener('click', () => openJobEditor());

    document.querySelectorAll('[data-close-job-editor]').forEach((element) => {
        element.addEventListener('click', closeJobEditor);
    });

    $('#employerLogout').addEventListener('click', async () => {
        const button = $('#employerLogout');

        if (button.dataset.action !== 'logout') {
            window.location.replace('/');
            return;
        }

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } finally {
            window.location.replace('/');
        }
    });

    $('#recentApplications').addEventListener('click', (event) => {
        const item = event.target.closest('[data-open-job-applicants]');

        if (!item) {
            return;
        }

        const jobId = Number(item.dataset.openJobApplicants);

        if (!Number.isInteger(jobId) || jobId <= 0) {
            return;
        }

        state.activeJobId = jobId;
        switchPanel('applicants');
    });

    $('#applicantProfileStatusSelect').addEventListener('change', (event) => {
        const applicationId = Number(state.activeApplicationId);
        const status = event.target.value;

        if (!Number.isInteger(applicationId) || applicationId <= 0) {
            return;
        }

        updateApplicationStatus(applicationId, status);
    });

    $('#applicantJobSelect').addEventListener('change', (event) => {
        state.activeJobId = Number(event.target.value);
        state.applicantSearch = '';
        state.applicantStatus = 'all';
        state.applicantMatch = 'all';
        state.applicantSort = 'match-desc';
        $('#applicantSearch').value = '';
        $('#applicantStatusFilter').value = 'all';
        $('#applicantMatchFilter').value = 'all';
        $('#applicantSort').value = 'match-desc';
        loadApplicants(state.activeJobId);
    });

    $('#clearApplicantFilters').addEventListener('click', () => {
        state.applicantSearch = '';
        state.applicantStatus = 'all';
        state.applicantMatch = 'all';
        state.applicantSort = 'match-desc';
        $('#applicantSearch').value = '';
        $('#applicantStatusFilter').value = 'all';
        $('#applicantMatchFilter').value = 'all';
        $('#applicantSort').value = 'match-desc';
        setApplicantActionMessage('');
        renderApplicants();
    });

    $('#exportApplicants')?.addEventListener('click', exportFilteredApplicants);
    $('#applicantPrivateNotes')?.addEventListener('input', updateApplicantNotesCount);
    $('#saveApplicantNotes')?.addEventListener('click', saveApplicantNotes);

    $('#applicantPipelineCounts')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pipeline-status]');
        if (!button) return;
        state.applicantStatus = button.dataset.pipelineStatus || 'all';
        $('#applicantStatusFilter').value = state.applicantStatus;
        renderApplicants();
    });

    $('#applicantSearch').addEventListener('input', (event) => {
        state.applicantSearch = event.target.value;
        renderApplicants();
    });
    $('#applicantStatusFilter').addEventListener('change', (event) => {
        state.applicantStatus = event.target.value;
        renderApplicants();
    });
    $('#applicantMatchFilter').addEventListener('change', (event) => {
        state.applicantMatch = event.target.value;
        renderApplicants();
    });
    $('#applicantSort').addEventListener('change', (event) => {
        state.applicantSort = event.target.value;
        renderApplicants();
    });

    $('#employerJobsList').addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit-job]');
        const applicantButton = event.target.closest('[data-view-applicants]');

        if (editButton) {
            const job = state.jobs.find((item) => Number(item.id) === Number(editButton.dataset.editJob));
            if (job) openJobEditor(job);
        }

        if (applicantButton) {
            state.activeJobId = Number(applicantButton.dataset.viewApplicants);
            switchPanel('applicants');
        }

        const emptyButton = event.target.closest('#emptyPostJob');
        if (emptyButton) openJobEditor();
    });

    $('#employerJobsList').addEventListener('change', (event) => {
        const select = event.target.closest('[data-job-status]');
        if (select) updateJobStatus(select.dataset.jobStatus, select.value);
    });

    $('#applicantsList').addEventListener('click', (event) => {
        const copyButton = event.target.closest('[data-copy-applicant-email]');
        if (copyButton) {
            copyApplicantEmail(copyButton);
            return;
        }

        const button = event.target.closest('[data-view-applicant]');
        if (button) viewApplicant(button.dataset.viewApplicant);
    });

    $('#applicantsList').addEventListener('change', (event) => {
        const select = event.target.closest('[data-application-status]');
        if (select) {
            updateApplicationStatus(
                select.dataset.applicationStatus,
                select.value
            );
        }
    });

    // Keep the immersive loading screen on first entry so the employer
    // workspace has time to hydrate before it is revealed.
    await withEmployerLoading(() => loadEmployerSession());
});
document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-applicant-profile]')) {
        closeApplicantProfile();
    }
});
