'use strict';

const $ = (id) => document.querySelector('#' + id);

const state = {
    education: [],
    experience: [],
    projects: [],
    certifications: []
};

const factories = {
    education: () => ({
        school: '',
        degree: '',
        year: ''
    }),
    experience: () => ({
        title: '',
        company: '',
        duration: '',
        description: ''
    }),
    projects: () => ({
        name: '',
        description: ''
    }),
    certifications: () => ({
        name: '',
        issuer: '',
        year: ''
    })
};

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function field(label, key, value, placeholder) {
    return `
        <div class="builder-field">
            <label>${label}</label>
            <input data-key="${key}"
                   value="${esc(value)}"
                   placeholder="${esc(placeholder || '')}">
        </div>
    `;
}

function area(label, key, value, placeholder) {
    return `
        <div class="builder-field">
            <label>${label}</label>
            <textarea data-key="${key}"
                      placeholder="${esc(placeholder || '')}">${esc(value)}</textarea>
        </div>
    `;
}

function attachSchoolAutocomplete(input) {
    if (!input || input.dataset.autocompleteReady === '1') {
        return;
    }

    const wrapper = input.closest('.builder-field');
    if (!wrapper) return;

    let results = wrapper.querySelector('.builder-autocomplete-results');
    if (!results) {
        results = document.createElement('div');
        results.className = 'builder-autocomplete-results';
        wrapper.appendChild(results);
    }

    input.dataset.autocompleteReady = '1';
    let timer = null;

    const hide = () => {
        results.classList.remove('show');
        results.innerHTML = '';
    };

    const search = async () => {
        const q = input.value.trim();

        if (q.length < 2) {
            hide();
            return;
        }

        clearTimeout(timer);
        timer = setTimeout(async () => {
            try {
                const response = await fetch(
                    '/api/reference/schools/search?q=' + encodeURIComponent(q)
                );
                if (!response.ok) throw new Error('School search failed.');

                const data = await response.json();
                const schools = Array.isArray(data.schools)
                    ? data.schools.slice(0, 8)
                    : [];

                results.innerHTML = '';

                if (!schools.length) {
                    results.innerHTML =
                        '<div class="builder-autocomplete-empty">No matching schools found</div>';
                    results.classList.add('show');
                    return;
                }

                schools.forEach((school) => {
                    const item = document.createElement('div');
                    item.className = 'builder-autocomplete-item';
                    item.textContent = school.name;
                    item.addEventListener('mousedown', (event) => {
                        event.preventDefault();
                        input.value = school.name;
                        hide();
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                    results.appendChild(item);
                });

                results.classList.add('show');
            } catch (error) {
                console.warn('[builder] school autocomplete:', error);
                hide();
            }
        }, 180);
    };

    input.addEventListener('input', search);
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) search();
    });
    input.addEventListener('blur', () => {
        setTimeout(hide, 120);
    });
}

