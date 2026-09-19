(function () {
    'use strict';

    const state = { recommendations: [], catalog: [], careerPath: [], targetJob: '', progress: { completed: 0, total: 0, percent: 0 }, activeSkill: '', activeLesson: 0, phase: 'lesson', quiz: null, quizAnswers: [], resources: [] };
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
            '<div class="learning-skill-path">' +
                '<div class="learning-section-title"><span>CAREER SKILL PATH</span><small>' + (next ? 'Your next gap is highlighted.' : 'You completed every skill in this path.') + '</small></div>' +
                '<div class="learning-path-list">' +
                    steps.map((step, index) => '<button type="button" class="learning-path-step ' + (step.completed ? 'completed' : (next && step.skill === next.skill ? 'current' : '')) + '" data-skill="' + escapeHTML(step.skill) + '">' +
                        '<span class="learning-path-number">' + (step.completed ? '✓' : String(index + 1).padStart(2, '0')) + '</span>' +
                        '<span class="learning-path-copy"><strong>' + escapeHTML(step.skill) + '</strong><small>' + (step.completed ? 'Verified skill' : (next && step.skill === next.skill ? 'Recommended next' : 'Skill gap')) + '</small></span>' +
                        '<span class="learning-path-arrow">→</span>' +
                    '</button>').join('') +
                '</div>' +
            '</div>';
    }

    function renderCourseList() {
        const list = $('#courseList');
        const select = $('#courseSelect');
        if (!list || !select) return;
        const items = state.recommendations.length ? state.recommendations : state.catalog;
        list.innerHTML = items.map((item, index) => '<button type="button" class="learning-course-item ' + (item.skill === state.activeSkill ? 'active' : '') + '" data-skill="' + escapeHTML(item.skill) + '"><span class="learning-course-number">' + (index + 1) + '</span><span class="learning-course-copy"><strong>' + escapeHTML(item.skill) + '</strong><small>' + escapeHTML(item.reason || (item.hasLesson === false ? 'Resources only' : 'Beginner lesson')) + '</small></span></button>').join('');
        select.innerHTML = items.map((item) => '<option value="' + escapeHTML(item.skill) + '">' + escapeHTML(item.skill) + '</option>').join('');
        if (state.activeSkill) select.value = state.activeSkill;
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

    function renderLesson(lesson, resources) {
        const content = $('#learningContent');
        const total = lesson.lessons.length;
        const current = lesson.lessons[state.activeLesson];
        const percent = Math.round(((state.activeLesson + 1) / total) * 100);

        content.innerHTML = '<div class="learning-content-top"><div><span class="learning-eyebrow">BEGINNER LESSON</span><h2>' + escapeHTML(lesson.skill) + '</h2><p>' + escapeHTML(lesson.description) + '</p>' + (state.recommendations.find((item) => item.skill === lesson.skill)?.reason ? '<div class="learning-why"><strong>Why this is recommended:</strong> ' + escapeHTML(state.recommendations.find((item) => item.skill === lesson.skill).reason) + '</div>' : '') + '</div><span class="learning-badge">Beginner</span></div>' +
            '<div class="learning-progress"><div class="learning-progress-track"><span style="width:' + percent + '%"></span></div><span class="learning-progress-label">' + (state.activeLesson + 1) + ' / ' + total + '</span></div>' +
            '<div class="learning-lesson-list"><article class="learning-lesson"><span class="learning-lesson-kicker">LESSON ' + current.step + '</span><h3>' + escapeHTML(current.title) + '</h3><p>' + escapeHTML(current.content) + '</p></article></div>' +
            '<section class="learning-resources-panel"><h3>Continue learning</h3><p class="learning-resource-intro">Want more detail? Use these curated resources after the foundation lesson.</p><div class="learning-resource-grid">' +
            resources.map((resource) => '<a class="learning-resource-card" href="' + escapeHTML(resource.url) + '" target="_blank" rel="noopener noreferrer"><span class="resource-icon">' + (resource.provider === 'YouTube' ? '▶' : '↗') + '</span><span><strong>' + escapeHTML(resource.title) + '</strong><small>' + escapeHTML(resource.provider) + ' · ' + escapeHTML(resource.description) + '</small></span></a>').join('') +
            '</div></section>' +
            '<div class="learning-actions"><button type="button" class="learning-action-button" id="previousLesson" ' + (state.activeLesson === 0 ? 'disabled' : '') + '>← Previous</button><span class="learning-action-copy">' + (state.activeLesson === total - 1 ? 'Finished the foundation? Take the quick knowledge check.' : 'Read the concept, then continue.') + '</span><button type="button" class="learning-action-button primary" id="nextLesson">' + (state.activeLesson === total - 1 ? 'Take Quick Quiz →' : 'Next Lesson →') + '</button></div>';

        $('#previousLesson')?.addEventListener('click', () => {
            if (state.activeLesson > 0) {
                state.activeLesson--;
                renderLesson(lesson, resources);
            }
        });

        $('#nextLesson')?.addEventListener('click', () => {
            if (state.activeLesson < total - 1) {
                state.activeLesson++;
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
        state.activeLesson = 0;
        state.phase = 'lesson';
        renderCourseList();
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
            state.recommendations = data.recommendations || [];
            state.catalog = data.availableLessons || [];
            renderCareerOverview();
            renderCourseList();
            if (state.recommendations.length) loadLesson(state.recommendations[0].skill);
            else $('#learningContent').innerHTML = '<div class="learning-empty">No beginner lessons are recommended yet. Upload a resume or add skills to your profile first.</div>';
        } catch (error) {
            $('#learningContent').innerHTML = '<div class="learning-empty">' + escapeHTML(error.message) + '</div>';
        }
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('.learning-course-item, .learning-path-step');
        if (button) loadLesson(button.dataset.skill);
    });
    $('#courseSelect')?.addEventListener('change', (event) => loadLesson(event.target.value));
    loadRecommendations();
}());
