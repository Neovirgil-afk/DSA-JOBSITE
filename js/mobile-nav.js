'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const navs = document.querySelectorAll('.main-nav, .resume-nav, .builder-nav');

    navs.forEach((nav) => {
        if (nav.dataset.mobileNavReady === 'true') return;
        nav.dataset.mobileNavReady = 'true';

        const headerInner = nav.closest('.header-inner');
        if (!headerInner) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mobile-nav-toggle';
        button.setAttribute('aria-label', 'Open navigation');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<span></span><span></span><span></span>';

        const panel = document.createElement('div');
        panel.className = 'mobile-nav-panel';
        panel.setAttribute('aria-hidden', 'true');

        const clone = nav.cloneNode(true);
        clone.removeAttribute('aria-label');
        clone.classList.add('mobile-nav-clone');
        panel.appendChild(clone);

        headerInner.appendChild(button);
        headerInner.appendChild(panel);

        const close = () => {
            document.body.classList.remove('mobile-nav-open');
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-label', 'Open navigation');
            panel.setAttribute('aria-hidden', 'true');
        };

        button.addEventListener('click', () => {
            const open = !document.body.classList.contains('mobile-nav-open');
            if (open) {
                document.body.classList.add('mobile-nav-open');
                button.setAttribute('aria-expanded', 'true');
                button.setAttribute('aria-label', 'Close navigation');
                panel.setAttribute('aria-hidden', 'false');
            } else {
                close();
            }
        });

        panel.addEventListener('click', (event) => {
            if (event.target.closest('a')) close();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
    });
});