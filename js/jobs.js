'use strict';


export function initJobs() {

    const resultsSection =
        document.querySelector('#resultsSection');

    const resultsGrid =
        document.querySelector('#resultsGrid');

    const resultsTitle =
        document.querySelector('#resultsTitle');

    const resultsClose =
        document.querySelector('#resultsClose');

    const savedJobIds =
        new Set();


    if (
        !resultsSection ||
        !resultsGrid ||
        !resultsTitle
    ) {

        return;
    }


    /* =====================================================
       SALARY
       ===================================================== */

    function money(job) {

        return job.salary
            ? `<span>${job.salary}</span>`
            : '';
    }


    /* =====================================================
       SKELETON LOADER
       ===================================================== */

    function showSkeletons(count = 4) {

        const frag =
            document.createDocumentFragment();


        for (let i = 0; i < count; i++) {

            const skeleton =
                document.createElement('article');


            skeleton.className =
                'result-card result-card--skeleton';


            skeleton.setAttribute(
                'aria-hidden',
                'true'
            );


            skeleton.innerHTML = `

                <div class="skeleton skeleton-title"></div>

                <div class="skeleton skeleton-company"></div>

                <div class="skeleton-meta">

                    <div class="skeleton skeleton-meta-item"></div>

                    <div class="skeleton skeleton-meta-item skeleton-meta-item--short"></div>

                    <div class="skeleton skeleton-meta-item skeleton-meta-item--salary"></div>

                </div>

                <div class="skeleton skeleton-match"></div>

            `;


            frag.appendChild(skeleton);
        }


        resultsGrid.innerHTML =
            '';


        resultsGrid.appendChild(
            frag
        );
    }


    /* =====================================================
       RENDER JOBS
       ===================================================== */

    function renderJobs(jobs, heading, shouldScroll = true) {

        resultsTitle.textContent =
            heading;


        resultsGrid.innerHTML =
            '';


        if (!jobs.length) {

            resultsGrid.innerHTML =
                '<p class="results-empty">No jobs matched that search yet. Try a different keyword or category.</p>';

        } else {

            const frag =
                document.createDocumentFragment();


            jobs.forEach((job) => {

                const card =
                    document.createElement(
                        'article'
                    );


                card.className =
                    'result-card';


                card.innerHTML = `

                    <button
                        type="button"
                        class="job-save-button${
                            savedJobIds.has(Number(job.id))
                                ? ' is-saved'
                                : ''
                        }"
                        data-job-id="${Number(job.id)}"
                        aria-pressed="${savedJobIds.has(Number(job.id))}"
                        aria-label="${savedJobIds.has(Number(job.id)) ? 'Remove saved job' : 'Save job'}"
                    >
                        ${savedJobIds.has(Number(job.id)) ? 'Saved' : 'Save job'}
                    </button>

                    <h3>
                        ${job.title}
                    </h3>

                    <p class="company">
                        ${job.company || ''}
                    </p>

                    <div class="meta">

                        <span>
                            ${job.location || 'Remote'}
                        </span>

                        ${
                            job.employment_type
                                ? `<span>${job.employment_type}</span>`
                                : ''
                        }

                        ${money(job)}

                    </div>

                    ${
                        typeof job.matchScore === 'number'
                            ? `<span class="match">${job.matchScore}% match</span>`
                            : ''
                    }

                `;


                frag.appendChild(card);
            });


            resultsGrid.appendChild(frag);
        }


        resultsSection.hidden =
            false;


        if (shouldScroll) {
            resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }


    /* =====================================================
       FETCH JOBS
       ===================================================== */

    async function fetchJobs(params) {

        const query =
            new URLSearchParams(params)
                .toString();


        const response =
            await fetch(
                `/api/jobs${query ? `?${query}` : ''}`
            );


        if (!response.ok) {

            throw new Error(
                'Failed to load jobs'
            );
        }


        const data =
            await response.json();


        return data.jobs || [];
    }


    async function loadSavedJobIds() {
        try {
            const response =
                await fetch('/api/jobs/saved', {
                    credentials: 'include'
                });

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            data.jobs?.forEach((job) => {
                savedJobIds.add(Number(job.id));
            });
        } catch (error) {
            console.error(
                '[JobPath] Failed to load saved jobs:',
                error
            );
        }
    }


    async function toggleSavedJob(button) {
        const jobId = Number(button.dataset.jobId);

        if (!Number.isInteger(jobId) || jobId <= 0) {
            return;
        }

        const shouldSave =
            !savedJobIds.has(jobId);

        button.disabled = true;

        try {
            const response = await fetch(
                `/api/jobs/saved/${jobId}`,
                {
                    method: shouldSave ? 'POST' : 'DELETE',
                    credentials: 'include'
                }
            );

            if (response.status === 401) {
                window.dispatchEvent(
                    new CustomEvent('jobpath:open-auth', {
                        detail: { mode: 'login' }
                    })
                );
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to update saved job.');
            }

            if (shouldSave) {
                savedJobIds.add(jobId);
            } else {
                savedJobIds.delete(jobId);
            }

            const saved = savedJobIds.has(jobId);
            button.classList.toggle('is-saved', saved);
            button.setAttribute('aria-pressed', String(saved));
            button.setAttribute(
                'aria-label',
                saved ? 'Remove saved job' : 'Save job'
            );
            button.textContent = saved ? 'Saved' : 'Save job';
        } catch (error) {
            console.error(
                '[JobPath] Failed to update saved job:',
                error
            );
        } finally {
            button.disabled = false;
        }
    }


    /* =====================================================
       RUN SEARCH
       ===================================================== */

    async function runSearch(
        params,
        heading
    ) {

        /*
         * Show the results section immediately.
         */

        resultsTitle.textContent =
            heading;


        resultsSection.hidden =
            false;


        /*
         * Show skeleton cards while loading.
         */

        showSkeletons(4);


        /*
         * Scroll to the results section
         * while the skeletons are visible.
         */

        resultsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });


        try {

            /*
             * Fetch the jobs and simulate
             * a 1.2-second loading time.
             *
             * If the API takes longer than 1.2s,
             * we wait for the API instead.
             */

            const [jobs] =
                await Promise.all([

                    fetchJobs(params),

                    new Promise((resolve) => {

                        setTimeout(
                            resolve,
                            1200
                        );

                    })

                ]);


            /*
             * Replace skeletons with
             * the actual job results.
             */

            renderJobs(
                jobs,
                heading
            );

        } catch (error) {

            resultsGrid.innerHTML =
                '<p class="results-empty">Something went wrong loading jobs. Please try again.</p>';

            console.error(
                '[JobPath] Failed to load jobs:',
                error
            );
        }
    }


    /* =====================================================
       INITIAL JOB PREVIEW
       ===================================================== */

    async function loadInitialJobs() {
        resultsSection.hidden = false;
        showSkeletons(4);

        try {
            await loadSavedJobIds();

            const jobs =
                await fetchJobs({});

            renderJobs(
                jobs.slice(0, 6),
                'Featured jobs',
                false
            );
        } catch (error) {
            resultsSection.hidden = true;

            console.error(
                '[JobPath] Failed to load featured jobs:',
                error
            );
        }
    }


    /* =====================================================
       CLOSE RESULTS
       ===================================================== */

    if (resultsClose) {

        resultsClose.addEventListener(
            'click',
            () => {

                resultsSection.hidden =
                    true;
            }
        );
    }


    resultsGrid.addEventListener(
        'click',
        (event) => {
            const saveButton =
                event.target.closest('.job-save-button');

            if (saveButton) {
                toggleSavedJob(saveButton);
            }
        }
    );


    /* =====================================================
       SEARCH FORM
       ===================================================== */

    const searchForm =
        document.querySelector('#searchForm');


    if (searchForm) {

        searchForm.addEventListener(
            'submit',
            (event) => {

                event.preventDefault();


                const q =
                    document.querySelector(
                        '#searchQuery'
                    )
                    .value
                    .trim();


                const location =
                    document.querySelector(
                        '#searchLocation'
                    )
                    .value
                    .trim();


                runSearch(
                    {
                        q,
                        location
                    },

                    q
                        ? `Results for “${q}”`
                        : 'All jobs'
                );
            }
        );
    }


    /* =====================================================
       POPULAR SEARCH CHIPS
       ===================================================== */

    document
        .querySelectorAll('.chip')
        .forEach((chip) => {

            chip.addEventListener(
                'click',
                () => {

                    const query =
                        chip.dataset.query;


                    document.querySelector(
                        '#searchQuery'
                    ).value = query;


                    runSearch(
                        {
                            q: query
                        },

                        `Results for “${query}”`
                    );
                }
            );
        });


    /* =====================================================
       CATEGORY SEARCH
       ===================================================== */

    document
        .querySelectorAll('.category-card')
        .forEach((card) => {

            card.addEventListener(
                'click',
                () => {

                    const category =
                        card.dataset.category;


                    runSearch(
                        {
                            category
                        },

                        category
                    );
                }
            );
        });


    loadInitialJobs();
}