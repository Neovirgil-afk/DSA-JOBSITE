'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const list = document.querySelector('#applicationsList');
    const count = document.querySelector('#applicationCount');

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function statusLabel(status) {
        const labels = {
            new: 'Applied',
            reviewing: 'Under Review',
            shortlisted: 'Shortlisted',
            interview: 'Interview',
            hired: 'Hired',
            rejected: 'Rejected'
        };
        return labels[status] || 'Applied';
    }

    function render(applications) {
        count.textContent = String(applications.length);

        if (!applications.length) {
            list.innerHTML = `
                <div class="applications-empty">
                    <div class="applications-empty-icon">💼</div>
                    <h2>No applications yet</h2>
                    <p>Find a job that matches your skills and start your career journey.</p>
                    <a class="btn btn-primary" href="/">Browse Jobs</a>
                </div>
            `;
            return;
        }

        list.innerHTML = applications.map((app) => `
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
                        <span class="application-resume-badge ${app.resume_id ? 'has-resume' : 'no-resume'}">
                            ${app.resume_id ? '✓ Resume attached' : 'No resume attached'}
                        </span>
                        ${app.resume_name ? `<span class="application-resume-name">${escapeHtml(app.resume_name)}</span>` : ''}
                        <span class="application-job-state ${app.job_status === 'active' ? 'is-open' : 'is-closed'}">
                            ${app.job_status === 'active' ? 'Job active' : 'Job closed'}
                        </span>
                    </div>
                </div>
                <div class="application-card-side">
                    <span class="application-status application-status--${escapeHtml(app.status)}">${statusLabel(app.status)}</span>
                    <small>Applied ${new Date(app.applied_at).toLocaleDateString()}</small>
                    <div class="application-timeline-mini">${(Array.isArray(app.history) && app.history.length ? app.history : [{ status: app.status, changed_at: app.applied_at }]).map((item) => `<span><b>${escapeHtml(statusLabel(item.status))}</b><em>${new Date(item.changed_at).toLocaleDateString()}</em></span>`).join('')}</div>
                    <a href="/?job=${encodeURIComponent(app.job_id)}" class="application-view-link">View job</a>
                </div>
            </article>
        `).join('');
    }

    try {
        const response = await fetch('/api/applications', {
            credentials: 'include'
        });

        if (response.status === 401 || response.status === 403) {
            sessionStorage.setItem('jobsite_redirect_after_login', '/applications.html');
            list.innerHTML = '<div class="applications-empty"><h2>Please log in</h2><p>Log in to view your applications.</p><a class="btn btn-primary" href="/">Go to JobSite</a></div>';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load applications.');
        }

        render(Array.isArray(data.applications) ? data.applications : []);
    } catch (error) {
        list.innerHTML = `
            <div class="applications-empty">
                <h2>Could not load applications</h2>
                <p>${escapeHtml(error.message)}</p>
                <button class="btn btn-primary" type="button" id="retryApplications">Try Again</button>
            </div>
        `;
        document.querySelector('#retryApplications')?.addEventListener('click', () => window.location.reload());
    }
});