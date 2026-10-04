    document.addEventListener('click', (event) => {
        const link = event.target.closest('[data-mobile-route]');
        if (!link || window.innerWidth > 899) return;

        const href = link.getAttribute('data-mobile-route');
        if (!href) return;

        const protectedRoute = ['/profile.html', '/learning.html', '/resume.html'].includes(href);

        if (protectedRoute) {
            event.preventDefault();
            event.stopImmediatePropagation();

            getCurrentUser().then((user) => {
                if (user) {
                    window.location.href = new URL(href, window.location.href).href;
                } else {
                    requireLogin(href);
                }
            });

            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.href = new URL(href, window.location.href).href;
    }, true);'use strict';

document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-mobile-route]');
    if (!link || window.innerWidth > 899) return;

    const href = link.getAttribute('data-mobile-route');
    if (!href) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = new URL(href, window.location.href).href;
}, true);

document.addEventListener('DOMContentLoaded', () => {
    const mobileForm = document.querySelector('#mobileSearchForm');
    const mobileInput = document.querySelector('#mobileSearchQuery');
    const desktopForm = document.querySelector('#searchForm');
    const desktopInput = document.querySelector('#searchQuery');
    const resultsSection = document.querySelector('#resultsSection');
    const resultsGrid = document.querySelector('#resultsGrid');
    const mobileUserAvatar = document.querySelector('#mobileUserAvatar');

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
        const parts = String(name || 'Account').trim().split(/\\s+/).filter(Boolean);
        return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'A';
    }

    async function syncMobileUser() {
        if (!mobileUserAvatar) return;
        const user = await getCurrentUser();
        mobileUserAvatar.textContent = user ? getInitials(user.full_name || user.fullName) : '👤';
        mobileUserAvatar.setAttribute('aria-label', user ? 'Open your profile' : 'Log in to open your profile');
    }

    function requireLogin(href) {
        sessionStorage.setItem('jobsite_redirect_after_login', href);
        const loginLink = document.querySelector('.login-link');
        if (loginLink) {
            loginLink.click();
            return;
        }
        if (window.JobSiteAuth && typeof window.JobSiteAuth.openLogin === 'function') {
            window.JobSiteAuth.openLogin();
            return;
        }
        window.location.href = href;
    }

    async function handleProtectedMobileRoute(event, link) {
        const href = link.getAttribute('data-mobile-route') || link.getAttribute('href');
        if (!href || !['/profile.html', '/learning.html', '/resume.html'].includes(href)) return false;
        const user = await getCurrentUser();
        if (user) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        requireLogin(href);
        return true;
    }

    const savedCount = document.querySelector('#mobileSavedCount');
    const recommendedCount = document.querySelector('#mobileRecommendedCount');
    const analyticsFilter = document.querySelector('#mobileAnalyticsFilter');

    function showJobs() {
        if (!desktopForm || !resultsSection) return;

        // Use the existing desktop job-search logic so mobile and desktop
        // always use the same backend/API and job cards.
        if (typeof desktopForm.requestSubmit === 'function') {
            desktopForm.requestSubmit();
        } else {
            desktopForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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
            // Keep the dashboard usable when the user is not signed in.
        }
    }

    if (resultsGrid && recommendedCount) {
        const syncRecommendedCount = () => {
            const count = resultsGrid.querySelectorAll('.result-card[data-job-id]').length;
            if (count > 0) {
                recommendedCount.textContent = String(count);
            }
        };

        new MutationObserver(syncRecommendedCount).observe(resultsGrid, {
            childList: true,
            subtree: true
        });

        syncRecommendedCount();
    }

    // Mobile Jobs links: show the real job results instead of trying to
    // scroll to a section that is hidden until a search is performed.
    document.querySelectorAll('.mobile-bottom-nav a, .mobile-quick-card').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');

            if (href === '#resultsSection') {
                event.preventDefault();
                showJobs();
            }
        });
    });

    // Make the mobile analytics filter button functional.
    if (analyticsFilter) {
        const filters = ['Monthly⌄', 'Weekly⌄', 'Yearly⌄'];
        let filterIndex = 0;

        analyticsFilter.addEventListener('click', () => {
            filterIndex = (filterIndex + 1) % filters.length;
            analyticsFilter.textContent = filters[filterIndex];
        });
    }

    // Keep the active state of the bottom navigation in sync with taps.
    document.querySelectorAll('.mobile-bottom-nav a').forEach((link) => {
        link.addEventListener('click', (event) => {
            document.querySelectorAll('.mobile-bottom-nav a').forEach((item) => {
                item.classList.remove('is-active');
            });
            link.classList.add('is-active');

            // Force real page navigation for mobile pages. This avoids
            // another mobile/desktop click handler interfering with links.
            const href = link.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('#')) {
                event.preventDefault();
                event.stopPropagation();
                window.location.assign(new URL(href, window.location.href).href);
            }
        });
    });

    // Make the mobile profile avatar and quick-access page links navigate
    // directly to their real HTML pages.
    document.querySelectorAll(
        '.mobile-app-avatar, .mobile-quick-card[href="/learning.html"], .mobile-quick-card[href="/profile.html"], .mobile-quick-card[href="/resume-builder.html"]'
    ).forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#')) return;

            event.preventDefault();
            event.stopPropagation();
            window.location.assign(new URL(href, window.location.href).href);
        });
    });

    // The dashboard stat cards are also useful shortcuts on mobile.
    const savedCard = document.querySelector('.mobile-stat-card--saved');
    const profileCard = document.querySelector('.mobile-stat-card--profile');

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

    if (profileCard) {
        profileCard.setAttribute('role', 'link');
        profileCard.setAttribute('tabindex', '0');
        const openProfile = () => {
            window.location.assign(new URL('/profile.html', window.location.href).href);
        };
        profileCard.addEventListener('click', openProfile);
        profileCard.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openProfile();
            }
        });
    }

    syncMobileUser();
    loadSavedCount();
});
