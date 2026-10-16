'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const list = document.querySelector('#applicationsList');
    const count = document.querySelector('#applicationCount');
    const searchInput = document.querySelector('#applicationSearch');
    const statusFilter = document.querySelector('#applicationStatusFilter');
    const sortSelect = document.querySelector('#applicationSort');
    const filterSummary = document.querySelector('#applicationFilterSummary');
    const clearFilters = document.querySelector('#clearApplicationFilters');
    let allApplications = [];

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function statusLabel(status) {
        const labels = { new: 'Applied', reviewing: 'Under Review', shortlisted: 'Shortlisted', interview: 'Interview', hired: 'Hired', rejected: 'Rejected' };
        return labels[status] || 'Applied';
    }

    function applyFilters() {
        const query = String(searchInput.value || '').trim().toLowerCase();
        const selectedStatus = statusFilter.value;
        const filtered = allApplications.filter(app => {
            const matchesStatus = selectedStatus === 'all' || String(app.status || 'new') === selectedStatus;
            const haystack = [app.title, app.company, app.location, app.employment_type].join(' ').toLowerCase();
            return matchesStatus && (!query || haystack.includes(query));
        });
        filtered.sort((a, b) => {
            if (sortSelect.value === 'oldest') return new Date(a.applied_at) - new Date(b.applied_at);
            if (sortSelect.value === 'status') return statusLabel(a.status).localeCompare(statusLabel(b.status)) || new Date(b.applied_at) - new Date(a.applied_at);
            return new Date(b.applied_at) - new Date(a.applied_at);
        });
        renderFiltered(filtered);
    }

    function renderFiltered(applications) {
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
                <article class="application-card">
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
                        <small>Applied ${escapeHtml(new Date(app.applied_at).toLocaleDateString())}</small>
                        <div class="application-timeline-mini" aria-label="Application status history">${history.map(item => `<span><b>${escapeHtml(statusLabel(item.status))}</b><em>${escapeHtml(new Date(item.changed_at).toLocaleDateString())}</em></span>`).join('')}</div>
                        <a href="/?job=${encodeURIComponent(app.job_id)}" class="application-view-link">View job details →</a>
                    </div>
                </article>
            `;
        }).join('');
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

    try {
        const response = await fetch('/api/applications', { credentials: 'include' });
        if (response.status === 401 || response.status === 403) {
            sessionStorage.setItem('jobsite_redirect_after_login', '/applications.html');
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
