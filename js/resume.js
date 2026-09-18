'use strict';

const fileInput = document.querySelector('#resumeFile');
const dropzone = document.querySelector('#dropzone');
const fileName = document.querySelector('#fileName');
const scanButton = document.querySelector('#scanButton');
const statusBox = document.querySelector('#status');
const skillsBox = document.querySelector('#skills');
const jobsBox = document.querySelector('#jobs');
const careerPathBox = document.querySelector('#careerPath');

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setStatus(message, type = 'info') {
    statusBox.textContent = message;
    statusBox.className = `status show ${type}`;
}

function clearStatus() {
    statusBox.textContent = '';
    statusBox.className = 'status';
}

function updateSelectedFile() {
    const file = fileInput.files?.[0];
    fileName.textContent = file ? `${file.name} (${Math.ceil(file.size / 1024)} KB)` : 'No file selected';
    scanButton.disabled = !file;
}

function renderSkills(skills) {
    if (!skills.length) {
        skillsBox.innerHTML = '<span class="empty">No known skills were detected. You can add skills manually from your profile.</span>';
        return;
    }

    skillsBox.innerHTML = skills
        .map((skill) => `<span class="skill">${escapeHTML(skill)}</span>`)
        .join('');
}

function renderJobs(jobs) {
    if (!jobs.length) {
        jobsBox.innerHTML = '<div class="empty">No recommended jobs are available yet.</div>';
        return;
    }

    jobsBox.innerHTML = jobs.map((job) => {
        const matching = Array.isArray(job.matchingSkills) ? job.matchingSkills : [];
        const missing = Array.isArray(job.missingSkills) ? job.missingSkills : [];

        return `
            <article class="job">
                <div class="job-top">
                    <div>
                        <h3>${escapeHTML(job.title)}</h3>
                        <div class="job-company">${escapeHTML(job.company || 'Company not listed')} · ${escapeHTML(job.location || 'Remote')}</div>
                    </div>
                    <div class="match">${Number(job.matchScore) || 0}% Match</div>
                </div>
                ${matching.length ? `
                    <div class="tags">
                        ${matching.map((skill) => `<span class="tag">✓ ${escapeHTML(skill)}</span>`).join('')}
                    </div>
                ` : ''}
                ${missing.length ? `
                    <div class="tags">
                        ${missing.map((skill) => `<span class="tag missing">⚠ ${escapeHTML(skill)}</span>`).join('')}
                    </div>
                ` : ''}
                <button type="button" class="career-path-button" data-job-id="${Number(job.id) || 0}">
                    View skill path →
                </button>
            </article>
        `;
    }).join('');
}



function resourceIcon(type) {
    return type === 'youtube' ? '▶' : '↗';
}

