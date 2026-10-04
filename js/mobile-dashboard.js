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

    if (mobileForm && mobileInput && desktopForm && desktopInput) {
        mobileForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const query = mobileInput.value.trim();
            desktopInput.value = query;

            desktopForm.requestSubmit();

            window.setTimeout(() => {
                resultsSection?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 80);
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

    document.querySelectorAll('.mobile-bottom-nav a, .mobile-quick-card').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');

            if (href === '#resultsSection') {
                event.preventDefault();
                document.querySelector('#resultsSection')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    loadSavedCount();
});
