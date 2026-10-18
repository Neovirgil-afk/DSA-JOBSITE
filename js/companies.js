'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.querySelector('#companyGrid');
    const search = document.querySelector('#companySearch');
    if (!grid || !search) return;

    let companies = [];
    let allJobs = null;
    let selectedCompany = null;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const countJobs = (company) => Number(company.open_jobs || 0);

    function renderCompanies() {
        selectedCompany = null;
        document.querySelector('#companyJobsPanel')?.remove();
        grid.hidden = false;
        search.closest('.resource-section').hidden = false;

        const query = search.value.trim().toLowerCase();
        const filtered = companies.filter((company) =>
            [company.company_name, company.description, company.industry, company.location]
                .some((value) => String(value || '').toLowerCase().includes(query))
        );

        if (!filtered.length) {
            grid.innerHTML = '<div class="resource-card"><h2>No companies found</h2><p>Try another company name, industry, or location.</p></div>';
            return;
        }

        grid.innerHTML = filtered.map((company, index) => {
            const openJobs = countJobs(company);
            return `
                <article class="resource-card company-card">
                    <span class="resource-card-number">${String(openJobs).padStart(2, '0')}</span>
                    <h2>${escapeHtml(company.company_name)}</h2>
                    <p>${escapeHtml(company.description || 'Employer on JobSite.')}</p>
                    <div class="company-meta">
                        ${company.industry ? `<span>${escapeHtml(company.industry)}</span>` : ''}
                        ${company.location ? `<span>${escapeHtml(company.location)}</span>` : ''}
                        <strong>${openJobs} open job${openJobs === 1 ? '' : 's'}</strong>
                    </div>
                    <button class="company-view-jobs" type="button" data-company-index="${companies.indexOf(company)}" aria-label="View jobs at ${escapeHtml(company.company_name)}">
                        View jobs <span aria-hidden="true">→</span>
                    </button>
                </article>
            `;
        }).join('');
    }

    async function loadJobs() {
        if (allJobs) return allJobs;
        const response = await fetch('/api/jobs', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load job listings.');
        allJobs = Array.isArray(data.jobs) ? data.jobs : [];
        return allJobs;
    }

    function renderCompanyJobs(company, jobs) {
        selectedCompany = company;
        grid.hidden = true;
        search.closest('.resource-section').hidden = true;
        document.querySelector('#companyJobsPanel')?.remove();

        const panel = document.createElement('section');
        panel.id = 'companyJobsPanel';
        panel.className = 'company-jobs-panel';
        panel.setAttribute('aria-live', 'polite');

        const matchingJobs = jobs.filter((job) =>
            String(job.company || '').trim().toLowerCase() === String(company.company_name || '').trim().toLowerCase()
        );

        panel.innerHTML = `
            <button type="button" class="company-back-button" id="backToCompanies">← All companies</button>
            <div class="company-jobs-heading">
                <div>
                    <p class="resource-eyebrow">COMPANY PROFILE</p>
                    <h2>${escapeHtml(company.company_name)}</h2>
                    <p>${escapeHtml(company.description || 'Explore open opportunities at this company.')}</p>
                    <div class="company-meta">
                        ${company.industry ? `<span>${escapeHtml(company.industry)}</span>` : ''}
                        ${company.location ? `<span>${escapeHtml(company.location)}</span>` : ''}
                    </div>
                </div>
                <span class="company-jobs-count">${matchingJobs.length} open job${matchingJobs.length === 1 ? '' : 's'}</span>
            </div>
            <div class="company-job-list" id="companyJobList"></div>
        `;

        grid.insertAdjacentElement('beforebegin', panel);
        panel.querySelector('#backToCompanies').addEventListener('click', renderCompanies);

        const list = panel.querySelector('#companyJobList');
        if (!matchingJobs.length) {
            list.innerHTML = `
                <div class="company-no-jobs">
                    <span aria-hidden="true">💼</span>
                    <h3>No open jobs right now</h3>
                    <p>This company doesn't have any currently listed positions. Check back later for new opportunities.</p>
                    ${company.website ? `<a href="${escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer">Visit company website ↗</a>` : ''}
                </div>
            `;
            return;
        }

        list.innerHTML = matchingJobs.map((job) => `
            <article class="company-job-card">
                <div class="company-job-main">
                    <h3>${escapeHtml(job.title || 'Untitled position')}</h3>
                    <p>${escapeHtml(job.company || company.company_name)}</p>
                    <div class="company-job-meta">
                        <span>📍 ${escapeHtml(job.location || 'Location not specified')}</span>
                        ${job.employment_type ? `<span>◷ ${escapeHtml(job.employment_type)}</span>` : ''}
                        ${job.salary ? `<strong>${escapeHtml(job.salary)}</strong>` : ''}
                    </div>
                </div>
                <a class="company-job-view" href="/?job=${encodeURIComponent(job.id)}">View details <span aria-hidden="true">→</span></a>
            </article>
        `).join('');
    }

    grid.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-company-index]');
        if (!button) return;

        const company = companies[Number(button.dataset.companyIndex)];
        if (!company) return;

        button.disabled = true;
        button.textContent = 'Loading jobs…';
        try {
            const jobs = await loadJobs();
            renderCompanyJobs(company, jobs);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            button.disabled = false;
            button.innerHTML = 'Try again <span aria-hidden="true">→</span>';
            let notice = document.querySelector('#companyJobsError');
            if (!notice) {
                notice = document.createElement('p');
                notice.id = 'companyJobsError';
                notice.className = 'company-jobs-error';
                grid.insertAdjacentElement('beforebegin', notice);
            }
            notice.textContent = error.message || 'Could not load this company’s jobs. Please try again.';
        }
    });

    search.addEventListener('input', renderCompanies);

    try {
        const response = await fetch('/api/jobs/companies');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load companies.');
        companies = Array.isArray(data.companies) ? data.companies : [];
        renderCompanies();
    } catch (error) {
        grid.innerHTML = `<div class="resource-card"><h2>Could not load companies</h2><p>${escapeHtml(error.message)}</p><button class="btn btn-primary" type="button" id="retryCompanies">Try Again</button></div>`;
        document.querySelector('#retryCompanies')?.addEventListener('click', () => window.location.reload());
    }
});
