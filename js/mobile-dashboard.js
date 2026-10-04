'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const mobileForm = document.querySelector('#mobileSearchForm');
    const mobileInput = document.querySelector('#mobileSearchQuery');
    const desktopForm = document.querySelector('#searchForm');
    const desktopInput = document.querySelector('#searchQuery');
    const resultsSection = document.querySelector('#resultsSection');
    const resultsGrid = document.querySelector('#resultsGrid');
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
        link.addEventListener('click', () => {
            document.querySelectorAll('.mobile-bottom-nav a').forEach((item) => {
                item.classList.remove('is-active');
            });
            link.classList.add('is-active');
        });
    });

    loadSavedCount();
});
