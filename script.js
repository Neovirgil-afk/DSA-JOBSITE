
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Mobile nav ---------- */
  const menuToggle = $('#menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }


  const resultsSection = $('#resultsSection');
  const resultsGrid = $('#resultsGrid');
  const resultsTitle = $('#resultsTitle');
  const resultsClose = $('#resultsClose');

  function money(job) {
    return job.salary ? `<span>${job.salary}</span>` : '';
  }

  function renderJobs(jobs, heading) {
    resultsTitle.textContent = heading;
    resultsGrid.innerHTML = '';

    if (!jobs.length) {
      resultsGrid.innerHTML = '<p class="results-empty">No jobs matched that search yet. Try a different keyword or category.</p>';
    } else {
      const frag = document.createDocumentFragment();
      jobs.forEach((job) => {
        const card = document.createElement('article');
        card.className = 'result-card';
        card.innerHTML = `
          <h3>${job.title}</h3>
          <p class="company">${job.company || ''}</p>
          <div class="meta">
            <span>${job.location || 'Remote'}</span>
            ${job.employment_type ? `<span>${job.employment_type}</span>` : ''}
            ${money(job)}
          </div>
          ${typeof job.matchScore === 'number' ? `<span class="match">${job.matchScore}% match</span>` : ''}
        `;
        frag.appendChild(card);
      });
      resultsGrid.appendChild(frag);
    }

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function fetchJobs(params) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/jobs${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to load jobs');
    const data = await res.json();
    return data.jobs || [];
  }

  async function runSearch(params, heading) {
    resultsGrid.innerHTML = '<p class="results-empty">Loading jobs…</p>';
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const jobs = await fetchJobs(params);
      renderJobs(jobs, heading);
    } catch (err) {
      resultsGrid.innerHTML = '<p class="results-empty">Something went wrong loading jobs. Please try again.</p>';
      console.error(err);
    }
  }

  if (resultsClose) {
    resultsClose.addEventListener('click', () => {
      resultsSection.hidden = true;
    });
  }


  const searchForm = $('#searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#searchQuery').value.trim();
      const location = $('#searchLocation').value.trim();
      runSearch({ q, location }, q ? `Results for “${q}”` : 'All jobs');
    });
  }


  $$('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      $('#searchQuery').value = query;
      runSearch({ q: query }, `Results for “${query}”`);
    });
  });

 
  $$('.category-card').forEach((card) => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      runSearch({ category }, category);
    });
  });
})();