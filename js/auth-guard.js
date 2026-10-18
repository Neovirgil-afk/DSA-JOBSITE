import { initAuth } from './auth.js';

// Keep the shared login modal available on every page.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initAuth(), { once: true });
} else {
  initAuth();
}

// The global navigation is shared by candidates and employers, but some
// shortcuts only make sense for candidates. Hide those links for employers
// after resolving the authenticated role.
(async function configureRoleNavigation() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) return;
    const data = await response.json();
    const user = data && data.user;
    if (!user || user.role !== 'employer') return;

    document.documentElement.dataset.userRole = 'employer';

    document.querySelectorAll('.jobsite-global-rail [data-rail]').forEach((link) => {
      const candidateOnly = ['applications', 'learn', 'profile', 'resume'];
      if (candidateOnly.includes(link.dataset.rail)) {
        link.hidden = true;
        link.style.display = 'none';
      }
      if (link.dataset.rail === 'dashboard') {
        link.href = '/employer.html';
        link.dataset.label = 'Employer Dashboard';
        link.title = 'Employer Dashboard';
        link.setAttribute('aria-label', 'Employer Dashboard');
      }
      if (link.dataset.rail === 'jobs') {
        link.dataset.label = 'Browse Jobs';
        link.title = 'Browse Jobs';
      }
    });
  } catch (_) {
    // Navigation remains unchanged if session lookup is unavailable.
  }
})();