function renderLearningResources(steps) {
    const missingSteps = steps.filter((step) => !step.completed);

    if (!missingSteps.length) {
        return `
            <div class="learning-empty">
                <span class="learning-empty-icon">✓</span>
                <div>
                    <strong>You're caught up.</strong>
                    <p>You already have every skill in this path. Keep practicing and build a project to strengthen them.</p>
                </div>
            </div>
        `;
    }

    return `
        <section class="learning-section">
            <div class="learning-heading">
                <div>
                    <span class="career-path-eyebrow">LEARNING RESOURCES</span>
                    <h4>Learn the skills you're missing</h4>
                </div>
                <span class="learning-count">${missingSteps.length} skill${missingSteps.length === 1 ? '' : 's'} to develop</span>
            </div>
            <div class="learning-groups">
                ${missingSteps.map((step) => `
                    <div class="learning-group">
                        <div class="learning-skill">
                            <span class="career-step-number">${escapeHTML(step.order)}</span>
                            <div>
                                <strong>${escapeHTML(step.skill)}</strong>
                                <small>Recommended before moving to the next step</small>
                            </div>
                        </div>
                        <div class="learning-resources">
                            ${(Array.isArray(step.resources) ? step.resources : []).map((resource) => `
                                <a class="learning-resource learning-resource--${escapeHTML(resource.type || 'article')}" href="${escapeHTML(resource.url)}" target="_blank" rel="noopener noreferrer">
                                    <span class="learning-resource-icon">${resourceIcon(resource.type)}</span>
                                    <span class="learning-resource-copy">
                                        <strong>${escapeHTML(resource.title)}</strong>
                                        <small>${escapeHTML(resource.provider || 'Learning resource')} · ${escapeHTML(resource.description || 'Open resource')}</small>
                                    </span>
                                    <span class="learning-resource-arrow">↗</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

async function showCareerPath(jobId) {
    if (!careerPathBox || !jobId) return;

    careerPathBox.innerHTML = '<div class="career-path-loading">Loading your skill path...</div>';

    try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
            credentials: 'include'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load skill path.');

        const path = data.careerPath;
        const steps = Array.isArray(path?.steps) ? path.steps : [];

        if (!steps.length) {
            careerPathBox.innerHTML = '<div class="career-path-empty">No learning path has been configured for this job yet.</div>';
        } else {
            const completedCount = steps.filter((step) => step.completed).length;
            const missingCount = steps.length - completedCount;

            careerPathBox.innerHTML = `
                <div class="career-path-title">
                    <div>
                        <span class="career-path-eyebrow">SKILL GAP</span>
                        <h3>Path to ${escapeHTML(data.job?.title || 'this job')}</h3>
                        <p class="career-path-subtitle">${completedCount} of ${steps.length} skills already covered · ${missingCount} to develop</p>
                    </div>
                    <button type="button" class="career-path-close" aria-label="Close skill path">×</button>
                </div>

                <div class="career-progress">
                    <div class="career-progress-track"><span style="width:${Math.round((completedCount / steps.length) * 100)}%"></span></div>
                    <span>${Math.round((completedCount / steps.length) * 100)}%</span>
                </div>

                <div class="career-steps">
                    ${steps.map((step) => `
                        <div class="career-step ${step.completed ? 'completed' : ''}">
                            <span class="career-step-number">${step.completed ? '✓' : escapeHTML(step.order)}</span>
                            <div>
                                <strong>${escapeHTML(step.skill)}</strong>
                                <small>${step.completed ? 'Already in your skills' : 'Skill to develop'}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${renderLearningResources(steps)}

                <p class="career-path-note">The skill sequence comes from the project's Graph-based career path. Learning links are curated starting points; JobSite does not track completion yet.</p>
            `;
        }

        careerPathBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        careerPathBox.innerHTML = `<div class="career-path-empty">${escapeHTML(error.message || 'Unable to load skill path.')}</div>`;
    }
}

async function loadRecommendations() {
    jobsBox.innerHTML = '<div class="empty">Calculating your recommendations...</div>';

    try {
        const response = await fetch('/api/jobs/recommended', {
            credentials: 'include'
        });

        if (response.status === 401) {
            jobsBox.innerHTML = '<div class="empty">Please log in first to receive personalized job recommendations.</div>';
            return;
        }

        if (!response.ok) throw new Error('Failed to load recommendations.');

        const data = await response.json();
        renderJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
        console.error('[resume] recommendation error:', error);
        jobsBox.innerHTML = '<div class="empty">Unable to load recommendations right now.</div>';
    }
}

async function scanResume() {
    const file = fileInput.files?.[0];
    if (!file) return;

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.pdf', '.docx'].includes(extension)) {
        setStatus('Only PDF and DOCX files are allowed.', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setStatus('File is too large. Maximum size is 5MB.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    scanButton.disabled = true;
    scanButton.textContent = 'Scanning...';
    setStatus('Reading your resume and detecting skills...', 'info');

    try {
        const response = await fetch('/api/resume/scan', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            throw new Error('Please log in before uploading a resume.');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to scan resume.');
        }

        renderSkills(Array.isArray(data.detectedSkills) ? data.detectedSkills : []);

        const count = Array.isArray(data.detectedSkills) ? data.detectedSkills.length : 0;
        const warning = data.warning ? ` ${data.warning}` : '';
        setStatus(`Resume analyzed successfully. ${count} skill${count === 1 ? '' : 's'} detected and saved to your profile.${warning}`, 'success');

        await loadRecommendations();
    } catch (error) {
        console.error('[resume] scan error:', error);
        setStatus(error.message || 'Failed to scan resume.', 'error');
    } finally {
        scanButton.disabled = !fileInput.files?.[0];
        scanButton.textContent = 'Scan Resume';
    }
}

fileInput.addEventListener('change', () => {
    clearStatus();
    updateSelectedFile();
});

dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInput.files = transfer.files;
        updateSelectedFile();
        clearStatus();
    } catch (error) {
        console.error('[resume] drag/drop error:', error);
    }
});

scanButton.addEventListener('click', scanResume);

loadRecommendations();


jobsBox.addEventListener('click', (event) => {
    const button = event.target.closest('.career-path-button');
    if (!button) return;
    showCareerPath(Number(button.dataset.jobId));
});

careerPathBox?.addEventListener('click', (event) => {
    if (event.target.closest('.career-path-close')) {
        careerPathBox.innerHTML = '';
        careerPathBox.classList.remove('show');
    }
});
