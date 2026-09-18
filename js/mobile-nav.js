'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const navs = document.querySelectorAll('.main-nav, .resume-nav, .builder-nav');

    navs.forEach((nav) => {
        if (nav.dataset.mobileNavReady === 'true') return;
        nav.dataset.mobileNavReady = 'true';

        const headerInner = nav.closest('.header-inner');
        if (!headerInner) return;

        const button = headerInner.querySelector('.menu-toggle') || (() => {
            const created = document.createElement('button');
            created.type = 'button';
            created.className = 'mobile-nav-toggle';
            created.setAttribute('aria-label', 'Open navigation');
            created.setAttribute('aria-expanded', 'false');
            created.innerHTML = '<span></span><span></span><span></span>';
            headerInner.appendChild(created);
            return created;
        })();

        if (button.classList.contains('menu-toggle')) {
            button.setAttribute('aria-expanded', 'false');
        }

        const panel = document.createElement('div');
        panel.className = 'mobile-nav-panel';
        panel.setAttribute('aria-hidden', 'true');

        const clone = nav.cloneNode(true);
        clone.removeAttribute('aria-label');
        clone.classList.add('mobile-nav-clone');
        panel.appendChild(clone);
        headerInner.appendChild(panel);

        const close = () => {
            document.body.classList.remove('mobile-nav-open');
            document.body.classList.remove('nav-open');
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