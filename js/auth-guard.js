import { initAuth } from './auth.js';

// Pages without the homepage app bootstrap still need the shared login modal.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initAuth(), { once: true });
} else {
  initAuth();
}
