'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const mobileForm = document.querySelector('#mobileSearchForm');
    const mobileInput = document.querySelector('#mobileSearchQuery');
    const desktopForm = document.querySelector('#searchForm');
    const desktopInput = document.querySelector('#searchQuery');
    const resultsSection = document.querySelector('#resultsSection');
    const resultsGrid = document.querySelector('#resultsGrid');
    const mobileUserAvatar = document.querySelector('#mobileUserAvatar');
    const savedCount = document.querySelector('#mobileSavedCount');
    const recommendedCount = document.querySelector('#mobileRecommendedCount');
    const analyticsFilter = document.querySelector('#mobileAnalyticsFilter');

    const protectedRoutes = ['/profile.html', '/learning.html', '/resume.html'];

    async function getCurrentUser() {
        try {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            if (!response.ok) return null;
            const data = await response.json();
            return data.user || null;
        } catch (_) {
            return null;
        }
    }

    function getInitials(name) {
        const parts = String(name || 'Account').trim().split(/\s+/).filter(Boolean);
        return parts.slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'A';
    }

    function ensureMobileLoginModal() {
        let overlay = document.querySelector('#mobileLoginOverlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'mobileLoginOverlay';
        overlay.className = 'mobile-login-overlay';
        overlay.innerHTML = `
            <div class="mobile-login-modal" role="dialog" aria-modal="true" aria-labelledby="mobileLoginTitle">
                <button type="button" class="mobile-login-close" id="mobileLoginClose" aria-label="Close login">×</button>
                <div class="mobile-login-brand"><span>✦</span></div>
                <div class="mobile-login-heading">
                    <span>WELCOME BACK</span>
                    <h2 id="mobileLoginTitle">Log in to JobSite</h2>
                    <p>Sign in to access your profile, learning tools, and resume features.</p>
                </div>
                <form id="mobileLoginForm" class="mobile-login-form">
                    <label>
                        Email
                        <input id="mobileLoginEmail" type="email" autocomplete="email" placeholder="Enter your email" required>
                    </label>
                    <label>
                        Password
                        <input id="mobileLoginPassword" type="password" autocomplete="current-password" placeholder="Enter your password" required>
                    </label>
                    <p id="mobileLoginMessage" class="mobile-login-message" aria-live="polite"></p>
                    <button type="submit" id="mobileLoginSubmit">Log In</button>
                </form>
                <button type="button" class="mobile-login-signup" id="mobileLoginSignup">
                    New to JobSite? <strong>Create an account</strong>
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {
            overlay.classList.remove('is-open');
            document.body.style.overflow = '';
        };

        overlay.querySelector('#mobileLoginClose').addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });

        overlay.querySelector('#mobileLoginSignup').addEventListener('click', () => {
            close();
            if (window.JobSiteAuth && typeof window.JobSiteAuth.openLogin === 'function') {
                window.JobSiteAuth.openLogin();
            }
        });

        overlay.querySelector('#mobileLoginForm').addEventListener('submit', async (event) => {
            event.preventDefault();

            const email = overlay.querySelector('#mobileLoginEmail');
            const password = overlay.querySelector('#mobileLoginPassword');
            const message = overlay.querySelector('#mobileLoginMessage');
            const submit = overlay.querySelector('#mobileLoginSubmit');

            message.textContent = '';
            submit.disabled = true;
            submit.textContent = 'Logging in...';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: email.value.trim(),
                        password: password.value
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Invalid email or password.');
                }

                message.textContent = 'Login successful!';
                message.className = 'mobile-login-message is-success';

                const redirectTarget = sessionStorage.getItem('jobsite_redirect_after_login') || '/';
                sessionStorage.removeItem('jobsite_redirect_after_login');

                if (data.user && mobileUserAvatar) {
                    mobileUserAvatar.textContent = getInitials(data.user.full_name || data.user.fullName);
                    mobileUserAvatar.setAttribute('aria-label', 'Open your profile');
                }

                window.setTimeout(() => {
                    close();
                    window.location.assign(redirectTarget);
                }, 450);
            } catch (error) {
                message.textContent = error.message || 'Login failed. Please try again.';
                message.className = 'mobile-login-message is-error';
                submit.disabled = false;
                submit.textContent = 'Log In';
            }
        });

        return overlay;
    }

    function openMobileLogin(href) {
        sessionStorage.setItem('jobsite_redirect_after_login', href);
        const overlay = ensureMobileLoginModal();
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        window.setTimeout(() => overlay.querySelector('#mobileLoginEmail')?.focus(), 50);
    }

    async function handleProtectedRoute(link) {
        const href = link.getAttribute('data-mobile-route') || link.getAttribute('href');
        if (!protectedRoutes.includes(href)) return;

        const user = await getCurrentUser();

        if (user) {
            window.location.assign(href);
            return;
        }

        openMobileLogin(href);
    }

    // Mobile-only protected navigation. This runs in capture phase so the
    // desktop page-transition and desktop auth handlers cannot redirect first.
    document.addEventListener('click', (event) => {
        if (window.innerWidth > 899) return;

        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('data-mobile-route') || link.getAttribute('href');
        if (!href) return;

        if (protectedRoutes.includes(href)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            handleProtectedRoute(link);
        }
    }, true);

    function syncMobileUser(user) {
        if (!mobileUserAvatar) return;

        mobileUserAvatar.textContent = user
            ? getInitials(user.full_name || user.fullName)
            : '👤';

        mobileUserAvatar.setAttribute(
            'aria-label',
            user ? 'Open your profile' : 'Log in to open your profile'
        );
    }

    async function loadUserState() {
        syncMobileUser(await getCurrentUser());
    }

    function showJobs() {
        if (!desktopForm || !resultsSection) return;

        if (typeof desktopForm.requestSubmit === 'function') {
            desktopForm.requestSubmit();
        } else {
            desktopForm.dispatchEvent(new Event('submit', {
                bubbles: true,
                cancelable: true
            }));
        }

        window.setTimeout(() => {
            resultsSection.hidden = false;
            resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 120);
    }

    if (mobileForm && mobileInput && desktopForm && desktopInput) {
        mobileForm.addEventListener('submit', (event) => {
            event.preventDefault();
            desktopInput.value = mobileInput.value.trim();
            showJobs();
        });
    }

    async function loadSavedCount() {
        if (!savedCount) return;

        try {
            const response = await fetch('/api/jobs/saved', {
                credentials: 'include'
            });

            if (!response.ok) return;

            const data = await response.json();
            savedCount.textContent = String(
                Array.isArray(data.jobs) ? data.jobs.length : 0
            );
        } catch (_) {
            // User may simply be logged out.
        }
    }

    if (resultsGrid && recommendedCount) {
        const syncRecommendedCount = () => {
            const count = resultsGrid.querySelectorAll('.result-card[data-job-id]').length;
            if (count > 0) recommendedCount.textContent = String(count);
        };

        new MutationObserver(syncRecommendedCount).observe(resultsGrid, {
            childList: true,
            subtree: true
        });

        syncRecommendedCount();
    }

    document.querySelectorAll('.mobile-bottom-nav a, .mobile-quick-card').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');

            if (href === '#resultsSection') {
                event.preventDefault();
                showJobs();
            }
        });
    });

    if (analyticsFilter) {
        const filters = ['Monthly⌄', 'Weekly⌄', 'Yearly⌄'];
        let filterIndex = 0;

        analyticsFilter.addEventListener('click', () => {
            filterIndex = (filterIndex + 1) % filters.length;
            analyticsFilter.textContent = filters[filterIndex];
        });
    }

    document.querySelectorAll('.mobile-bottom-nav a').forEach((link) => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.mobile-bottom-nav a').forEach((item) => {
                item.classList.remove('is-active');
            });
            link.classList.add('is-active');
        });
    });

    const savedCard = document.querySelector('.mobile-stat-card--saved');
    if (savedCard) {
        savedCard.setAttribute('role', 'button');
        savedCard.setAttribute('tabindex', '0');
        const openSavedJobs = () => showJobs();
        savedCard.addEventListener('click', openSavedJobs);
        savedCard.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openSavedJobs();
            }
        });
    }

    const profileCard = document.querySelector('.mobile-stat-card--profile');
    if (profileCard) {
        profileCard.setAttribute('role', 'link');
        profileCard.setAttribute('tabindex', '0');
        profileCard.addEventListener('click', () => {
            const fakeLink = document.createElement('a');
            fakeLink.setAttribute('data-mobile-route', '/profile.html');
            handleProtectedRoute(fakeLink);
        });
    }

    loadUserState();
    loadSavedCount();
});
