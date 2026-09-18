(function () {
    'use strict';

    const state = { recommendations: [], catalog: [], activeSkill: '', activeLesson: 0, phase: 'lesson', quiz: null, quizAnswers: [], resources: [] };
    const $ = (selector) => document.querySelector(selector);

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
    }

    function renderCourseList() {
        const list = $('#courseList');
        const select = $('#courseSelect');
        if (!list || !select) return;
        const items = state.recommendations.length ? state.recommendations : state.catalog;
        list.innerHTML = items.map((item, index) => '<button type="button" class="learning-course-item ' + (item.skill === state.activeSkill ? 'active' : '') + '" data-skill="' + escapeHTML(item.skill) + '"><span class="learning-course-number">' + (index + 1) + '</span><span class="learning-course-copy"><strong>' + escapeHTML(item.skill) + '</strong><small>' + (item.hasLesson === false ? 'Resources only' : 'Beginner lesson') + '</small></span></button>').join('');
        select.innerHTML = items.map((item) => '<option value="' + escapeHTML(item.skill) + '">' + escapeHTML(item.skill) + '</option>').join('');
        if (state.activeSkill) select.value = state.activeSkill;
    }

    function renderLesson(lesson, resources) {
        const content = $('#learningContent');
        const total = lesson.lessons.length;
        const current = lesson.lessons[state.activeLesson];
        const percent = Math.round(((state.activeLesson + 1) / total) * 100);

        content.innerHTML = '<div class="learning-content-top"><div><span class="learning-eyebrow">BEGINNER LESSON</span><h2>' + escapeHTML(lesson.skill) + '</h2><p>' + escapeHTML(lesson.description) + '</p></div><span class="learning-badge">Beginner</span></div>' +
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

    function renderQuizResult(lesson) {
        const score = state.quiz.reduce((total, question, index) => total + (state.quizAnswers[index] === question.answer ? 1 : 0), 0);
        const passed = score >= Math.ceil(state.quiz.length * 0.67);

        $('#learningContent').innerHTML = '<div class="learning-content-top"><div><span class="learning-eyebrow">KNOWLEDGE CHECK COMPLETE</span><h2>' + escapeHTML(lesson.skill) + '</h2><p>' + (passed ? 'You passed the beginner knowledge check.' : 'Review the lesson and try the knowledge check again.') + '</p></div><span class="learning-score-badge">' + score + ' / ' + state.quiz.length + '</span></div>' +
            '<div class="learning-result ' + (passed ? 'passed' : 'review') + '"><strong>' + (passed ? 'Foundation verified' : 'Keep practicing') + '</strong><span>' + score + ' of ' + state.quiz.length + ' answers correct.</span></div>' +
            '<div class="learning-quiz-list">' + state.quiz.map((question, index) => {
                const correct = state.quizAnswers[index] === question.answer;
                return '<article class="learning-question learning-question-result ' + (correct ? 'correct' : 'incorrect') + '"><span class="learning-question-number">QUESTION ' + question.question + '</span><h3>' + escapeHTML(question.prompt) + '</h3><p class="learning-answer-result"><strong>' + (correct ? 'Correct' : 'Review') + ':</strong> ' + escapeHTML(question.options[question.answer]) + '</p><p>' + escapeHTML(question.explanation) + '</p></article>';
            }).join('') + '</div>' +
            '<div class="learning-actions"><button type="button" class="learning-action-button" id="retryQuiz">Retry Quiz</button><span class="learning-action-copy">' + (passed ? 'Assessment integration can verify this skill next.' : 'Use the lesson again before retrying.') + '</span><a href="/profile.html" class="learning-action-button primary">Back to Dashboard</a></div>';

        $('#retryQuiz')?.addEventListener('click', () => startQuiz(lesson));
    }

    async function loadLesson(skill) {
        state.activeSkill = skill;
        state.activeLesson = 0;
        renderCourseList();
        $('#learningContent').innerHTML = '<div class="learning-loading">Loading lesson...</div>';
        try {
            const response = await fetch('/api/learning/skill/' + encodeURIComponent(skill), { credentials: 'include' });
            const data = await response.json();
            if (response.status === 401) { window.location.href = '/'; return; }
            if (!response.ok) throw new Error(data.error || 'Unable to load this lesson.');
            renderLesson(data.lesson, data.resources || []);
        } catch (error) {
            $('#learningContent').innerHTML = '<div class="learning-empty">' + escapeHTML(error.message) + '</div>';
        }
    }

    async function loadRecommendations() {
        try {
            const response = await fetch('/api/learning/recommended', { credentials: 'include' });
            const data = await response.json();
            if (response.status === 401) { window.location.href = '/'; return; }
            if (!response.ok) throw new Error(data.error || 'Unable to load recommendations.');
            state.recommendations = data.recommendations || [];
            state.catalog = data.availableLessons || [];
            renderCourseList();
            if (state.recommendations.length) loadLesson(state.recommendations[0].skill);
            else $('#learningContent').innerHTML = '<div class="learning-empty">No beginner lessons are recommended yet. Upload a resume or add skills to your profile first.</div>';
        } catch (error) {
            $('#learningContent').innerHTML = '<div class="learning-empty">' + escapeHTML(error.message) + '</div>';
        }
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('.learning-course-item');
        if (button) loadLesson(button.dataset.skill);
    });
    $('#courseSelect')?.addEventListener('change', (event) => loadLesson(event.target.value));
    loadRecommendations();
}());
