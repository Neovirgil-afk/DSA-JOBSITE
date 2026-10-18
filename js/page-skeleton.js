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
  const style = document.createElement('style');
  style.textContent = `
    .page-skeleton-overlay{position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;overflow:auto!important;background:#f8f7f2!important;color:#17233f!important;opacity:1;visibility:visible;pointer-events:auto;transition:opacity .18s ease}
    .page-skeleton-overlay.ps-leaving{opacity:0;pointer-events:none}
    .page-skeleton-overlay *{box-sizing:border-box}
    .ps-header{height:76px;display:flex;align-items:center;gap:24px;padding:0 clamp(18px,5vw,72px);background:#fff;border-bottom:1px solid #e9e7ef}
    .ps-brand{display:flex;flex-direction:column;gap:7px;flex-shrink:0}.ps-nav,.ps-actions,.ps-row{display:flex;align-items:center;gap:12px}.ps-nav{margin-left:auto;gap:clamp(12px,2vw,28px)}.ps-actions{gap:8px}
    .ps-main{width:min(1120px,calc(100% - 40px));margin:36px auto 64px;min-height:calc(100vh - 120px)}
    .ps-bar{display:block;position:relative;overflow:hidden;max-width:100%;border-radius:7px;background:#e5e3ed;flex-shrink:0}
    .ps-bar:after{content:"";position:absolute;inset:0;transform:translateX(-110%);background:linear-gradient(100deg,transparent 10%,rgba(255,255,255,.85) 48%,transparent 85%);animation:psShimmer 1.05s ease-in-out infinite}
    .ps-pill{border-radius:999px}.ps-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:18px 0}
    .ps-card{min-width:0;padding:20px;background:#fff;border:1px solid #ebe9f1;border-radius:18px;box-shadow:0 5px 18px #1c23410a;display:flex;flex-direction:column;gap:13px}
    .ps-card .ps-row{margin-top:5px}.ps-heading{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}.ps-toolbar{display:flex;gap:12px;max-width:640px;margin:20px 0 24px}.ps-toolbar .ps-bar:first-child{flex:1}
    .ps-hero{display:grid;grid-template-columns:1.05fr .95fr;gap:32px;align-items:center;padding:34px;margin-bottom:35px;border:1px solid #ece9f2;border-radius:26px;background:#fff}
    .ps-hero-copy,.ps-hero-art{display:flex;flex-direction:column;align-items:flex-start;gap:15px}.ps-hero-copy .ps-row{margin-top:8px;flex-wrap:wrap}.ps-hero-art{padding:22px;border-radius:20px;background:#f0eef8;min-height:210px;justify-content:center;width:100%}
    .ps-mini-grid{grid-template-columns:repeat(2,minmax(0,1fr));width:100%;margin:0}.ps-mini-grid .ps-card{padding:12px}
    .ps-section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:30px 0 16px}.ps-company-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .ps-progress{display:flex;flex-direction:column;gap:10px;padding:17px 20px;background:#fff;border:1px solid #ebe9f1;border-radius:16px;margin-bottom:20px}
    .ps-two-col{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.ps-two-col>.ps-card{align-self:start}
    .ps-profile-layout,.ps-builder-layout,.ps-analyzer-layout{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.5fr);gap:20px}.ps-profile-side{align-items:center;min-height:210px}.ps-avatar{border-radius:50%;width:92px;background:#e8e6f0}
    .ps-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:18px}.ps-field{display:flex;flex-direction:column;gap:9px;min-width:0}.ps-field-box{border:1px solid #e5e3ec;background:#faf9fc;border-radius:9px}
    .ps-builder-layout{grid-template-columns:minmax(0,1fr) minmax(280px,.9fr);align-items:start}.ps-paper{min-height:470px;padding:30px 26px}.ps-paper hr{border:0;border-top:1px solid #eceaf1;width:100%;margin:4px 0}
    .ps-dropzone{border:1px dashed #c9c5df;background:#f8f7fc;border-radius:14px}.ps-score{display:flex;justify-content:center;padding:10px}.ps-circle{border-radius:50%;border:10px solid #e7e5f1;background:transparent}
    .ps-application-list{grid-template-columns:1fr 1fr}.ps-stat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.ps-table{margin-top:20px}.ps-table .ps-row{justify-content:space-between;padding:14px 0;border-bottom:1px solid #efedf4}
    .ps-article{max-width:820px;margin:0 auto}.ps-banner{border-radius:16px;margin:22px 0;min-height:150px;background:#e9e7f2}.ps-article-sub{display:flex;flex-direction:column;gap:15px;margin-top:30px}
    .ps-job-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:18px;align-items:start}.ps-job-list{grid-template-columns:1fr 1fr}.ps-job-detail{min-height:350px}
    @keyframes psShimmer{to{transform:translateX(110%)}}
    @media(max-width:760px){.ps-header{height:68px;padding:0 18px}.ps-nav{display:none}.ps-actions{margin-left:auto}.ps-main{width:calc(100% - 28px);margin-top:22px}.ps-hero,.ps-two-col,.ps-profile-layout,.ps-builder-layout,.ps-analyzer-layout,.ps-job-layout{grid-template-columns:1fr}.ps-hero{padding:22px}.ps-cards,.ps-company-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.ps-card{padding:15px}.ps-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ps-job-detail,.ps-paper{min-height:250px}.ps-profile-side{display:none}}
    @media(max-width:460px){.ps-cards,.ps-application-list,.ps-job-list{grid-template-columns:1fr}.ps-form-grid{grid-template-columns:1fr}.ps-toolbar{gap:8px}.ps-header{gap:10px}.ps-actions .ps-bar{max-width:76px}}
    @media(prefers-reduced-motion:reduce){.ps-bar:after{animation:none}.page-skeleton-overlay{transition:none}}
  `;
  const header = '<div class="ps-header"><div class="ps-brand">' + bar('100px', 19) + bar('125px', 7) + '</div><div class="ps-nav">' + bar('58px') + bar('72px') + bar('64px') + bar('78px') + '</div><div class="ps-actions">' + bar('74px', 32, 'ps-pill') + bar('86px', 32, 'ps-pill') + '</div></div>';
  const overlay = document.createElement('div');
  overlay.className = 'page-skeleton-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = header + '<main class="ps-main">' + (layouts[kind] || layouts.listing) + '</main>';
  let hideTimer;
  const show = (targetPath) => {
    const target = (targetPath || location.pathname).toLowerCase();
    const targetKind = target === '/' || target.endsWith('/index.html') ? 'home'
      : target.includes('companies') ? 'companies'
      : target.includes('learning') ? 'learning'
      : target.includes('profile') ? 'profile'
      : target.includes('resume-builder') ? 'builder'
      : target.endsWith('/resume.html') ? 'analyzer'
      : target.includes('applications') ? 'applications'
      : target.includes('career-center') ? 'dashboard'
      : target.includes('employer') ? 'employer'
      : target.includes('admin') ? 'admin'
      : target.includes('privacy') || target.includes('terms') || target.includes('about') || target.includes('tips') || target.includes('prep') || target.includes('guides') ? 'article'
      : 'listing';
    overlay.innerHTML = header + '<main class="ps-main">' + (layouts[targetKind] || layouts.listing) + '</main>';
    overlay.classList.remove('ps-leaving');
    if (!overlay.isConnected && document.body) document.body.appendChild(overlay);
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      overlay.classList.add('ps-leaving');
      window.setTimeout(() => overlay.remove(), 200);
    }, 1500);
  };
  const mount = () => {
    if (!document.head.contains(style)) document.head.appendChild(style);
    show(location.pathname);
    document.addEventListener('click', (event) => {
      const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname && url.search === location.search && url.hash) return;
      if (url.pathname !== location.pathname || url.search !== location.search) show(url.pathname);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
