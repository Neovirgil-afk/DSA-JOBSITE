'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.querySelector('#companyGrid');
    const search = document.querySelector('#companySearch');
    let companies = [];

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const render = () => {
        const query = search.value.trim().toLowerCase();
        const filtered = companies.filter((company) =>
            [company.company_name, company.description, company.industry, company.location]
                .some((value) => String(value || '').toLowerCase().includes(query))
        );

        if (!filtered.length) {
            grid.innerHTML = '<div class="resource-card"><h2>No companies found</h2><p>Try another company name, industry, or location.</p></div>';
            return;
        }

        grid.innerHTML = filtered.map((company) => `
            <article class="resource-card company-card">
                <span class="resource-card-number">${String(company.open_jobs || 0).padStart(2, '0')}</span>
                <h2>${escapeHtml(company.company_name)}</h2>
                <p>${escapeHtml(company.description || 'Employer on JobSite.')}</p>
                <div class="company-meta">
                    ${company.industry ? `<span>${escapeHtml(company.industry)}</span>` : ''}
                    ${company.location ? `<span>${escapeHtml(company.location)}</span>` : ''}
                    <strong>${Number(company.open_jobs || 0)} open job${Number(company.open_jobs || 0) === 1 ? '' : 's'}</strong>
                </div>
            </article>
        `).join('');
    };

    search.addEventListener('input', render);

    try {
        const response = await fetch('/api/jobs/companies');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load companies.');
        companies = Array.isArray(data.companies) ? data.companies : [];
        render();
    } catch (error) {
        grid.innerHTML = `<div class="resource-card"><h2>Could not load companies</h2><p>${escapeHtml(error.message)}</p><button class="btn btn-primary" type="button" id="retryCompanies">Try Again</button></div>`;
        document.querySelector('#retryCompanies')?.addEventListener('click', () => window.location.reload());
    }
});