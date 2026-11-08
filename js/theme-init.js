/**
 * منصة البيان — تطبيق الثيم قبل الرسم (pre-paint)
 * يُقرأ قبل ملف CSS حتى لا تظهر شاشة بيضاء ثم تُقلَب إلى الوضع الليلي
 * المفتاح يطابق StorageKeys.THEME في js/storage.js
 */
(() => {
  'use strict';

  const THEME_COLOR_LIGHT = '#FCFAF5';
  const THEME_COLOR_DARK = '#141C16';

  function resolve() {
    let saved = null;
    try {
      saved = localStorage.getItem('alBayan_theme');
    } catch (e) {
      saved = null;
    }
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
    }
  }

  apply(resolve());

  window.AlBayanTheme = { resolve, apply };
})();
