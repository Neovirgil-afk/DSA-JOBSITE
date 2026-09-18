'use strict';

(function () {
    function debug(message) {
        console.log('[Resume Builder]', message);
        var log = document.getElementById('builderDebugLog');
        if (log) {
            var row = document.createElement('div');
            row.textContent = new Date().toLocaleTimeString() + ' - ' + message;
            log.appendChild(row);
            log.scrollTop = log.scrollHeight;
        }
    }

    function $(id) {
        return document.getElementById(id);
    }

    var state = {
        education: [],
        experience: [],
        projects: [],
        certifications: []
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function collect() {
        return {
            fullName: $('fullName').value,
            email: $('email').value,
            phone: $('phone').value,
            location: $('location').value,
            summary: $('summary').value,
            education: state.education,
            experience: state.experience,
            projects: state.projects,
            certifications: state.certifications
        };
    }

    function renderPreview() {
        var paper = $('resumePaper');
        if (!paper) {
            debug('ERROR: resumePaper not found.');
            return;
        }

        var resume = collect();
        var contact = [resume.email, resume.phone, resume.location]
            .filter(function (x) { return x && x.trim(); })
            .join(' · ');

        var html = '<h1>' + escapeHtml(resume.fullName.trim() || 'Your Name') + '</h1>';
        html += '<div class="resume-contact">' +
            escapeHtml(contact || 'email · phone · location') +
            '</div>';

        if (resume.summary.trim()) {
            html += '<h4>Profile</h4><p>' +
                escapeHtml(resume.summary.trim()) + '</p>';
        }

        if (state.education.length) {
            html += '<h4>Education</h4>';
            state.education.forEach(function (item) {
                html += '<div class="resume-item"><strong>' +
                    escapeHtml(item.degree || 'Degree') +
                    '</strong><div class="resume-muted">' +
                    escapeHtml(item.school) +
                    (item.year ? ' · ' + escapeHtml(item.year) : '') +
                    '</div></div>';
            });
        }

        if (state.experience.length) {
            html += '<h4>Experience</h4>';
            state.experience.forEach(function (item) {
                html += '<div class="resume-item"><strong>' +
                    escapeHtml(item.title || 'Job Title') +
                    '</strong><div class="resume-muted">' +
                    escapeHtml(item.company) +
                    (item.duration ? ' · ' + escapeHtml(item.duration) : '') +
                    '</div><p>' + escapeHtml(item.description) +
                    '</p></div>';
            });
        }

        if (state.projects.length) {
            html += '<h4>Projects</h4>';
            state.projects.forEach(function (item) {
                html += '<div class="resume-item"><strong>' +
                    escapeHtml(item.name || 'Project') +
                    '</strong><p>' + escapeHtml(item.description) +
                    '</p></div>';
            });
        }

        if (state.certifications.length) {
            html += '<h4>Certifications</h4>';
            state.certifications.forEach(function (item) {
                html += '<div class="resume-item"><strong>' +
                    escapeHtml(item.name || 'Certification') +
                    '</strong><div class="resume-muted">' +
                    escapeHtml(item.issuer) +
                    (item.year ? ' · ' + escapeHtml(item.year) : '') +
                    '</div></div>';
            });
        }

        paper.innerHTML = html;
        debug('Live Preview rendered.');
    }

    function input(label, key, value, placeholder) {
        return '<div class="builder-field"><label>' + label +
            '</label><input data-key="' + key + '" value="' +
            escapeHtml(value) + '" placeholder="' +
            escapeHtml(placeholder || '') + '"></div>';
    }

    function textarea(label, key, value, placeholder) {
        return '<div class="builder-field"><label>' + label +
            '</label><textarea data-key="' + key + '" placeholder="' +
            escapeHtml(placeholder || '') + '">' +
            escapeHtml(value) + '</textarea></div>';
    }

    function renderEntries(type) {
        var list = $(type + 'List');
        if (!list) {
            debug('ERROR: ' + type + 'List not found.');
            return;
        }

        if (!state[type].length) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = state[type].map(function (item, index) {
            var body = '';

            if (type === 'education') {
                body = '<div class="builder-two">' +
                    input('SCHOOL', 'school', item.school, 'University / College') +
                    input('DEGREE / FIELD', 'degree', item.degree, 'BS Computer Engineering') +
                    '</div>' +
                    input('YEAR', 'year', item.year, '2026');
            } else if (type === 'experience') {
                body = '<div class="builder-two">' +
                    input('JOB TITLE', 'title', item.title, 'Frontend Developer') +
                    input('COMPANY', 'company', item.company, 'Company name') +
                    '</div>' +
                    input('DURATION', 'duration', item.duration, '2024 — Present') +
                    textarea('DESCRIPTION', 'description', item.description, 'What you worked on and accomplished.');
            } else if (type === 'projects') {
                body = input('PROJECT NAME', 'name', item.name, 'JobPath') +
                    textarea('DESCRIPTION', 'description', item.description, 'What you built and the technologies you used.');
            } else {
                body = '<div class="builder-two">' +
                    input('CERTIFICATION', 'name', item.name, 'Certification name') +
                    input('ISSUER', 'issuer', item.issuer, 'Issuing organization') +
                    '</div>' +
                    input('YEAR', 'year', item.year, '2026');
            }

            return '<div class="builder-entry" data-index="' + index + '">' +
                body +
                '<div class="builder-entry-actions">' +
                '<button type="button" class="builder-remove" data-remove="' +
                index + '">Remove</button></div></div>';
        }).join('');

        list.querySelectorAll('.builder-entry').forEach(function (entry) {
            var index = Number(entry.getAttribute('data-index'));

            entry.querySelectorAll('[data-key]').forEach(function (field) {
                field.addEventListener('input', function () {
                    state[type][index][field.getAttribute('data-key')] = field.value;
                    renderPreview();
                });
            });

            entry.querySelector('[data-remove]').addEventListener('click', function () {
                state[type].splice(index, 1);
                renderEntries(type);
                renderPreview();
                debug('Removed ' + type + ' entry.');
            });
        });
    }

    function addEntry(type) {
        var blank = {
            education: { school: '', degree: '', year: '' },
            experience: { title: '', company: '', duration: '', description: '' },
            projects: { name: '', description: '' },
            certifications: { name: '', issuer: '', year: '' }
        };

        if (!blank[type]) {
            debug('ERROR: Unknown section ' + type);
            return;
        }

        state[type].push(blank[type]);
        renderEntries(type);
        renderPreview();
        debug('Added ' + type + ' entry.');
    }

    function save() {
        var button = $('saveResume');
        var status = $('builderStatus');

        if (button) {
            button.disabled = true;
            button.textContent = 'Saving...';
        }

        fetch('/api/resume/builder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ resume: collect() })
        })
        .then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    throw new Error(data.error || 'Save failed.');
                }
                return data;
            });
        })
        .then(function () {
            if (status) status.textContent = 'Saved to your profile.';
            debug('Resume saved successfully.');
        })
        .catch(function (error) {
            if (status) status.textContent = error.message;
            debug('SAVE ERROR: ' + error.message);
        })
        .finally(function () {
            if (button) {
                button.disabled = false;
                button.textContent = 'Save Resume';
            }
        });
    }

    function load() {
        debug('Loading profile and resume draft...');

        Promise.all([
            fetch('/api/resume/builder', { credentials: 'include' }),
            fetch('/api/auth/profile', { credentials: 'include' })
        ])
        .then(function (responses) {
            return Promise.all([
                responses[0].json(),
                responses[1].json()
            ]);
        })
        .then(function (data) {
            var builder = data[0].resume;
            var profile = data[1].profile || {};

            var resume = builder || {
                fullName: profile.full_name || '',
                email: profile.email || '',
                phone: '',
                location: '',
                summary: '',
                education: []
            };

            ['fullName', 'email', 'phone', 'location', 'summary'].forEach(function (key) {
                var field = $(key);
                if (field) field.value = resume[key] || '';
            });

            state.education = Array.isArray(resume.education) ? resume.education : [];
            state.experience = Array.isArray(resume.experience) ? resume.experience : [];
            state.projects = Array.isArray(resume.projects) ? resume.projects : [];
            state.certifications = Array.isArray(resume.certifications) ? resume.certifications : [];

            ['education', 'experience', 'projects', 'certifications'].forEach(renderEntries);
            renderPreview();

            var status = $('builderStatus');
            if (status) status.textContent = 'Your profile information is connected.';
            debug('Profile/draft loaded. Builder is ready.');
        })
        .catch(function (error) {
            debug('LOAD ERROR: ' + error.message);
            renderPreview();
        });
    }

    function init() {
        debug('JavaScript loaded.');
        var form = $('builderForm');

        if (!form) {
            debug('FATAL: #builderForm not found.');
            return;
        }

        debug('Builder form found.');

        form.addEventListener('click', function (event) {
            var button = event.target.closest('[data-add]');
            if (!button) return;

            event.preventDefault();
            addEntry(button.getAttribute('data-add'));
        });

        ['fullName', 'email', 'phone', 'location', 'summary'].forEach(function (id) {
            var field = $(id);
            if (field) field.addEventListener('input', renderPreview);
        });

        if ($('saveResume')) $('saveResume').addEventListener('click', save);
        if ($('printResume')) $('printResume').addEventListener('click', function () {
            window.print();
        });

        renderPreview();
        load();
    }

    window.addEventListener('error', function (event) {
        debug('JS ERROR: ' + event.message);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();