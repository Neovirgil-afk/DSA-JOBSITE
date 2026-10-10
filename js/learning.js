(function () {
    'use strict';

    const state = { recommendations: [], catalog: [], careerPath: [], targetJob: '', progress: { completed: 0, total: 0, percent: 0 }, learningProgress: [], activeSkill: '', activeLesson: 0, phase: 'lesson', quiz: null, quizAnswers: [], resources: [] };
    let courseQuery = '';

    const LAST_LEARNING_KEY = 'jobsite:last-learning';
    function getLastLearning() {
        try {
            const saved = JSON.parse(localStorage.getItem(LAST_LEARNING_KEY) || 'null');
            return saved && typeof saved.skill === 'string' ? saved : null;
        } catch (_) {
            return null;
        }
    }
    function saveLastLearning() {
        if (!state.activeSkill) return;
        try {
            localStorage.setItem(LAST_LEARNING_KEY, JSON.stringify({
                skill: state.activeSkill,
                lessonIndex: state.activeLesson,
                updatedAt: Date.now()
            }));
        } catch (_) {
            // Learning still works when browser storage is unavailable.
        }
    }
    function renderContinueLearning() {
        const panel = $('#learningContinue');
        if (!panel) return;
        const saved = getLastLearning();
        if (!saved) {
            panel.innerHTML = '<div><span class="learning-eyebrow">PICK UP ANYTIME</span><strong>Start a lesson to build your learning history.</strong><p>Your latest skill and lesson will be remembered on this device.</p></div>';
            return;
        }
        const lessonNumber = Math.max(1, Number(saved.lessonIndex || 0) + 1);
        panel.innerHTML = '<div class="learning-continue-copy"><span class="learning-eyebrow">CONTINUE LEARNING</span><strong>' + escapeHTML(saved.skill) + '</strong><p>Pick up from lesson ' + lessonNumber + '. Your progress is saved on this device.</p></div><button type="button" class="learning-action-button primary" id="resumeLearning">Resume lesson →</button>';
        $('#resumeLearning')?.addEventListener('click', () => loadLesson(saved.skill));
    }
    const $ = (selector) => document.querySelector(selector);

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
    }

    function renderCareerOverview() {
        const overview = $('#learningCareerOverview');
        if (!overview) return;

        if (!state.targetJob) {
            overview.innerHTML = '<div class="learning-career-empty"><strong>No target job selected yet.</strong><span>Choose a target job in your profile to build a personalized learning path.</span><a href="/profile.html" class="learning-mini-button">Set Target Job →</a></div>';
            return;
        }

        const completed = state.progress.completed;
        const total = state.progress.total;
        const percent = state.progress.percent;
        const steps = state.careerPath;
        const next = steps.find((step) => !step.completed);

        overview.innerHTML =
            '<div class="learning-career-header">' +
                '<div><span class="learning-eyebrow">YOUR TARGET CAREER</span><h2>' + escapeHTML(state.targetJob) + '</h2><p>Build the skills connected to your target job and close the gaps in your current profile.</p></div>' +
                '<div class="learning-career-progress"><strong>' + percent + '%</strong><span>' + completed + ' / ' + total + ' skills</span></div>' +
            '</div>' +
            '<div class="learning-career-track"><span style="width:' + percent + '%"></span></div>' +
            '<div class="learning-career-summary">' +
                '<div><span class="summary-value">' + completed + '</span><span class="summary-label">Skills verified</span></div>' +
                '<div><span class="summary-value">' + Math.max(total - completed, 0) + '</span><span class="summary-label">Skills to learn</span></div>' +
                '<div><span class="summary-value">' + (next ? escapeHTML(next.skill) : 'Complete') + '</span><span class="summary-label">' + (next ? 'Recommended next' : 'Learning path') + '</span></div>' +
            '</div>' +
            '<div class="learning-achievements">' +
                '<div class="learning-section-title"><span>YOUR MILESTONES</span><small>Keep building momentum</small></div>' +
                '<div class="learning-achievement-grid">' +
                    (completed >= 1 ? '<div class="learning-achievement unlocked"><span class="learning-achievement-icon">✦</span><span><strong>First Step</strong><small>First career skill verified</small></span></div>' : '<div class="learning-achievement locked"><span class="learning-achievement-icon">✧</span><span><strong>First Step</strong><small>Verify your first career skill</small></span></div>') +
                    (completed >= 3 ? '<div class="learning-achievement unlocked"><span class="learning-achievement-icon">◆</span><span><strong>Skill Builder</strong><small>Three skills verified</small></span></div>' : '<div class="learning-achievement locked"><span class="learning-achievement-icon">◇</span><span><strong>Skill Builder</strong><small>Verify 3 career skills</small></span></div>') +
                    (percent >= 100 && total > 0 ? '<div class="learning-achievement unlocked"><span class="learning-achievement-icon">★</span><span><strong>Path Complete</strong><small>All target skills verified</small></span></div>' : '<div class="learning-achievement locked"><span class="learning-achievement-icon">☆</span><span><strong>Path Complete</strong><small>Complete your target skill path</small></span></div>') +
                '</div>' +
            '</div>' +
            '<div class="learning-skill-path">' +
                '<div class="learning-section-title"><span>CAREER SKILL PATH</span><small>' + (next ? 'Your next gap is highlighted.' : 'You completed every skill in this path.') + '</small></div>' +
                '<div class="learning-path-list">' +
                    '<span class="learning-path-active-indicator" aria-hidden="true"></span>' +
                    steps.map((step, index) => '<button type="button" class="learning-path-step ' + (step.completed ? 'completed' : (next && step.skill === next.skill ? 'current' : '')) + '" data-skill="' + escapeHTML(step.skill) + '">' +
                        '<span class="learning-path-number">' + (step.completed ? '✓' : String(index + 1).padStart(2, '0')) + '</span>' +
                        '<span class="learning-path-copy"><strong>' + escapeHTML(step.skill) + '</strong><small>' + (step.completed ? 'Verified skill' : (next && step.skill === next.skill ? 'Recommended next' : 'Skill gap')) + '</small></span>' +
                        '<span class="learning-path-arrow">→</span>' +
                    '</button>').join('') +
                '</div>' +
            '</div>';
    }

    function positionPathHighlight(animate = true) {
        const list = document.querySelector('.learning-path-list');
        if (!list || !state.activeSkill) return;

        const active = list.querySelector('.learning-path-step[data-skill="' + CSS.escape(state.activeSkill) + '"]');
        const indicator = list.querySelector('.learning-path-active-indicator');
        if (!active || !indicator) return;

        const listRect = list.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const x = activeRect.left - listRect.left;
        const y = activeRect.top - listRect.top;

        if (!animate) {
            indicator.style.transition = 'none';
            indicator.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
            indicator.style.width = activeRect.width + 'px';
            indicator.style.height = activeRect.height + 'px';
            requestAnimationFrame(() => {
                indicator.style.transition = '';
            });
            return;
        }

        indicator.style.width = activeRect.width + 'px';
        indicator.style.height = activeRect.height + 'px';
        requestAnimationFrame(() => {
            indicator.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        });
    }

    function positionCourseHighlight(animate = true) {
        const list = $('#courseList');
        if (!list || !state.activeSkill) return;

        const active = Array.from(list.querySelectorAll('.learning-course-item')).find((button) => button.dataset.skill === state.activeSkill);
        const indicator = list.querySelector('.learning-course-active-indicator');
        if (!active || !indicator) return;

        const listRect = list.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const x = activeRect.left - listRect.left;
        const y = activeRect.top - listRect.top;

        if (!animate) {
            indicator.style.transition = 'none';
            indicator.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
            indicator.style.width = activeRect.width + 'px';
            indicator.style.height = activeRect.height + 'px';
            requestAnimationFrame(() => {
                indicator.style.transition = '';
            });
            return;
        }

        indicator.style.width = activeRect.width + 'px';
        indicator.style.height = activeRect.height + 'px';
        requestAnimationFrame(() => {
            indicator.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        });
    }

    function setActivePathSkill(skill) {
        if (!skill) return;
        state.activeSkill = skill;

        const list = document.querySelector('.learning-path-list');
        if (!list) return;

        const nextSkill = state.careerPath.find((step) => !step.completed)?.skill || '';

        list.querySelectorAll('.learning-path-step').forEach((button) => {
            const isSelected = button.dataset.skill === skill;
            button.classList.toggle('active', isSelected);
            button.classList.toggle('current', isSelected && button.dataset.skill === nextSkill);
        });

        positionPathHighlight(true);
        positionCourseHighlight(true);
    }

    function renderCourseList() {
        const list = $('#courseList');
        const select = $('#courseSelect');
        if (!list || !select) return;
        const items = state.recommendations.length ? state.recommendations : state.catalog;
        const query = courseQuery.trim().toLowerCase();
        const filteredItems = query ? items.filter((item) => String(item.skill || '').toLowerCase().includes(query)) : items;
        list.innerHTML = '<span class="learning-course-active-indicator" aria-hidden="true"></span>' + (filteredItems.length ? filteredItems.map((item) => {
            const index = items.indexOf(item);
            const progress = state.learningProgress.find((entry) => entry.skill?.toLowerCase() === item.skill?.toLowerCase());
            const statusLabel = progress?.status === 'verified' ? '✓ Verified' : progress?.status === 'needs_review' ? 'Review quiz' : (item.reason || (item.hasLesson === false ? 'Resources only' : 'Beginner lesson'));
            const statusClass = progress?.status === 'verified' ? 'verified' : progress?.status === 'needs_review' ? 'review' : '';
            return '<button type="button" class="learning-course-item ' + statusClass + ' ' + (item.skill === state.activeSkill ? 'active' : '') + '" data-skill="' + escapeHTML(item.skill) + '"><span class="learning-course-number">' + (index + 1) + '</span><span class="learning-course-copy"><strong>' + escapeHTML(item.skill) + '</strong><small>' + escapeHTML(statusLabel) + '</small></span></button>';
        }).join('') : '<p class="learning-course-search-empty">No skills match “' + escapeHTML(courseQuery) + '”.</p>');
        select.innerHTML = items.map((item) => '<option value="' + escapeHTML(item.skill) + '">' + escapeHTML(item.skill) + '</option>').join('');
        if (state.activeSkill) select.value = state.activeSkill;
        const indicator = list.querySelector('.learning-course-active-indicator');
        if (indicator) indicator.style.opacity = filteredItems.some((item) => item.skill === state.activeSkill) ? '1' : '0';
        positionCourseHighlight(false);
    }

    const LESSON_LOADING_DELAY = 750;
    let lessonRequestId = 0;

    function showLessonSkeleton(skill) {
        const content = $('#learningContent');
        if (!content) return;

        const safeSkill = escapeHTML(skill || 'Loading lesson');

        content.innerHTML =
            '<div class="learning-skeleton-shell" aria-busy="true" aria-label="Loading lesson">' +
                '<div class="learning-skeleton-header">' +
                    '<div class="learning-skeleton-heading">' +
                        '<span class="learning-skeleton-line learning-skeleton-eyebrow"></span>' +
                        '<span class="learning-skeleton-line learning-skeleton-title"></span>' +
                        '<span class="learning-skeleton-line learning-skeleton-description"></span>' +
                        '<span class="learning-skeleton-line learning-skeleton-description learning-skeleton-description--short"></span>' +
                    '</div>' +
                    '<span class="learning-skeleton-badge"></span>' +
                '</div>' +
                '<div class="learning-skeleton-progress">' +
                    '<span class="learning-skeleton-progress-bar"></span>' +
                    '<span class="learning-skeleton-progress-label"></span>' +
                '</div>' +
                '<div class="learning-skeleton-lesson">' +
                    '<span class="learning-skeleton-line learning-skeleton-kicker"></span>' +
                    '<span class="learning-skeleton-line learning-skeleton-lesson-title"></span>' +
                    '<span class="learning-skeleton-line learning-skeleton-text"></span>' +
                    '<span class="learning-skeleton-line learning-skeleton-text"></span>' +
                    '<span class="learning-skeleton-line learning-skeleton-text learning-skeleton-text--short"></span>' +
                '</div>' +
                '<div class="learning-skeleton-resources">' +
                    '<span class="learning-skeleton-line learning-skeleton-resource-heading"></span>' +
                    '<div class="learning-skeleton-resource-grid">' +
                        '<span class="learning-skeleton-resource-card"></span>' +
                        '<span class="learning-skeleton-resource-card"></span>' +
                    '</div>' +
                '</div>' +
                '<div class="learning-skeleton-status">Loading <strong>' + safeSkill + '</strong>…</div>' +
            '</div>';
    }

    function getLessonNotes(skill) {
        try {
            return localStorage.getItem('jobsite:lesson-notes:' + String(skill || '').toLowerCase()) || '';
        } catch (_) {
            return '';
        }
    }

    function saveLessonNotes(skill, notes) {
        try {
            localStorage.setItem('jobsite:lesson-notes:' + String(skill || '').toLowerCase(), notes);
            return true;
        } catch (_) {
            return false;
        }
    }

    function renderLesson(lesson, resources) {
        const content = $('#learningContent');
        const total = lesson.lessons.length;
        const current = lesson.lessons[state.activeLesson];
        saveLastLearning();
        renderContinueLearning();
        const percent = Math.round(((state.activeLesson + 1) / total) * 100);

        content.innerHTML = '<div class="learning-content-top"><div><span class="learning-eyebrow">BEGINNER LESSON</span><h2>' + escapeHTML(lesson.skill) + '</h2><p>' + escapeHTML(lesson.description) + '</p>' + (state.recommendations.find((item) => item.skill === lesson.skill)?.reason ? '<div class="learning-why"><strong>Why this is recommended:</strong> ' + escapeHTML(state.recommendations.find((item) => item.skill === lesson.skill).reason) + '</div>' : '') + '</div><span class="learning-badge">Beginner</span></div>' +
            '<div class="learning-progress"><div class="learning-progress-track"><span style="width:' + percent + '%"></span></div><span class="learning-progress-label">' + (state.activeLesson + 1) + ' / ' + total + '</span></div>' +
            '<div class="learning-lesson-list"><article class="learning-lesson"><span class="learning-lesson-kicker">LESSON ' + current.step + '</span><h3>' + escapeHTML(current.title) + '</h3><p>' + escapeHTML(current.content) + '</p></article></div>' +
            '<section class="learning-notes-panel"><div><span class="learning-eyebrow">YOUR STUDY NOTES</span><h3>Remember this for later</h3><p>Write down key ideas, questions, or examples for this skill. Notes are saved on this device.</p></div><textarea id="learningLessonNotes" rows="4" placeholder="Example: A variable stores a value that I can reuse…">' + escapeHTML(getLessonNotes(lesson.skill)) + '</textarea><div class="learning-notes-actions"><button type="button" class="learning-action-button primary" id="saveLearningNotes">Save notes</button><button type="button" class="learning-action-button" id="exportLearningNotes">Export .txt</button><span id="learningNotesStatus" role="status">Notes are stored on this device.</span></div></section>' +
            '<section class="learning-resources-panel"><h3>Continue learning</h3><p class="learning-resource-intro">Want more detail? Use these curated resources after the foundation lesson.</p><div class="learning-resource-grid">' +
            resources.map((resource) => '<a class="learning-resource-card" href="' + escapeHTML(resource.url) + '" target="_blank" rel="noopener noreferrer"><span class="resource-icon">' + (resource.provider === 'YouTube' ? '▶' : '↗') + '</span><span><strong>' + escapeHTML(resource.title) + '</strong><small>' + escapeHTML(resource.provider) + ' · ' + escapeHTML(resource.description) + '</small></span></a>').join('') +
            '</div></section>' +
            '<div class="learning-actions"><button type="button" class="learning-action-button" id="previousLesson" ' + (state.activeLesson === 0 ? 'disabled' : '') + '>← Previous</button><span class="learning-action-copy">' + (state.activeLesson === total - 1 ? 'Finished the foundation? Take the quick knowledge check.' : 'Read the concept, then continue.') + '</span><button type="button" class="learning-action-button primary" id="nextLesson">' + (state.activeLesson === total - 1 ? 'Take Quick Quiz →' : 'Next Lesson →') + '</button></div>';

        const notesInput = $('#learningLessonNotes');
        const notesStatus = $('#learningNotesStatus');
        let notesSaveTimer = null;
        notesInput?.addEventListener('input', () => {
            if (notesStatus) notesStatus.textContent = 'Unsaved changes…';
            if (notesSaveTimer) window.clearTimeout(notesSaveTimer);
            notesSaveTimer = window.setTimeout(() => {
                const saved = saveLessonNotes(lesson.skill, notesInput?.value || '');
                if (notesStatus) {
                    notesStatus.textContent = saved
                        ? 'Saved automatically ✓'
                        : 'Could not save. Check your browser storage settings.';
                }
            }, 650);
        });
        $('#saveLearningNotes')?.addEventListener('click', () => {
            if (notesSaveTimer) window.clearTimeout(notesSaveTimer);
            const saved = saveLessonNotes(lesson.skill, notesInput?.value || '');
            if (notesStatus) notesStatus.textContent = saved ? 'Notes saved ✓' : 'Could not save. Check your browser storage settings.';
        });

        $('#exportLearningNotes')?.addEventListener('click', () => {
            const notes = notesInput?.value || '';
            if (!notes.trim()) {
                if (notesStatus) notesStatus.textContent = 'Write some notes before exporting.';
                notesInput?.focus();
                return;
            }
            const exportText = lesson.skill + ' — Study Notes\n' +
                'Exported: ' + new Date().toLocaleString() + '\n\n' + notes + '\n';
            const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const filename = lesson.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'study';
            link.href = url;
            link.download = filename + '-study-notes.txt';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            if (notesStatus) notesStatus.textContent = 'Notes exported ✓';
        });

        $('#previousLesson')?.addEventListener('click', () => {
            if (state.activeLesson > 0) {
                state.activeLesson--;
                saveLastLearning();
                renderLesson(lesson, resources);
            }
        });

        $('#nextLesson')?.addEventListener('click', () => {
            if (state.activeLesson < total - 1) {
                state.activeLesson++;
                saveLastLearning();
                renderLesson(lesson, resources);
            } else {
                startQuiz(lesson);
            }
        });
    }

    function startQuiz(lesson) {
        state.phase = 'quiz';
        state.quiz = Array.isArray(lesson.quiz) ? lesson.quiz : [];
        state.quizAnswers = new Array(state.quiz.length).fill(null);
        renderQuiz(lesson);
    }

    function renderQuiz(lesson) {
        const content = $('#learningContent');

        if (!state.quiz.length) {
            content.innerHTML = '<div class="learning-empty">There is no quiz for this lesson yet.</div>';
            return;
        }

        const answered = state.quizAnswers.filter((answer) => answer !== null).length;
        const percent = Math.round((answered / state.quiz.length) * 100);

        content.innerHTML = '<div class="learning-content-top"><div><span class="learning-eyebrow">KNOWLEDGE CHECK</span><h2>' + escapeHTML(lesson.skill) + '</h2><p>Quick beginner check. Answer each question, then review your result and explanations.</p></div><span class="learning-badge">3 questions</span></div>' +
            '<div class="learning-progress"><div class="learning-progress-track"><span style="width:' + percent + '%"></span></div><span class="learning-progress-label">' + answered + ' / ' + state.quiz.length + '</span></div>' +
            '<div class="learning-quiz-list">' + state.quiz.map((question, index) => {
                const selected = state.quizAnswers[index];
                return '<article class="learning-question"><span class="learning-question-number">QUESTION ' + question.question + '</span><h3>' + escapeHTML(question.prompt) + '</h3><div class="learning-options">' +
                    question.options.map((option, optionIndex) => '<button type="button" class="learning-option ' + (selected === optionIndex ? 'selected' : '') + '" data-question="' + index + '" data-option="' + optionIndex + '">' + String.fromCharCode(65 + optionIndex) + '. ' + escapeHTML(option) + '</button>').join('') +
                    '</div></article>';
            }).join('') + '</div>' +
            '<div class="learning-actions"><button type="button" class="learning-action-button" id="backToLesson">← Back to Lesson</button><span class="learning-action-copy">This is a foundation check, not an expert certification.</span><button type="button" class="learning-action-button primary" id="submitQuiz" ' + (answered !== state.quiz.length ? 'disabled' : '') + '>Check Answers</button></div>';

        content.querySelectorAll('.learning-option').forEach((button) => {
            button.addEventListener('click', () => {
                state.quizAnswers[Number(button.dataset.question)] = Number(button.dataset.option);
                renderQuiz(lesson);
            });
        });

        $('#backToLesson')?.addEventListener('click', () => {
            state.phase = 'lesson';
            state.activeLesson = 0;
            renderLesson(lesson, state.resources);
        });

        $('#submitQuiz')?.addEventListener('click', () => renderQuizResult(lesson));
    }

    async function renderQuizResult(lesson) {
        const content = $('#learningContent');
        content.innerHTML = '<div class="learning-loading">Checking your answers...</div>';

        try {
            const response = await fetch('/api/learning/assessment/complete', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skill: lesson.skill, answers: state.quizAnswers })
            });

            const data = await response.json();
            if (response.status === 401) {
                window.location.href = '/';
                return;
            }
            if (!response.ok) throw new Error(data.error || 'Unable to check this assessment.');

            const explanations = Array.isArray(data.explanations) ? data.explanations : [];
            const passed = Boolean(data.passed);

            content.innerHTML = '<div class="learning-content-top"><div><span class="learning-eyebrow">KNOWLEDGE CHECK COMPLETE</span><h2>' + escapeHTML(lesson.skill) + '</h2><p>' + escapeHTML(data.message || (passed ? 'You passed the beginner knowledge check.' : 'Review the lesson and try again.')) + '</p></div><span class="learning-score-badge">' + data.score + ' / ' + data.total + '</span></div>' +
                '<div class="learning-result ' + (passed ? 'passed' : 'review') + '"><strong>' + (passed ? '✓ Foundation verified' : 'Keep practicing') + '</strong><span>' + data.score + ' of ' + data.total + ' answers correct.</span></div>' +
                '<div class="learning-quiz-list">' + explanations.map((item) => {
                    const question = lesson.quiz[item.question - 1];
                    return '<article class="learning-question learning-question-result ' + (item.correct ? 'correct' : 'incorrect') + '"><span class="learning-question-number">QUESTION ' + item.question + '</span><h3>' + escapeHTML(question.prompt) + '</h3><p class="learning-answer-result"><strong>' + (item.correct ? 'Correct' : 'Review') + ':</strong> ' + escapeHTML(item.correctAnswer) + '</p><p>' + escapeHTML(item.explanation) + '</p></article>';
                }).join('') + '</div>' +
                '<div class="learning-actions"><button type="button" class="learning-action-button" id="retryQuiz">Retry Quiz</button><span class="learning-action-copy">' + (passed ? 'Your skill profile has been updated and job matches recalculated.' : 'Use the lesson again before retrying.') + '</span><a href="/profile.html" class="learning-action-button primary">Back to Dashboard</a></div>';

            $('#retryQuiz')?.addEventListener('click', () => startQuiz(lesson));
        } catch (error) {
            content.innerHTML = '<div class="learning-empty">' + escapeHTML(error.message) + '</div>';
        }
    }

    async function loadLesson(skill) {
        const requestId = ++lessonRequestId;
        state.activeSkill = skill;
        const saved = getLastLearning();
        state.activeLesson = saved && saved.skill.toLowerCase() === skill.toLowerCase() ? Math.max(0, Number(saved.lessonIndex) || 0) : 0;
        state.phase = 'lesson';
        setActivePathSkill(skill);
        showLessonSkeleton(skill);

        const startedAt = performance.now();

        try {
            const response = await fetch('/api/learning/skill/' + encodeURIComponent(skill), { credentials: 'include' });
            const data = await response.json();

            const elapsed = performance.now() - startedAt;
            const remainingDelay = Math.max(0, LESSON_LOADING_DELAY - elapsed);

            if (remainingDelay > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingDelay));
            }

            if (requestId !== lessonRequestId) return;

            if (response.status === 401) { window.location.href = '/'; return; }
            if (!response.ok) throw new Error(data.error || 'Unable to load this lesson.');

            state.activeLesson = Math.min(state.activeLesson, Math.max((data.lesson?.lessons?.length || 1) - 1, 0));
            saveLastLearning();
            renderLesson(data.lesson, data.resources || []);
        } catch (error) {
            if (requestId !== lessonRequestId) return;
            $('#learningContent').innerHTML = '<div class="learning-empty">' + escapeHTML(error.message) + '</div>';
        }
    }

    async function loadRecommendations() {
        try {
            const response = await fetch('/api/learning/recommended', { credentials: 'include' });
            const data = await response.json();
            if (response.status === 401) { window.location.href = '/'; return; }
            if (!response.ok) throw new Error(data.error || 'Unable to load recommendations.');
            state.targetJob = data.targetJob || '';
            state.careerPath = data.careerPath || [];
            state.progress = data.progress || { completed: 0, total: 0, percent: 0 };
            state.learningProgress = data.learningProgress || [];
            state.recommendations = data.recommendations || [];
            state.catalog = data.availableLessons || [];

            const requestedSkill = new URLSearchParams(window.location.search).get('skill')?.trim() || '';
            const savedLearning = getLastLearning();
            const requestedLower = requestedSkill.toLowerCase();
            const requestedItem = [...state.recommendations, ...state.catalog].find(
                (item) => item.skill?.toLowerCase() === requestedLower
            );

            renderCareerOverview();
            renderCourseList();

            renderContinueLearning();
            if (requestedSkill && requestedItem) {
                loadLesson(requestedItem.skill);
            } else if (savedLearning && [...state.recommendations, ...state.catalog].some((item) => item.skill?.toLowerCase() === savedLearning.skill.toLowerCase())) {
                loadLesson(savedLearning.skill);
            } else if (state.recommendations.length) {
                loadLesson(state.recommendations[0].skill);
            } else if (requestedSkill) {
                loadLesson(requestedSkill);
            } else {
                $('#learningContent').innerHTML = '<div class="learning-empty">No beginner lessons are recommended yet. Upload a resume or add skills to your profile first.</div>';
            }
        } catch (error) {
            $('#learningContent').innerHTML = '<div class="learning-empty">' + escapeHTML(error.message) + '</div>';
        }
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('.learning-course-item, .learning-path-step');
        if (button) loadLesson(button.dataset.skill);
    });
    $('#courseSelect')?.addEventListener('change', (event) => loadLesson(event.target.value));

    $('#learningCourseSearch')?.addEventListener('input', (event) => {
        courseQuery = event.target.value || '';
        renderCourseList();
    });

    window.addEventListener('resize', () => {
        positionPathHighlight(false);
        positionCourseHighlight(false);
    });

    loadRecommendations();
}());
