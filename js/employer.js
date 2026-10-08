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

function getJobFormPayload() {
    return {
        title: $('#jobTitle').value.trim(),
        category: $('#jobCategory').value.trim(),
        employmentType: $('#jobEmploymentType').value,
        salary: $('#jobSalary').value.trim(),
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
    setField('jobSalary', job?.salary || '');
    setField('jobLocation', job?.location || '');
    setField('jobSchedule', job?.work_schedule || '');
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
            return '<button type="button" class="employer-recent-item" data-open-applicants="' +
                escapeHtml(application.job_title) + '">' +
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
                const deadlineDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(deadlineText)
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

async function updateJobStatus(jobId, status) {
    try {
        await api('/api/employer/jobs/' + jobId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });

        await loadJobs();
        await loadDashboard();
    } catch (error) {
        alert(error.message);
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
        switch (state.applicantSort) {
            case 'match-asc': return Number(a.matchScore || 0) - Number(b.matchScore || 0);
            case 'newest': return new Date(b.applied_at || 0) - new Date(a.applied_at || 0);
            case 'oldest': return new Date(a.applied_at || 0) - new Date(b.applied_at || 0);
            case 'name-asc': return String(a.full_name || '').localeCompare(String(b.full_name || ''));
            default: return Number(b.matchScore || 0) - Number(a.matchScore || 0);
        }
    });
}

function renderApplicants() {
    const applicants = getFilteredApplicants();
    const total = state.applicants.length;
    const topApplicant = applicants[0];

    $('#applicantSummary').innerHTML =
        '<strong>' + applicants.length + '</strong> of <strong>' + total + '</strong> applicants shown' +
        (topApplicant ? ' · <strong>Top result: ' + escapeHtml(topApplicant.full_name) + ' (' + Number(topApplicant.matchScore) + '%)</strong>' : '');

    if (!total) {
        $('#applicantsList').innerHTML = '<div class="employer-empty employer-empty--large"><strong>No applicants yet.</strong><span>Applications will appear here once candidates apply to this job.</span></div>';
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
                '<div class="employer-applicant-meta"><span>' + escapeHtml(applicant.degree || 'Education not listed') + '</span><span>' + escapeHtml(applicant.location || 'Location not listed') + '</span></div>' +
                '<div class="employer-match-skills"><div><small>Matched</small>' +
                (applicant.matchingSkills || []).slice(0, 7).map((skill) => '<span class="match-have">' + escapeHtml(skill) + '</span>').join('') + '</div><div><small>Missing</small>' +
                (applicant.missingSkills || []).slice(0, 5).map((skill) => '<span class="match-missing">' + escapeHtml(skill) + '</span>').join('') + '</div></div>' +
                '<div class="employer-applicant-actions"><button type="button" class="employer-secondary-button" data-view-applicant="' + applicant.application_id + '">View Profile</button>' +
                '<select class="employer-inline-select" data-application-status="' + applicant.application_id + '">' +
                ['new','reviewing','shortlisted','interview','hired','rejected'].map((status) => '<option value="' + status + '"' + (applicant.status === status ? ' selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>').join('') +
                '</select></div></div></article>';
    }).join('');
}

async function loadApplicants(jobId) {
    if (!jobId) {
        state.applicants = [];
        $('#applicantSummary').textContent = '';
        $('#applicantsList').innerHTML = '<div class="employer-empty">Select a job to view applicants.</div>';
        return;
    }

    state.activeJobId = Number(jobId);
    try {
        const data = await api('/api/employer/jobs/' + jobId + '/applicants');
        state.applicants = data.applicants || [];
        renderApplicants();
    } catch (error) {
        state.applicants = [];
        $('#applicantsList').innerHTML = '<div class="employer-empty">Unable to load applicants.</div>';
    }
}
function renderApplicantTags(selector, skills, emptyText) {
    const element = $(selector);
    const values = Array.isArray(skills) ? skills : [];

    element.innerHTML = values.length
        ? values.map((skill) => '<span>' + escapeHtml(skill) + '</span>').join('')
        : '<em>' + escapeHtml(emptyText) + '</em>';
}

function renderApplicationHistory(history, appliedAt) {
    const element = $('#applicantProfileHistory');
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
    label.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    label.className = 'employer-status employer-status--' + status;
    $('#applicantProfileStatusSelect').value = status;
}

async function viewApplicant(applicationId) {
    try {
        const data = await api('/api/employer/applicants/' + applicationId);
        const applicant = data.applicant;

        state.activeApplicationId = Number(applicationId);

        $('#applicantProfileTitle').textContent = applicant.full_name || 'Applicant';
        $('#applicantProfileSubtitle').textContent =
            (applicant.job_title || 'Job application') + ' · Applied ' +
            (applicant.applied_at ? new Date(applicant.applied_at).toLocaleDateString() : 'date unavailable');

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

        $('#applicantProfileModal').hidden = false;
        document.body.classList.add('employer-modal-open');
    } catch (error) {
        alert(error.message);
    }
}

function closeApplicantProfile() {
    $('#applicantProfileModal').hidden = true;
    document.body.classList.remove('employer-modal-open');
}

async function updateApplicationStatus(applicationId, status) {
    try {
        await api('/api/employer/applications/' + applicationId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });

        await loadApplicants(state.activeJobId);
        await loadDashboard();
    } catch (error) {
        alert(error.message);
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