function renderEntries(type) {
    const list = $(type + 'List');
    const entries = state[type];

    if (!list) return;

    if (!entries.length) {
        list.innerHTML =
            '<p class="builder-section-note">Nothing added yet.</p>';
        return;
    }

    list.innerHTML = entries.map((item, index) => {
        let body = '';

        if (type === 'education') {
            body =
                '<div class="builder-two">' +
                field('SCHOOL', 'school', item.school, 'University / College') +
                field('DEGREE / FIELD', 'degree', item.degree, 'BS Computer Engineering') +
                '</div>' +
                field('YEAR', 'year', item.year, '2026');
        } else if (type === 'experience') {
            body =
                '<div class="builder-two">' +
                field('JOB TITLE', 'title', item.title, 'Frontend Developer') +
                field('COMPANY', 'company', item.company, 'Company name') +
                '</div>' +
                field('DURATION', 'duration', item.duration, '2024 — Present') +
                area('DESCRIPTION', 'description', item.description, 'What you worked on and accomplished.');
        } else if (type === 'projects') {
            body =
                field('PROJECT NAME', 'name', item.name, 'JobPath') +
                area('DESCRIPTION', 'description', item.description, 'What you built and the technologies you used.');
        } else {
            body =
                '<div class="builder-two">' +
                field('CERTIFICATION', 'name', item.name, 'AWS Certified ...') +
                field('ISSUER', 'issuer', item.issuer, 'Issuing organization') +
                '</div>' +
                field('YEAR', 'year', item.year, '2026');
        }

        return `
            <div class="builder-entry" data-index="${index}">
                ${body}
                <div class="builder-entry-actions">
                    <button type="button"
                            class="builder-remove"
                            data-remove="${index}">
                        Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.builder-entry').forEach((entry) => {
        const index = Number(entry.dataset.index);

        entry.querySelectorAll('[data-key]').forEach((input) => {
            input.addEventListener('input', () => {
                state[type][index][input.dataset.key] = input.value;
                renderPreview();
            });
        });

        const remove = entry.querySelector('[data-remove]');
        if (remove) {
            remove.addEventListener('click', () => {
                state[type].splice(index, 1);
                renderEntries(type);
                renderPreview();
            });
        }

        if (type === 'education') {
            attachSchoolAutocomplete(entry.querySelector('[data-key="school"]'));
        }
    });
}

function collect() {
    return {
        fullName: $('#fullName').value.trim(),
        email: $('#email').value.trim(),
        phone: $('#phone').value.trim(),
        location: $('#location').value.trim(),
        summary: $('#summary').value.trim(),
        education: state.education,
        experience: state.experience,
        projects: state.projects,
        certifications: state.certifications
    };
}

function renderPreview() {
    const resume = collect();

    const contact = [
        resume.email,
        resume.phone,
        resume.location
    ].filter(Boolean).join(' · ');

    let html =
        '<h1>' + esc(resume.fullName || 'Your Name') + '</h1>' +
        '<div class="resume-contact">' +
        esc(contact || 'email · phone · location') +
        '</div>';

    if (resume.summary) {
        html +=
            '<h4>Profile</h4>' +
            '<p>' + esc(resume.summary) + '</p>';
    }

    if (resume.experience.length) {
        html += '<h4>Experience</h4>';

        html += resume.experience.map((item) =>
            '<div class="resume-item">' +
            '<strong>' + esc(item.title || 'Job Title') + '</strong>' +
            '<div class="resume-muted">' +
            esc(item.company) +
            (item.duration ? ' · ' + esc(item.duration) : '') +
            '</div>' +
            '<p>' + esc(item.description) + '</p>' +
            '</div>'
        ).join('');
    }

    if (resume.projects.length) {
        html += '<h4>Projects</h4>';

        html += resume.projects.map((item) =>
            '<div class="resume-item">' +
            '<strong>' + esc(item.name || 'Project') + '</strong>' +
            '<p>' + esc(item.description) + '</p>' +
            '</div>'
        ).join('');
    }

    if (resume.education.length) {
        html += '<h4>Education</h4>';

        html += resume.education.map((item) =>
            '<div class="resume-item">' +
            '<strong>' + esc(item.degree || 'Degree') + '</strong>' +
            '<div class="resume-muted">' +
            esc(item.school) +
            (item.year ? ' · ' + esc(item.year) : '') +
            '</div>' +
            '</div>'
        ).join('');
    }

    if (resume.certifications.length) {
        html += '<h4>Certifications</h4>';

        html += resume.certifications.map((item) =>
            '<div class="resume-item">' +
            '<strong>' + esc(item.name || 'Certification') + '</strong>' +
            '<div class="resume-muted">' +
            esc(item.issuer) +
            (item.year ? ' · ' + esc(item.year) : '') +
            '</div>' +
            '</div>'
        ).join('');
    }

    $('#resumePaper').innerHTML = html;
}

function addEntry(type) {
    if (!factories[type]) return;

    state[type].push(factories[type]());
    renderEntries(type);
    renderPreview();
}

async function loadLocationSuggestions() {
    const input = $('#location');
    const results = $('#locationResults');

    if (!input || !results) return;

    let timer = null;

    const hide = () => {
        results.classList.remove('show');
        results.innerHTML = '';
    };

    const search = () => {
        const q = input.value.trim();

        if (q.length < 2) {
            hide();
            return;
        }

        clearTimeout(timer);

        timer = setTimeout(async () => {
            try {
                const response = await fetch(
                    '/api/reference/locations/search?q=' +
                    encodeURIComponent(q)
                );

                if (!response.ok) {
                    throw new Error('Location search failed.');
                }

                const data = await response.json();

                const locations = Array.isArray(data.locations)
                    ? data.locations.slice(0, 8)
                    : [];

                results.innerHTML = '';

                if (!locations.length) {
                    results.innerHTML =
                        '<div class="builder-autocomplete-empty">No matching Philippine locations found</div>';
                    results.classList.add('show');
                    return;
                }

                locations.forEach((location) => {
                    const item = document.createElement('div');
                    item.className = 'builder-autocomplete-item';

                    item.textContent = location.province
                        ? location.name + ', ' + location.province
                        : location.name;

                    item.addEventListener('mousedown', (event) => {
                        event.preventDefault();

                        input.value = item.textContent;
                        hide();
                        renderPreview();
                    });

                    results.appendChild(item);
                });

                results.classList.add('show');
            } catch (error) {
                console.warn('[builder] location autocomplete:', error);
                hide();
            }
        }, 180);
    };

    input.addEventListener('input', () => {
        search();
        renderPreview();
    });

    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) search();
    });

    input.addEventListener('blur', () => {
        setTimeout(hide, 120);
    });
}

async function load() {
    try {
        const [builderResponse, profileResponse] = await Promise.all([
            fetch('/api/resume/builder', {
                credentials: 'include'
            }),
            fetch('/api/auth/profile', {
                credentials: 'include'
            })
        ]);

        if (profileResponse.status === 401) {
            location.href = '/';
            return;
        }

        const profileData = await profileResponse.json();
        const profile = profileData.profile || {};

        const builderData = builderResponse.ok
            ? (await builderResponse.json()).resume
            : null;

        const resume = builderData || {
            fullName: profile.full_name || '',
            email: profile.email || '',
            phone: '',
            location: profile.location || '',
            summary: '',
            education: profile.education || profile.degree
                ? [{
                    school: profile.education || '',
                    degree: profile.degree || '',
                    year: ''
                }]
                : [],
            experience: [],
            projects: [],
            certifications: []
        };

        ['fullName', 'email', 'phone', 'location', 'summary']
            .forEach((key) => {
                const input = $('#' + key);
                if (!input) return;

                input.value = resume[key] || '';

                input.addEventListener('input', renderPreview);
            });

        state.education = Array.isArray(resume.education)
            ? resume.education
            : [];

        state.experience = Array.isArray(resume.experience)
            ? resume.experience
            : [];

        state.projects = Array.isArray(resume.projects)
            ? resume.projects
            : [];

        state.certifications = Array.isArray(resume.certifications)
            ? resume.certifications
            : [];

        ['education', 'experience', 'projects', 'certifications']
            .forEach(renderEntries);

        await loadLocationSuggestions();

        renderPreview();

        $('#builderStatus').textContent =
            'Your profile information is connected.';
    } catch (error) {
        console.error('[builder] load error:', error);
        $('#builderStatus').textContent =
            'Unable to load your resume.';
    }
}

async function saveResume() {
    const button = $('#saveResume');
    const status = $('#builderStatus');

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
        const response = await fetch('/api/resume/builder', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                resume: collect()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || 'Failed to save resume.'
            );
        }

        status.textContent = 'Saved to your profile.';
    } catch (error) {
        console.error('[builder] save error:', error);
        status.textContent = error.message;
    } finally {
        button.disabled = false;
        button.textContent = 'Save Resume';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = $('#builderForm');

    if (!form) return;

    form.addEventListener('click', (event) => {
        const addButton = event.target.closest('[data-add]');

        if (addButton) {
            event.preventDefault();
            addEntry(addButton.dataset.add);
            return;
        }
    });

    $('#saveResume').addEventListener('click', saveResume);
    $('#printResume').addEventListener('click', () => window.print());

    load();
});
