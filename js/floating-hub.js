'use strict';

(function () {
    initEmployeeSidebar();
    if (document.getElementById('jobpathFloatingHub')) return;

    function initEmployeeSidebar() {
        const initialNavs = Array.from(document.querySelectorAll('nav.jobsite-global-rail, .mobile-nav-clone.jobsite-global-rail'));
        if (!initialNavs.length) return;

        initialNavs.forEach((nav) => { nav.style.visibility = 'hidden'; });
        const allowed = new Set(['jobs', 'dashboard', 'applications', 'learn', 'profile', 'resume']);

        function normalizeNavigation(isCandidate) {
            const navs = Array.from(document.querySelectorAll('nav.jobsite-global-rail, .mobile-nav-clone.jobsite-global-rail'));
            navs.forEach((nav) => {
                if (!isCandidate) {
                    nav.classList.remove('jobsite-global-rail');
                    nav.style.visibility = '';
                    return;
                }
                nav.querySelectorAll('a[data-rail]').forEach((link) => {
                    if (!allowed.has(link.dataset.rail)) link.remove();
                });
                // Resources is a desktop dropdown, not one of the six employee destinations.
                nav.querySelectorAll('.nav-dropdown').forEach((dropdown) => dropdown.remove());
                const rawPath = window.location.pathname;
                const path = (rawPath.length > 1 && rawPath.endsWith('/')) ? rawPath.slice(0, -1) : rawPath;
                nav.querySelectorAll('a[data-rail]').forEach((link) => {
                    const rawTarget = new URL(link.href, window.location.origin).pathname;
                    const target = (rawTarget.length > 1 && rawTarget.endsWith('/')) ? rawTarget.slice(0, -1) : rawTarget;
                    const current = target === path || (link.dataset.rail === 'resume' && path === '/resume-builder.html');
                    link.classList.toggle('is-current', current);
                    if (current) link.setAttribute('aria-current', 'page');
                    else link.removeAttribute('aria-current');
                });
                nav.style.visibility = '';
            });
        }

        fetch('/api/auth/me', { credentials: 'include' })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => normalizeNavigation(Boolean(data && data.user && data.user.role === 'candidate')))
            .catch(() => normalizeNavigation(false));
    }
    const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const fmt = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(); };
    const safeHref = (value) => { const href = String(value || '').trim(); return href.startsWith('/') && !href.startsWith('//') && !/[\\r\\n]/.test(href) ? href : null; };
    const state = { role: null, userId: null, threads: [], notifications: [], activeApplicationId: null, panel: '', poll: null, busy: false };
    document.addEventListener('DOMContentLoaded', init);

    async function request(url, options = {}) {
        const response = await fetch(url, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(data.error || 'Request failed.');
        return data;
    }
    async function init() {
        try {
            // Resolve the signed-in role from the shared auth endpoint first.
            // /api/auth/profile is candidate-only, so probing it for employers
            // produced an expected but noisy 403 in the browser console.
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            if (!response.ok) return;
            const data = await response.json();
            const user = data.user;
            if (!user || !['candidate', 'employer'].includes(user.role)) return;
            state.role = user.role;
            state.userId = Number(user.id);
            if (!state.userId) return;
            mount();
            await refreshAll();
            state.poll = window.setInterval(refreshAll, 10000);
        } catch (_) { /* Signed-out and public pages intentionally do not show the hub. */ }
    }
    function mount() {
        const root = document.createElement('div');
        root.id = 'jobpathFloatingHub';
        root.innerHTML = `
          <div class="jfh-panels">
            <section class="jfh-panel" id="jfhMessagesPanel" aria-label="Messages" hidden>
              <header><div><strong>Messages</strong><small id="jfhMessageSub">Chat with employers and applicants</small></div><button type="button" data-jfh-close aria-label="Close messages">×</button></header>
              <div class="jfh-message-layout"><div id="jfhThreads" class="jfh-threads"><p class="jfh-empty">Loading conversations…</p></div>
                <div class="jfh-conversation"><div id="jfhChatMessages" class="jfh-chat-messages"><p class="jfh-empty">Choose a conversation to start chatting.</p></div>
                  <form id="jfhSendForm" class="jfh-send-form"><label class="jfh-sr-only" for="jfhMessageInput">Write a message</label><textarea id="jfhMessageInput" maxlength="2000" rows="2" placeholder="Write a message…" required></textarea><button type="submit" id="jfhSendButton">Send</button></form><p id="jfhMessageStatus" role="status" aria-live="polite"></p>
                </div>
              </div>
            </section>
            <section class="jfh-panel jfh-notification-panel" id="jfhNotificationsPanel" aria-label="Notifications" hidden>
              <header><div><strong>Notifications</strong><small id="jfhNotificationSub">Your latest updates</small></div><button type="button" data-jfh-close aria-label="Close notifications">×</button></header>
              <div id="jfhNotificationList" class="jfh-notification-list"><p class="jfh-empty">Loading notifications…</p></div>
            </section>
          </div>
          <div class="jfh-actions"><button type="button" class="jfh-fab" data-jfh-open="notifications" aria-label="Open notifications" title="Notifications">🔔<span class="jfh-count" id="jfhNotificationCount" hidden>0</span></button><button type="button" class="jfh-fab" data-jfh-open="messages" aria-label="Open messages" title="Messages">✉<span class="jfh-count" id="jfhMessageCount" hidden>0</span></button></div>`;
        document.body.appendChild(root);
        root.addEventListener('click', onClick);
        document.getElementById('jfhSendForm').addEventListener('submit', sendMessage);
    }
    async function refreshAll() {
        if (state.busy) return;
        state.busy = true;
        try {
            const [messages, notifications] = await Promise.all([request('/api/messages'), request('/api/notifications')]);
            state.threads = Array.isArray(messages.threads) ? messages.threads : [];
            state.notifications = Array.isArray(notifications.notifications) ? notifications.notifications : [];
            setCount('jfhMessageCount', state.threads.reduce((sum, thread) => sum + (Number(thread.unread_count) || 0), 0));
            setCount('jfhNotificationCount', Number(notifications.unreadCount) || 0);
            if (state.panel === 'messages') {
                renderThreads();
                if (state.activeApplicationId) await loadConversation(state.activeApplicationId, true);
            }
            if (state.panel === 'notifications') renderNotifications();
        } catch (error) {
            if (/log in|available to candidates and employers/i.test(error.message || '')) {
                document.getElementById('jobpathFloatingHub')?.remove();
                if (state.poll) window.clearInterval(state.poll);
            }
        } finally { state.busy = false; }
    }
    function setCount(id, count) {
        const badge = document.getElementById(id); if (!badge) return;
        badge.textContent = count > 99 ? '99+' : String(count); badge.hidden = !(count > 0);
    }
    function openPanel(name) {
        state.panel = state.panel === name ? '' : name;
        document.getElementById('jfhMessagesPanel').hidden = state.panel !== 'messages';
        document.getElementById('jfhNotificationsPanel').hidden = state.panel !== 'notifications';
        if (state.panel === 'messages') { renderThreads(); if (state.activeApplicationId) loadConversation(state.activeApplicationId); }
        if (state.panel === 'notifications') renderNotifications();
    }
    function renderThreads() {
        const list = document.getElementById('jfhThreads'); if (!list) return;
        if (!state.threads.length) { list.innerHTML = '<p class="jfh-empty">No conversations yet. Messages become available when you apply to a job or receive an application.</p>'; return; }
        list.innerHTML = state.threads.map((thread) => '<button type="button" class="jfh-thread' +
            (Number(thread.application_id) === Number(state.activeApplicationId) ? ' active' : '') + '" data-jfh-thread="' + Number(thread.application_id) +
            '"><strong>' + esc(thread.other_party || 'Conversation') + '</strong><span>' + esc(thread.job_title || 'Job application') + '</span><small>' +
            (Number(thread.unread_count) ? esc(thread.unread_count) + ' unread' : esc(thread.last_message || 'Open conversation')) + '</small></button>').join('');
    }
    async function loadConversation(applicationId, silent = false) {
        try {
            const data = await request('/api/messages/' + encodeURIComponent(applicationId));
            state.activeApplicationId = Number(applicationId);
            const chat = document.getElementById('jfhChatMessages'); if (!chat) return;
            chat.innerHTML = (Array.isArray(data.messages) && data.messages.length)
                ? data.messages.map((message) => '<article class="jfh-message' + (Number(message.sender_id) === state.userId ? ' mine' : '') +
                    '"><p>' + esc(message.body) + '</p><small>' + esc(message.sender_name || 'User') + (message.created_at ? ' · ' + esc(fmt(message.created_at)) : '') + '</small></article>').join('')
                : '<p class="jfh-empty">This conversation is ready. Send the first message.</p>';
            chat.scrollTop = chat.scrollHeight;
            const thread = state.threads.find((item) => Number(item.application_id) === Number(applicationId));
            const sub = document.getElementById('jfhMessageSub');
            if (sub && thread) sub.textContent = (thread.other_party || 'Conversation') + ' · ' + (thread.job_title || 'Job application');
            if (!silent) document.getElementById('jfhMessageInput')?.focus();
            const active = state.threads.find((item) => Number(item.application_id) === Number(applicationId));
            if (active) active.unread_count = 0;
            setCount('jfhMessageCount', state.threads.reduce((sum, item) => sum + (Number(item.unread_count) || 0), 0));
        } catch (error) {
            const chat = document.getElementById('jfhChatMessages');
            if (chat) chat.innerHTML = '<p class="jfh-empty">' + esc(error.message || 'Could not load this conversation.') + '</p>';
        }
    }
    async function sendMessage(event) {
        event.preventDefault();
        const input = document.getElementById('jfhMessageInput'), button = document.getElementById('jfhSendButton'), status = document.getElementById('jfhMessageStatus');
        const body = String(input?.value || '').trim();
        if (!state.activeApplicationId) { if (status) status.textContent = 'Choose a conversation first.'; return; }
        if (!body) return;
        button.disabled = true; if (status) status.textContent = 'Sending…';
        try {
            await request('/api/messages/' + encodeURIComponent(state.activeApplicationId), { method: 'POST', body: JSON.stringify({ body }) });
            input.value = ''; if (status) status.textContent = 'Sent';
            await refreshAll(); await loadConversation(state.activeApplicationId);
        } catch (error) { if (status) status.textContent = error.message || 'Could not send message.'; }
        finally { button.disabled = false; }
    }
    function renderNotifications() {
        const list = document.getElementById('jfhNotificationList'); if (!list) return;
        const unread = state.notifications.filter((item) => !item.read_at).length;
        const sub = document.getElementById('jfhNotificationSub'); if (sub) sub.textContent = unread + ' unread · latest updates';
        list.innerHTML = state.notifications.length ? state.notifications.map((item) => {
            const href = safeHref(item.link);
            return '<article class="jfh-notification' + (!item.read_at ? ' unread' : '') + '" data-jfh-notification="' + Number(item.id) + '"><strong>' +
                esc(item.title || 'Notification') + '</strong><p>' + esc(item.body || 'You have a new update.') + '</p><small>' + esc(fmt(item.created_at)) +
                '</small><div>' + (href ? '<a href="' + esc(href) + '">Open →</a>' : '') +
                (!item.read_at ? '<button type="button" data-jfh-read="' + Number(item.id) + '">Mark read</button>' : '') + '</div></article>';
        }).join('') : '<p class="jfh-empty">You’re all caught up.</p>';
    }
    async function onClick(event) {
        const opener = event.target.closest('[data-jfh-open]');
        if (opener) { openPanel(opener.dataset.jfhOpen); await refreshAll(); return; }
        if (event.target.closest('[data-jfh-close]')) {
            state.panel = ''; document.getElementById('jfhMessagesPanel').hidden = true; document.getElementById('jfhNotificationsPanel').hidden = true; return;
        }
        const thread = event.target.closest('[data-jfh-thread]');
        if (thread) { state.activeApplicationId = Number(thread.dataset.jfhThread); renderThreads(); await loadConversation(state.activeApplicationId); return; }
        const mark = event.target.closest('[data-jfh-read]');
        if (mark) {
            mark.disabled = true;
            try { await request('/api/notifications/' + encodeURIComponent(mark.dataset.jfhRead) + '/read', { method: 'PATCH' }); await refreshAll(); renderNotifications(); }
            catch (_) { mark.disabled = false; }
        }
    }
})();