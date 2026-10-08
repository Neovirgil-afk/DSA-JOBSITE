'use strict';

(() => {
    const LOAD_DELAY = 2000;
    const loader = document.createElement('div');

    loader.className = 'jobsite-page-loader is-visible';
    loader.setAttribute('aria-hidden', 'false');
    loader.innerHTML = `
        <div class="jobsite-page-loader__brand" aria-label="Loading JobSite">
            <span class="jobsite-page-loader__logo">JOB<span>SITE</span></span>
            <svg class="jobsite-page-loader__plane" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21.5 2.5L2 10.2c-.8.3-.8 1.4 0 1.7l7.6 2.9 2.9 7.6c.3.8 1.4 1.4 1.7 0L21.9 3.9c.3-.9-.6-1.7-1.4-1.4z" fill="currentColor"/>
            </svg>
        </div>
        <p class="jobsite-page-loader__text">Loading JobSite...</p>
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
