'use strict';


export function initUI() {

    const menuToggle =
        document.querySelector('#menuToggle');


    if (menuToggle) {

        menuToggle.addEventListener(
            'click',
            () => {

                document.body.classList.toggle(
                    'nav-open'
                );

            }
        );
    }


    /* =====================================================
       HOMEPAGE HEADER CLEANUP
       ===================================================== */

    const header =
        document.querySelector('.site-header');

    if (header) {

        /* Remove stray markdown fences accidentally left in the HTML. */
        const walker =
            document.createTreeWalker(
                header,
                NodeFilter.SHOW_TEXT
            );

        const strayNodes = [];
        let node;

        while ((node = walker.nextNode())) {
            if (node.nodeValue.trim() === '```') {
                strayNodes.push(node);
            }
        }

        strayNodes.forEach((strayNode) => {
            strayNode.remove();
        });


        /* Keep the original header style while making room for Resume Analyzer. */
        if (!document.querySelector('#jobsite-header-cleanup')) {
            const style =
                document.createElement('style');

            style.id = 'jobsite-header-cleanup';
            style.textContent = `
                .site-header {
                    font-size: 0;
                }

                .site-header .header-inner {
                    gap: 24px;
                }

                .site-header .logo {
                    flex-shrink: 0;
                }

                .site-header .logo-plane {
                    flex: 0 0 26px;
                    width: 26px;
                    height: 26px;
                    display: block;
                }

                .site-header .main-nav {
                    gap: 26px;
                    min-width: 0;
                    flex-shrink: 1;
                }

                .site-header .main-nav > a,
                .site-header .nav-dropdown-btn {
                    white-space: nowrap;
                }

                .site-header .nav-dropdown-btn {
                    font-size: 15px;
                }

                .site-header .header-actions {
                    gap: 16px;
                    flex-shrink: 0;
                }
            `;

            document.head.appendChild(style);
        }
    }
}


/* Apply the same active state to the shared icon rail on every route. */
function syncJobsiteRail() {
    const rail = document.querySelector('nav.jobsite-global-rail');
    if (!rail) return;

    /* Restore Resources centrally so every page with the shared rail gets it. */
    if (!rail.querySelector('.jobsite-resources-dropdown')) {
        const resources = document.createElement('div');
        resources.className = 'nav-dropdown jobsite-resources-dropdown';
        resources.innerHTML = `
            <button type="button" class="nav-dropdown-btn" data-label="Resources"
                aria-label="Resources" aria-expanded="false">Resources</button>
            <div class="nav-dropdown-panel" aria-label="Resource pages">
                <a href="/resume-tips.html">Resume Tips</a>
                <a href="/interview-prep.html">Interview Prep</a>
                <a href="/career-guides.html">Career Guides</a>
            </div>`;

        if (!document.querySelector('#jobsite-resources-menu-style')) {
            const style = document.createElement('style');
            style.id = 'jobsite-resources-menu-style';
            style.textContent = `
                .jobsite-global-rail > .jobsite-resources-dropdown {
                    position:relative!important;display:flex!important;align-items:center!important;
                    justify-content:center!important;width:42px!important;min-width:42px!important;
                    max-width:42px!important;height:44px!important;min-height:44px!important;
                    flex:0 0 44px!important;margin:0 auto!important;
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn {
                    position:relative!important;display:flex!important;align-items:center!important;
                    justify-content:center!important;width:42px!important;min-width:42px!important;
                    height:44px!important;padding:0!important;border:0!important;border-radius:14px!important;
                    background:transparent;color:var(--ink);font-size:0!important;cursor:pointer;
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn::before {
                    content:"☷";display:grid;place-items:center;width:24px;height:24px;
                    font:20px/1 "Segoe UI Symbol",sans-serif;
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn::after {
                    content:"Resources";position:absolute;top:50%;left:calc(100% + 11px);
                    transform:translate(-4px,-50%);padding:9px 12px;border:1px solid var(--line);
                    border-radius:12px;background:#fff;color:var(--ink);box-shadow:var(--bubble-shadow);
                    font:700 12px/1.2 var(--font-body);white-space:nowrap;opacity:0;visibility:hidden;
                    pointer-events:none;
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn:hover,
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn:focus-visible,
                .jobsite-global-rail .jobsite-resources-dropdown.is-open>.nav-dropdown-btn {
                    background:var(--indigo-tint);color:var(--indigo);
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn:hover::after,
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-btn:focus-visible::after {
                    opacity:1;visibility:visible;transform:translate(0,-50%);
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-panel {
                    display:none;position:absolute;top:0;left:calc(100% + 10px);z-index:700;
                    min-width:170px;padding:8px;border:1px solid var(--line);border-radius:15px;
                    background:#fff;box-shadow:var(--bubble-shadow);
                }
                .jobsite-global-rail .jobsite-resources-dropdown:hover>.nav-dropdown-panel,
                .jobsite-global-rail .jobsite-resources-dropdown:focus-within>.nav-dropdown-panel,
                .jobsite-global-rail .jobsite-resources-dropdown.is-open>.nav-dropdown-panel {display:block}
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-panel a {
                    display:block;padding:10px 12px;border-radius:10px;color:var(--ink);
                    font-size:12px;white-space:nowrap;
                }
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-panel a:hover,
                .jobsite-global-rail .jobsite-resources-dropdown>.nav-dropdown-panel a:focus-visible {
                    background:var(--indigo-tint);color:var(--indigo);
                }`;
            document.head.appendChild(style);
        }

        const aboutLink = rail.querySelector('a[data-rail="about"]');
        if (aboutLink) aboutLink.insertAdjacentElement('afterend', resources);
        else rail.appendChild(resources);

        const button = resources.querySelector('.nav-dropdown-btn');
        button.addEventListener('click', () => {
            const open = resources.classList.toggle('is-open');
            button.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('click', (event) => {
            if (!resources.contains(event.target)) {
                resources.classList.remove('is-open');
                button.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                resources.classList.remove('is-open');
                button.setAttribute('aria-expanded', 'false');
            }
        });
    }
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    rail.querySelectorAll('a[data-rail]').forEach((link) => {
        const href = new URL(link.href, window.location.origin);
        const target = href.pathname.replace(/\/$/, '') || '/';
        const isCurrent = target === path ||
            (link.dataset.rail === 'dashboard' && path === '/career-center.html') ||
            (link.dataset.rail === 'resume' && path === '/resume-builder.html');
        link.classList.toggle('is-current', isCurrent);
        if (isCurrent) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncJobsiteRail, { once: true });
} else {
    syncJobsiteRail();
}
