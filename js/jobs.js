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

    function renderJobs(jobs, heading) {

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


        resultsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
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
}