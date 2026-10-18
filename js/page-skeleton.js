/* Page-specific initial skeleton loader. Shows for exactly 1.5 seconds. */
(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  const kind = path === '/' || path.endsWith('/index.html') ? 'home'
    : path.includes('companies') ? 'companies'
    : path.includes('learning') ? 'learning'
    : path.includes('profile') ? 'profile'
    : path.includes('resume-builder') ? 'builder'
    : path.endsWith('/resume.html') ? 'analyzer'
    : path.includes('applications') ? 'applications'
    : path.includes('career-center') ? 'dashboard'
    : path.includes('employer') ? 'employer'
    : path.includes('admin') ? 'admin'
    : path.includes('privacy') || path.includes('terms') || path.includes('about') || path.includes('tips') || path.includes('prep') || path.includes('guides') ? 'article'
    : 'listing';

  const bar = (w = '100%', h = 12, extra = '') => '<i class="ps-bar ' + extra + '" style="width:' + w + ';height:' + h + 'px"></i>';
  const card = (variant = '') => '<div class="ps-card ' + variant + '">' + bar('42%', 13) + bar('82%', 19) + bar('64%') + '<div class="ps-row">' + bar('31%', 10) + bar('25%', 10) + '</div></div>';
  const cards = (n = 3, variant = '') => '<div class="ps-cards ' + variant + '">' + Array.from({length:n}, () => card()).join('') + '</div>';
  const field = () => '<div class="ps-field">' + bar('34%', 10) + bar('100%', 40, 'ps-field-box') + '</div>';
  const layouts = {
    home: '<div class="ps-hero"><div class="ps-hero-copy">' + bar('32%', 10) + bar('78%', 31) + bar('61%', 31) + bar('76%') + '<div class="ps-row">' + bar('130px', 42, 'ps-pill') + bar('110px', 42, 'ps-pill') + '</div></div><div class="ps-hero-art">' + bar('58%', 14) + bar('85%', 21) + cards(2, 'ps-mini-grid') + '</div></div><div class="ps-section-head">' + bar('220px', 20) + bar('100px', 12) + '</div>' + cards(3) + '<div class="ps-section-head">' + bar('180px', 20) + '</div>' + cards(4)',
    companies: '<div class="ps-heading">' + bar('36%', 27) + bar('57%', 13) + '</div><div class="ps-toolbar">' + bar('100%', 42, 'ps-pill') + bar('130px', 42, 'ps-pill') + '</div>' + cards(6, 'ps-company-grid'),
    learning: '<div class="ps-heading">' + bar('40%', 27) + bar('68%', 13) + '</div><div class="ps-progress">' + bar('26%', 12) + bar('100%', 9) + '</div><div class="ps-two-col"><div>' + card() + card() + card() + '</div><div>' + card() + card() + '</div></div>',
    profile: '<div class="ps-heading">' + bar('27%', 27) + bar('49%', 13) + '</div><div class="ps-profile-layout"><div class="ps-card ps-profile-side">' + bar('92px', 92, 'ps-avatar') + bar('70%', 16) + bar('54%') + '</div><div class="ps-card"><div class="ps-form-grid">' + Array.from({length:8}, field).join('') + '</div>' + bar('130px', 40, 'ps-pill') + '</div></div>',
    builder: '<div class="ps-heading">' + bar('32%', 27) + bar('52%', 13) + '</div><div class="ps-builder-layout"><div class="ps-card"><div class="ps-row">' + bar('45%', 18) + bar('24%', 12) + '</div>' + Array.from({length:7}, field).join('') + '</div><div class="ps-card ps-paper">' + bar('57%', 20) + bar('35%', 11) + '<hr>' + bar('28%', 13) + bar('92%') + bar('80%') + bar('86%') + bar('30%', 13) + bar('90%') + bar('73%') + '</div></div>',
    analyzer: '<div class="ps-heading">' + bar('34%', 27) + bar('63%', 13) + '</div><div class="ps-analyzer-layout"><div class="ps-card">' + bar('44%', 18) + bar('100%', 145, 'ps-dropzone') + bar('100%', 40, 'ps-pill') + '</div><div class="ps-card">' + bar('42%', 18) + '<div class="ps-score">' + bar('110px', 110, 'ps-circle') + '</div>' + cards(2) + '</div></div>',
    applications: '<div class="ps-heading">' + bar('39%', 27) + bar('53%', 13) + '</div><div class="ps-toolbar">' + bar('100%', 42, 'ps-pill') + bar('140px', 42, 'ps-pill') + '</div>' + cards(4, 'ps-application-list'),
    dashboard: '<div class="ps-heading">' + bar('36%', 27) + bar('59%', 13) + '</div>' + cards(4, 'ps-stat-grid') + '<div class="ps-two-col"><div class="ps-card">' + bar('45%', 18) + cards(3) + '</div><div class="ps-card">' + bar('52%', 18) + cards(2) + '</div></div>',
    employer: '<div class="ps-heading">' + bar('35%', 27) + bar('54%', 13) + '</div>' + cards(4, 'ps-stat-grid') + '<div class="ps-card">' + bar('25%', 18) + '<div class="ps-table">' + Array.from({length:5}, () => '<div class="ps-row">' + bar('26%', 14) + bar('31%', 14) + bar('16%', 14) + '</div>').join('') + '</div></div>',
    admin: '<div class="ps-heading">' + bar('34%', 27) + bar('48%', 13) + '</div>' + cards(4, 'ps-stat-grid') + '<div class="ps-two-col"><div class="ps-card">' + bar('35%', 18) + cards(3) + '</div><div class="ps-card">' + bar('35%', 18) + cards(3) + '</div></div>',
    article: '<div class="ps-article"><div class="ps-heading">' + bar('34%', 30) + bar('61%', 13) + '</div>' + bar('100%', 190, 'ps-banner') + bar('93%') + bar('98%') + bar('85%') + bar('64%') + '<div class="ps-article-sub">' + bar('37%', 19) + bar('96%') + bar('88%') + bar('92%') + bar('69%') + '</div></div>',
    listing: '<div class="ps-heading">' + bar('35%', 27) + bar('56%', 13) + '</div><div class="ps-toolbar">' + bar('100%', 42, 'ps-pill') + bar('120px', 42, 'ps-pill') + '</div><div class="ps-job-layout"><div>' + cards(4, 'ps-job-list') + '</div><div class="ps-card ps-job-detail">' + bar('44%', 19) + bar('72%', 22) + bar('46%') + bar('35%', 12) + '<hr>' + bar('31%', 16) + bar('95%') + bar('87%') + bar('73%') + bar('90%', 42, 'ps-pill') + '</div></div>'
  };
  const overlay = document.createElement('div');
  overlay.className = 'page-skeleton-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<div class="ps-header"><div class="ps-brand">' + bar('100px', 19) + bar('125px', 7) + '</div><div class="ps-nav">' + bar('58px') + bar('72px') + bar('64px') + bar('78px') + '</div><div class="ps-actions">' + bar('74px', 32, 'ps-pill') + bar('86px', 32, 'ps-pill') + '</div></div><main class="ps-main ps-kind-' + kind + '">' + (layouts[kind] || layouts.listing) + '</main>';
  const mount = () => {
    if (!document.body || document.querySelector('.page-skeleton-overlay')) return;
    document.body.appendChild(overlay);
    window.setTimeout(() => {
      overlay.classList.add('ps-leaving');
      window.setTimeout(() => overlay.remove(), 180);
    }, 1500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
