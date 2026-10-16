'use strict';

(() => {
    const LOAD_DELAY = 2000;
    const loader = document.createElement('div');

    loader.className = 'jobsite-page-loader is-visible';
    loader.setAttribute('aria-hidden', 'false');
    loader.innerHTML = `
        <div class="jobsite-loader-skeleton" role="status" aria-label="Loading page">
            <div class="jobsite-loader-column">
                <span class="jobsite-skeleton-block jobsite-skeleton-brand"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-heading"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-heading short"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-copy"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-copy short"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-search"></span>
                <div class="jobsite-skeleton-chip-row">
                    <span class="jobsite-skeleton-block jobsite-skeleton-chip"></span>
                    <span class="jobsite-skeleton-block jobsite-skeleton-chip"></span>
                    <span class="jobsite-skeleton-block jobsite-skeleton-chip"></span>
                </div>
            </div>
            <div class="jobsite-loader-column">
                <span class="jobsite-skeleton-block jobsite-skeleton-art"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-card"></span>
                <span class="jobsite-skeleton-block jobsite-skeleton-card tall"></span>
            </div>
        </div>
    `;

    document.documentElement.appendChild(loader);

    const hide = () => {
        loader.classList.remove('is-visible');
        loader.setAttribute('aria-hidden', 'true');
        window.setTimeout(() => loader.remove(), 350);
    };

    window.setTimeout(hide, LOAD_DELAY);

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link) return;

        if (
            event.defaultPrevented ||
            link.target === '_blank' ||
            link.hasAttribute('download') ||
            link.hasAttribute('data-mobile-route') ||
            link.origin !== window.location.origin ||
            link.pathname === window.location.pathname && link.search === window.location.search
        ) {
            return;
        }

        const href = link.href;

        event.preventDefault();
        loader.classList.add('is-visible');
        loader.setAttribute('aria-hidden', 'false');

        window.setTimeout(() => {
            window.location.href = href;
        }, 360);
    });
})();
