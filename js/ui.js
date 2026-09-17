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
