(function () {
    'use strict';

    const $ = (selector) => document.querySelector(selector);
    const plannerList = $('#learningPlannerList');
    const plannerForm = $('#learningPlannerForm');
    const plannerMessage = $('#learningPlannerMessage');
    const discoverForm = $('#learningDiscoverForm');
    const discoverMessage = $('#learningDiscoverMessage');
    const discoverResults = $('#learningDiscoverResults');
    const statusLabels = {
        not_started: 'Not Started',
        in_progress: 'In Progress',
        completed: 'Completed'
    };

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[char]));
    }

    function safeUrl(value) {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    async function api(url, options) {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                ...(options && options.headers ? options.headers : {}),
                ...(options && options.body ? { 'Content-Type': 'application/json' } : {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            window.location.href = '/';
            throw new Error('Please sign in to use your Learning Planner.');
        }
        if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        return data;
    }

    function setMessage(element, message, isError) {
        if (!element) return;
        element.textContent = message || '';
        element.style.color = isError ? '#b42318' : '';
    }

    function renderPlanner(items) {
        if (!plannerList) return;

        const summary = $('#learningPlannerSummary');
        const total = items.length;
        const inProgress = items.filter((item) => item.status === 'in_progress').length;
        const completed = items.filter((item) => item.status === 'completed').length;
        const percent = total ? Math.round((completed / total) * 100) : 0;
        if (summary) {
            summary.innerHTML =
                '<div class="learning-planner-stat"><strong>' + total + '</strong><span>Total goals</span></div>' +
                '<div class="learning-planner-stat"><strong>' + inProgress + '</strong><span>In progress</span></div>' +
                '<div class="learning-planner-stat"><strong>' + completed + '</strong><span>Completed</span></div>' +
                '<div class="learning-planner-progress" role="progressbar" aria-label="Learning goals completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"><span style="width:' + percent + '%"></span></div>';
        }

        if (!items.length) {
            plannerList.innerHTML = '<p class="learning-tool-muted">Your planner is empty for now. Add a goal above or search for a skill and add it here.</p>';
            return;
        }

        plannerList.innerHTML = items.map((item) => {
            const status = statusLabels[item.status] ? item.status : 'not_started';
            return '<article class="learning-planner-item" data-planner-id="' + Number(item.id) + '">' +
                '<div class="learning-planner-item-top"><div><h3>' + escapeHTML(item.title) + '</h3>' +
                '<p class="learning-planner-meta">' + escapeHTML(item.category || 'Personal interest') +
                (item.notes ? ' · ' + escapeHTML(item.notes) : '') + '</p></div>' +
                '<span class="learning-status-pill ' + (status === 'completed' ? 'completed' : '') + '">' + escapeHTML(statusLabels[status]) + '</span></div>' +
                '<div class="learning-planner-controls"><label><span class="learning-tool-muted" style="display:none">Progress</span>' +
                '<select data-planner-status aria-label="Progress for ' + escapeHTML(item.title) + '">' +
                Object.keys(statusLabels).map((key) => '<option value="' + key + '"' + (status === key ? ' selected' : '') + '>' + statusLabels[key] + '</option>').join('') +
                '</select></label><button class="learning-mini-action" type="button" data-planner-delete>Remove</button>' +
                (item.status !== 'completed' ? '<button class="learning-mini-action" type="button" data-planner-complete>Mark complete</button>' : '') +
                '</div></article>';
        }).join('');
    }

    async function loadPlanner() {
        if (!plannerList) return;
        try {
            const data = await api('/api/learning/planner');
            renderPlanner(data.items || []);
        } catch (error) {
            plannerList.innerHTML = '<p class="learning-tool-muted">' + escapeHTML(error.message) + '</p>';
        }
    }

    if (plannerForm) {
        plannerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submit = plannerForm.querySelector('button[type="submit"]');
            const titleInput = $('#learningGoalTitle');
            const categoryInput = $('#learningGoalCategory');
            const notesInput = $('#learningGoalNotes');
            const title = titleInput.value.trim();
            if (!title) {
                setMessage(plannerMessage, 'Enter a skill or learning goal first.', true);
                titleInput.focus();
                return;
            }

            submit.disabled = true;
            setMessage(plannerMessage, 'Adding your goal…', false);
            try {
                await api('/api/learning/planner', {
                    method: 'POST',
                    body: JSON.stringify({ title, category: categoryInput.value, notes: notesInput.value.trim() })
                });
                plannerForm.reset();
                setMessage(plannerMessage, 'Added to your planner.', false);
                await loadPlanner();
            } catch (error) {
                setMessage(plannerMessage, error.message, true);
            } finally {
                submit.disabled = false;
            }
        });
    }

    if (plannerList) {
        plannerList.addEventListener('change', async (event) => {
            const select = event.target.closest('[data-planner-status]');
            if (!select) return;
            const card = select.closest('[data-planner-id]');
            if (!card) return;
            select.disabled = true;
            try {
                await api('/api/learning/planner/' + encodeURIComponent(card.dataset.plannerId), {
                    method: 'PATCH',
                    body: JSON.stringify({ status: select.value })
                });
                await loadPlanner();
                setMessage(plannerMessage, 'Progress updated.', false);
            } catch (error) {
                setMessage(plannerMessage, error.message, true);
                select.disabled = false;
            }
        });

        plannerList.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-planner-delete], [data-planner-complete]');
            if (!button) return;
            const card = button.closest('[data-planner-id]');
            if (!card) return;
            button.disabled = true;
            try {
                if (button.hasAttribute('data-planner-delete')) {
                    const title = card.querySelector('h3')?.textContent || 'this goal';
                    if (!window.confirm('Remove "' + title + '" from your learning planner?')) {
                        button.disabled = false;
                        return;
                    }
                    await api('/api/learning/planner/' + encodeURIComponent(card.dataset.plannerId), { method: 'DELETE' });
                    setMessage(plannerMessage, 'Goal removed.', false);
                } else {
                    await api('/api/learning/planner/' + encodeURIComponent(card.dataset.plannerId), {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'completed' })
                    });
                    setMessage(plannerMessage, 'Nice work—goal marked complete!', false);
                }
                await loadPlanner();
            } catch (error) {
                setMessage(plannerMessage, error.message, true);
                button.disabled = false;
            }
        });
    }

    function renderDiscoverResults(data) {
        if (!discoverResults) return;
        const suggestions = data.suggestions || [];
        if (!suggestions.length) {
            discoverResults.innerHTML = '<p class="learning-tool-muted">No suggestions found. Try a broader search, or add your topic directly to the planner.</p>';
            return;
        }

        discoverResults.innerHTML = suggestions.map((item) => {
            const lessonUrl = '/learning.html?skill=' + encodeURIComponent(item.skill);
            const resources = Array.isArray(item.resources) ? item.resources : [];
            const resourceLinks = resources.slice(0, 2).map((resource) => {
                const url = safeUrl(resource.url);
                return url ? '<a href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(resource.title || resource.provider || 'Learning resource') + ' ↗</a>' : '';
            }).filter(Boolean).join('');
            return '<article class="learning-discover-item"><div class="learning-discover-item-top"><div><h3>' + escapeHTML(item.skill) + '</h3>' +
                '<p>' + escapeHTML(item.reason || 'A topic you can explore.') + '</p></div>' +
                (item.alreadyHave ? '<span class="learning-status-pill completed">In your skills</span>' : item.hasLesson ? '<span class="learning-status-pill">Beginner lesson</span>' : '') + '</div>' +
                '<div class="learning-planner-controls"><button class="learning-mini-action" type="button" data-add-skill="' + escapeHTML(item.skill) + '">+ Add to planner</button>' +
                (item.hasLesson ? '<a class="learning-mini-action" href="' + lessonUrl + '" style="text-decoration:none">Open lesson</a>' : '') + '</div>' +
                (resourceLinks ? '<div class="learning-discover-links">' + resourceLinks + '</div>' : '') + '</article>';
        }).join('');
    }

    if (discoverForm) {
        discoverForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const input = $('#learningDiscoverQuery');
            const submit = discoverForm.querySelector('button[type="submit"]');
            const query = input.value.trim();
            if (query.length < 2) {
                setMessage(discoverMessage, 'Enter at least 2 characters to search.', true);
                return;
            }
            submit.disabled = true;
            setMessage(discoverMessage, 'Finding topics and resources…', false);
            discoverResults.innerHTML = '<p class="learning-tool-muted">Searching…</p>';
            try {
                const data = await api('/api/learning/discover?q=' + encodeURIComponent(query));
                renderDiscoverResults(data);
                setMessage(discoverMessage, data.targetJob ? 'Suggestions can complement your ' + data.targetJob + ' goal—or your own interests.' : 'Explore this topic for your career or personal interest.', false);
            } catch (error) {
                discoverResults.innerHTML = '<p class="learning-tool-muted">' + escapeHTML(error.message) + '</p>';
                setMessage(discoverMessage, '', true);
            } finally {
                submit.disabled = false;
            }
        });
    }

    if (discoverResults) {
        discoverResults.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-add-skill]');
            if (!button) return;
            button.disabled = true;
            try {
                await api('/api/learning/planner', {
                    method: 'POST',
                    body: JSON.stringify({ title: button.dataset.addSkill, category: 'Personal interest', notes: 'Added from Discover Skills.' })
                });
                setMessage(plannerMessage, 'Added "' + button.dataset.addSkill + '" to your planner.', false);
                await loadPlanner();
                button.textContent = 'Added ✓';
            } catch (error) {
                setMessage(discoverMessage, error.message, true);
                button.disabled = false;
            }
        });
    }

    loadPlanner();
}());
