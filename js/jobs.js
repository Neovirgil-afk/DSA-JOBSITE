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

    const JOBS_PER_PAGE = 9;
    let currentJobs = [];
    let currentHeading = '';
    let currentPage = 1;

    if (
        !resultsSection ||
        !resultsGrid ||
        !resultsTitle
    ) {

        return;
    }

    const pagination = document.createElement('div');
    pagination.className = 'jobs-pagination';
    pagination.hidden = true;
    resultsGrid.insertAdjacentElement('afterend', pagination);


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

        pagination.hidden = true;
        pagination.innerHTML = '';
    }


    /* =====================================================
       RENDER JOBS
       ===================================================== */

    function renderPagination(totalJobs) {
        const totalPages = Math.ceil(totalJobs / JOBS_PER_PAGE);

        if (totalPages <= 1) {
            pagination.hidden = true;
            pagination.innerHTML = '';
            return;
        }

        pagination.hidden = false;

        const pageButtons = [];
        for (let page = 1; page <= totalPages; page++) {
            pageButtons.push(
                '<button type="button" class="jobs-page-number' +
                (page === currentPage ? ' active' : '') +
                '" data-page="' + page + '" aria-label="Go to page ' + page + '"' +
                (page === currentPage ? ' aria-current="page"' : '') +
                '>' + page + '</button>'
            );
        }

        pagination.innerHTML =
            '<div class="jobs-pagination-summary">Showing ' +
                (((currentPage - 1) * JOBS_PER_PAGE) + 1) +
                '–' +
                Math.min(currentPage * JOBS_PER_PAGE, totalJobs) +
                ' of ' + totalJobs + ' jobs' +
            '</div>' +
            '<div class="jobs-pagination-controls">' +
                '<button type="button" class="jobs-page-arrow" data-page="' + (currentPage - 1) + '" ' +
                    (currentPage === 1 ? 'disabled' : '') + '>← Prev</button>' +
                pageButtons.join('') +
                '<button type="button" class="jobs-page-arrow" data-page="' + (currentPage + 1) + '" ' +
                    (currentPage === totalPages ? 'disabled' : '') + '>Next →</button>' +
            '</div>' +
            '<div class="jobs-pagination-label">Page ' + currentPage + ' of ' + totalPages + '</div>';
    }

    function renderJobPage(page, shouldScroll = false) {
        const totalPages = Math.max(1, Math.ceil(currentJobs.length / JOBS_PER_PAGE));
        currentPage = Math.min(Math.max(page, 1), totalPages);

        resultsGrid.innerHTML = '';

        if (!currentJobs.length) {
            resultsGrid.innerHTML =
                '<p class="results-empty">No jobs matched that search yet. Try a different keyword or category.</p>';
            pagination.hidden = true;
        } else {
            const start = (currentPage - 1) * JOBS_PER_PAGE;
            const pageJobs = currentJobs.slice(start, start + JOBS_PER_PAGE);
            const frag = document.createDocumentFragment();

            pageJobs.forEach((job) => {
                const card = document.createElement('article');

                card.className = 'result-card';
                card.dataset.jobId = String(job.id);
                card.setAttribute('tabindex', '0');
                card.setAttribute(
                    'aria-label',
                    `View details for ${job.title || 'job'}`
                );

                card.innerHTML = `
                    <button
                        type="button"
                        class="job-save-button${savedJobIds.has(Number(job.id)) ? ' is-saved' : ''}"
                        data-job-id="${Number(job.id)}"
                        aria-pressed="${savedJobIds.has(Number(job.id))}"
                        aria-label="${savedJobIds.has(Number(job.id)) ? 'Remove saved job' : 'Save job'}"
                    >
                        ${savedJobIds.has(Number(job.id)) ? 'Saved' : 'Save job'}
                    </button>

                    <h3>${job.title}</h3>

                    <p class="company">${job.company || ''}</p>

                    <div class="meta">
                        <span>${job.location || 'Remote'}</span>
                        ${job.employment_type ? `<span>${job.employment_type}</span>` : ''}
                        ${money(job)}
                    </div>

                    ${
                        typeof job.matchScore === 'number'
                            ? `
                                <div class="job-match-row">
                                    <span class="match">${job.matchScore}% match</span>
                                    ${job.matchScore > 0
                                        ? '<span class="job-match-label">Based on your skills</span>'
                                        : ''}
                                </div>
                            `
                            : ''
                    }
                `;

                frag.appendChild(card);
            });

            resultsGrid.appendChild(frag);
            renderPagination(currentJobs.length);
        }

        resultsTitle.textContent = currentHeading;
        resultsSection.hidden = false;

        if (shouldScroll) {
            resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    function uniqueJobs(jobs) {
        const seen = new Set();

        return jobs.filter((job) => {
            const key = [
                job.title,
                job.company,
                job.location,
                job.category,
                job.salary,
                job.employment_type,
                job.description
            ].map((value) => String(value ?? '').trim().toLowerCase()).join('|');

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });
    }

    function renderJobs(jobs, heading, shouldScroll = true) {
        currentJobs = uniqueJobs(Array.isArray(jobs) ? jobs : []);
        currentHeading = heading;
        currentPage = 1;
        renderJobPage(1, shouldScroll);
    }

    /* =====================================================
       DEBUG
       ===================================================== */

    const debugEnabled =
        new URLSearchParams(window.location.search).get('debug') === '1';

    let debugPanel = null;

    function debugNote(message, type = 'info') {
        console.debug('[JobPath DEBUG]', message);

        if (!debugEnabled) {
            return;
        }

        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.className = 'job-debug-panel';
            debugPanel.innerHTML = `
                <strong>JobPath Debug</strong>
                <button type="button" class="job-debug-clear">Clear</button>
                <div class="job-debug-log"></div>
            `;
            document.body.appendChild(debugPanel);

            debugPanel
                .querySelector('.job-debug-clear')
                .addEventListener('click', () => {
                    debugPanel.querySelector('.job-debug-log').innerHTML = '';
                });
        }

        const row = document.createElement('div');
        row.className = `job-debug-row job-debug-row--${type}`;
        row.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

        debugPanel.querySelector('.job-debug-log').appendChild(row);
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            timeoutMs
        );

        try {
            return await fetch(
                url,
                {
                    ...options,
                    signal: controller.signal
                }
            );
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
            }

            throw error;
        } finally {
            clearTimeout(timeout);
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
       JOB DETAILS MODAL
       ===================================================== */

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function createJobDetailsModal() {
        if (document.querySelector('#jobDetailsModal')) {
            return document.querySelector('#jobDetailsModal');
        }

        const modal = document.createElement('div');

        modal.id = 'jobDetailsModal';
        modal.className = 'job-details-modal';
        modal.hidden = true;

        modal.innerHTML = `
            <div class="job-details-backdrop" data-job-modal-close></div>

            <section
                class="job-details-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="jobDetailsTitle"
            >
                <button
                    type="button"
                    class="job-details-close"
                    data-job-modal-close
                    aria-label="Close job details"
                >
                    ✕
                </button>

                <div class="job-details-columns">
                    <div class="job-details-main">
                        <div class="job-details-header">
                            <p class="job-details-company" id="jobDetailsCompany"></p>
                            <h2 id="jobDetailsTitle">Job details</h2>
                            <div class="job-details-meta" id="jobDetailsMeta"></div>
                        </div>

                        <div class="job-details-match" id="jobDetailsMatch"></div>

                        <div class="job-details-section">
                            <h3>About the role</h3>
                            <p id="jobDetailsDescription"></p>
                        </div>

                        <div class="job-details-skills">
                            <div class="job-details-section">
                                <h3>You have</h3>
                                <div class="job-details-skill-list job-details-skill-list--have" id="jobDetailsHave"></div>
                            </div>

                            <div class="job-details-section">
                                <h3>Missing</h3>
                                <div class="job-details-skill-list job-details-skill-list--missing" id="jobDetailsMissing"></div>
                            </div>
                        </div>
                    </div>

                    <aside class="job-details-sidebar">
                        <div class="company-panel">
                            <span class="company-panel-label">About the company</span>
                            <h3 id="jobCompanyName">Company</h3>
                            <p id="jobCompanyDescription"></p>

                            <div class="company-contact" id="jobCompanyContact"></div>
                        </div>

                        <div class="resume-panel">
                            <span class="company-panel-label">Your resume</span>
                            <strong id="jobResumeStatus">No resume uploaded yet.</strong>
                            <p>Upload your resume here. It will be saved to your profile for future applications.</p>

                            <input
                                type="file"
                                id="jobResumeFile"
                                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                hidden
                            />

                            <label
                                class="resume-upload-dropzone"
                                id="jobResumeDropzone"
                                for="jobResumeFile"
                            >
                                <span class="resume-upload-icon">↑</span>
                                <span>Drop resume here or <strong>browse</strong></span>
                                <small>PDF or DOCX · Max 5MB</small>
                            </label>

                            <div class="resume-upload-status" id="jobResumeUploadStatus" aria-live="polite"></div>


                        </div>
                    </aside>
                </div>

                <div class="job-details-actions">
                    <button type="button" class="btn btn-primary" id="jobApplyButton">
                        Apply Now
                    </button>
                    <button type="button" class="job-details-secondary" data-job-modal-close>
                        Close
                    </button>
                </div>
            </section>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-job-modal-close]')) {
                closeJobDetails();
            }
        });

        return modal;
    }

    function closeJobDetails() {
        const modal = document.querySelector('#jobDetailsModal');

        if (!modal) {
            return;
        }

        modal.hidden = true;
        document.body.classList.remove('job-modal-open');
    }

    async function openJobDetails(jobId) {
        const modal = createJobDetailsModal();

        modal.hidden = false;
        document.body.classList.add('job-modal-open');

        document.querySelector('#jobDetailsCompany').textContent = '';
        document.querySelector('#jobDetailsTitle').textContent = 'Loading job...';
        document.querySelector('#jobDetailsMeta').innerHTML = '';
        document.querySelector('#jobDetailsMatch').innerHTML = '';
        document.querySelector('#jobDetailsDescription').textContent = 'Loading details...';
        document.querySelector('#jobDetailsHave').innerHTML = '';
        document.querySelector('#jobDetailsMissing').innerHTML = '';
        document.querySelector('#jobCompanyName').textContent = '';
        document.querySelector('#jobCompanyDescription').textContent = 'Loading company information...';
        document.querySelector('#jobCompanyContact').innerHTML = '';
        document.querySelector('#jobResumeStatus').textContent = 'Checking resume...';
        document.querySelector('#jobResumeUploadStatus').textContent = '';

        try {
            const response = await fetch(
                `/api/jobs/${encodeURIComponent(jobId)}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                throw new Error('Failed to load job details.');
            }

            const data = await response.json();
            const job = data.job || {};

            document.querySelector('#jobDetailsCompany').textContent =
                job.company || '';

            document.querySelector('#jobDetailsTitle').textContent =
                job.title || 'Job details';

            const metaItems = [
                job.location || 'Remote',
                job.employment_type || '',
                job.salary || '',
                data.experienceLevel || 'Intermediate'
            ].filter(Boolean);

            document.querySelector('#jobDetailsMeta').innerHTML =
                metaItems
                    .map((item) => `<span>${escapeHtml(item)}</span>`)
                    .join('');

            const score = Number(data.matchScore) || 0;

            document.querySelector('#jobDetailsMatch').innerHTML = `
                <strong>${score}% match</strong>
                <span>${score > 0 ? 'Based on your skills' : 'Upload a resume to personalize this match'}</span>
            `;

            document.querySelector('#jobDetailsDescription').textContent =
                job.description || 'No job description provided yet.';

            const company = data.company || {};

            document.querySelector('#jobCompanyName').textContent =
                job.company || 'Company';

            document.querySelector('#jobCompanyDescription').textContent =
                company.description || 'Company information will be available here.';

            const contactItems = [];

            if (company.email) {
                contactItems.push(
                    `<a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a>`
                );
            }

            if (company.phone) {
                contactItems.push(
                    `<a href="tel:${escapeHtml(company.phone)}">${escapeHtml(company.phone)}</a>`
                );
            }

            if (company.website) {
                contactItems.push(
                    `<a href="${escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer">Company website</a>`
                );
            }

            document.querySelector('#jobCompanyContact').innerHTML =
                contactItems.length
                    ? contactItems.join('')
                    : '<span>No contact information listed.</span>';

            const have = Array.isArray(data.matchingSkills)
                ? data.matchingSkills
                : [];

            const missing = Array.isArray(data.missingSkills)
                ? data.missingSkills
                : [];

            document.querySelector('#jobDetailsHave').innerHTML =
                have.length
                    ? have.map((skill) =>
                        `<span>${escapeHtml(skill)}</span>`
                    ).join('')
                    : '<span class="job-details-empty">No matching skills yet.</span>';

            document.querySelector('#jobDetailsMissing').innerHTML =
                missing.length
                    ? missing.map((skill) =>
                        `<span>${escapeHtml(skill)}</span>`
                    ).join('')
                    : '<span class="job-details-empty">You meet the listed skill requirements.</span>';
            async function refreshJobResume() {
                const resumeResponse = await fetch(
                    '/api/resume/current',
                    { credentials: 'include' }
                );

                if (!resumeResponse.ok) {
                    throw new Error('Could not check resume.');
                }

                const resumeData = await resumeResponse.json();
                const resume = resumeData.resume;

                const status = document.querySelector('#jobResumeStatus');
                const view = document.querySelector('#jobResumeView');

                if (resume) {
                    status.textContent = 'Resume saved to your profile';
                    view.hidden = true;
                } else {
                    status.textContent = 'No resume uploaded yet.';
                    view.hidden = true;
                }
            }

            refreshJobResume().catch(() => {
                document.querySelector('#jobResumeStatus').textContent =
                    'Upload a resume to apply quickly.';
            });
            const resumeFile =
                document.querySelector('#jobResumeFile');

            const resumeDropzone =
                document.querySelector('#jobResumeDropzone');

            const resumeUploadStatus =
                document.querySelector('#jobResumeUploadStatus');

            async function uploadJobResume(file) {
                if (!file) {
                    return;
                }

                const extension =
                    file.name.toLowerCase().split('.').pop();

                if (!['pdf', 'docx'].includes(extension)) {
                    resumeUploadStatus.textContent =
                        'Please upload a PDF or DOCX file.';
                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    resumeUploadStatus.textContent =
                        'File is too large. Maximum size is 5MB.';
                    return;
                }

                const formData = new FormData();
                formData.append('resume', file);

                resumeUploadStatus.textContent =
                    'Uploading and saving resume...';

                try {
                    const uploadResponse = await fetch(
                        '/api/resume/scan',
                        {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                        }
                    );

                    const uploadData =
                        await uploadResponse.json();

                    if (!uploadResponse.ok) {
                        throw new Error(
                            uploadData.error ||
                            'Failed to upload resume.'
                        );
                    }

                    resumeUploadStatus.textContent =
                        'Resume saved to your profile.';

                    await refreshJobResume();
                } catch (uploadError) {
                    resumeUploadStatus.textContent =
                        uploadError.message ||
                        'Failed to upload resume.';
                }
            }

            if (resumeFile) {
                resumeFile.onchange = () => {
                    uploadJobResume(resumeFile.files?.[0]);
                };
            }

            if (resumeDropzone) {
                ['dragenter', 'dragover'].forEach((eventName) => {
                    resumeDropzone.addEventListener(eventName, (event) => {
                        event.preventDefault();
                        resumeDropzone.classList.add('is-dragging');
                    });
                });

                ['dragleave', 'drop'].forEach((eventName) => {
                    resumeDropzone.addEventListener(eventName, (event) => {
                        event.preventDefault();
                        resumeDropzone.classList.remove('is-dragging');
                    });
                });

                resumeDropzone.addEventListener('drop', (event) => {
                    uploadJobResume(event.dataTransfer.files?.[0]);
                });
            }




            const applyButton =
                document.querySelector('#jobApplyButton');

            applyButton.onclick = () => {
                if (job.apply_url) {
                    window.open(job.apply_url, '_blank', 'noopener,noreferrer');
                    return;
                }

                alert('Application link is not configured for this job yet.');
            };

        } catch (error) {
            document.querySelector('#jobDetailsTitle').textContent =
                'Unable to load job';

            document.querySelector('#jobDetailsDescription').textContent =
                'Something went wrong while loading this job. Please try again.';

            console.error(
                '[JobPath] Failed to load job details:',
                error
            );
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

        debugNote('Initial job loading started.');
        debugNote('Step 1: loading saved job IDs...');

        try {
            await Promise.race([
                loadSavedJobIds(),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(
                            new Error('Saved jobs request timed out after 7s.')
                        ),
                        7000
                    )
                )
            ]);

            debugNote('Step 1 complete: saved jobs loaded.');

            debugNote('Step 2: requesting /api/jobs/recommended...');

            const recommendationStartedAt = Date.now();

            let recommendedResponse;

            try {
                recommendedResponse = await fetchWithTimeout(
                    '/api/jobs/recommended',
                    { credentials: 'include' },
                    7000
                );
            } catch (error) {
                debugNote(
                    `Step 2 failed: ${error.message}. Falling back to featured jobs.`,
                    'error'
                );

                const jobs = await fetchJobs({});
                debugNote(
                    `Fallback complete: ${jobs.length} featured jobs loaded.`,
                    'success'
                );

                renderJobs(
                    jobs.slice(0, 6),
                    'Featured jobs',
                    false
                );
                return;
            }

            debugNote(
                `Step 2 response received: HTTP ${recommendedResponse.status} in ${Date.now() - recommendationStartedAt}ms.`
            );

            if (recommendedResponse.ok) {
                const recommendedData =
                    await recommendedResponse.json();

                debugNote(
                    `Step 3: recommendation JSON parsed. ${Array.isArray(recommendedData.jobs) ? recommendedData.jobs.length : 0} jobs returned.`
                );

                if (recommendedData.debug) {
                    debugNote(
                        `Backend: ${recommendedData.debug.userSkills} skills → ${recommendedData.debug.jobsRanked} jobs in ${recommendedData.debug.durationMs}ms.`,
                        'success'
                    );
                }

                const recommendedJobs =
                    Array.isArray(recommendedData.jobs)
                        ? recommendedData.jobs
                        : [];

                const hasSkillMatch =
                    recommendedJobs.some(
                        (job) => Number(job.matchScore) > 0
                    );

                if (hasSkillMatch) {
                    debugNote(
                        'Step 4 complete: rendering Recommended for You.',
                        'success'
                    );

                    renderJobs(
                        recommendedJobs.slice(0, 6),
                        'Recommended for You',
                        false
                    );
                    return;
                }

                debugNote(
                    'No positive skill match found. Falling back to featured jobs.'
                );
            } else {
                let errorMessage = `HTTP ${recommendedResponse.status}`;

                try {
                    const errorData =
                        await recommendedResponse.json();

                    if (errorData.error) {
                        errorMessage += `: ${errorData.error}`;
                    }

                    if (errorData.debug?.message) {
                        errorMessage +=
                            ` | ${errorData.debug.message}`;
                    }
                } catch (_) {
                    // Keep the HTTP status when the response is not JSON.
                }

                debugNote(
                    `Recommendation endpoint failed: ${errorMessage}. Falling back to featured jobs.`,
                    'error'
                );
            }

            debugNote('Step 5: loading featured jobs fallback...');

            const jobs =
                await fetchJobs({});

            debugNote(
                `Fallback complete: ${jobs.length} featured jobs loaded.`,
                'success'
            );

            renderJobs(
                jobs.slice(0, 6),
                'Featured jobs',
                false
            );
        } catch (error) {
            resultsGrid.innerHTML =
                '<p class="results-empty">Something went wrong loading jobs. Open the page with <strong>?debug=1</strong> to see what failed.</p>';

            debugNote(
                `INITIAL LOAD ERROR: ${error.message}`,
                'error'
            );

            console.error(
                '[JobPath] Failed to load initial jobs:',
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

    pagination.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');

        if (!button || button.disabled) {
            return;
        }

        renderJobPage(Number(button.dataset.page), true);
    });


    resultsGrid.addEventListener(
        'click',
        (event) => {
            const saveButton =
                event.target.closest('.job-save-button');

            if (saveButton) {
                event.stopPropagation();
                toggleSavedJob(saveButton);
                return;
            }

            const card =
                event.target.closest('.result-card[data-job-id]');

            if (card) {
                openJobDetails(card.dataset.jobId);
            }
        }
    );

    resultsGrid.addEventListener(
        'keydown',
        (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            const card =
                event.target.closest('.result-card[data-job-id]');

            if (!card || event.target.closest('button')) {
                return;
            }

            event.preventDefault();
            openJobDetails(card.dataset.jobId);
        }
    );

    document.addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Escape') {
                closeJobDetails();
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