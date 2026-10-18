/* Smooth white page transitions: 2 seconds total, with quick ease-in and smooth ease-out. */
(() => {
  'use strict';

  const FADE_IN_MS = 350;
  const FADE_OUT_MS = 1650;
  const OVERLAY_ID = 'page-transition-overlay';

  function addTransitionStyles() {
    if (document.getElementById('page-transition-styles')) return;
    const style = document.createElement('style');
    style.id = 'page-transition-styles';
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: #fff;
        opacity: 1;
        pointer-events: none;
        will-change: opacity;
        transition: opacity ${FADE_OUT_MS}ms cubic-bezier(.16, 1, .3, 1);
      }
      #${OVERLAY_ID}.page-transition-leaving {
        opacity: 1;
        pointer-events: all;
        transition: opacity ${FADE_IN_MS}ms cubic-bezier(.7, 0, .84, 0);
      }
      @media (prefers-reduced-motion: reduce) {
        #${OVERLAY_ID},
        #${OVERLAY_ID}.page-transition-leaving {
          transition-duration: 1ms;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (!document.body || document.getElementById(OVERLAY_ID)) return;
    addTransitionStyles();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    // New page starts covered in white, then reveals its content with a smooth ease-out.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.opacity = '0';
        window.setTimeout(() => overlay.remove(), FADE_OUT_MS + 100);
      });
    });

    // Cover the current page before navigating, then the destination page fades away from white.
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || link.hasAttribute('download') || link.target === '_blank') return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      overlay.classList.add('page-transition-leaving');
      overlay.style.pointerEvents = 'all';
      overlay.style.opacity = '1';
      window.setTimeout(() => {
        window.location.href = url.href;
      }, FADE_IN_MS);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
