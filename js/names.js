(() => {
  'use strict';

  function initNamesPage() {
    const grid = document.getElementById('names-grid');
    const listView = document.getElementById('list-view');
    const readerView = document.getElementById('reader-view');
    const searchInput = document.getElementById('name-search');
    const copyBtn = document.getElementById('copy-name-btn');
    const backBtn = document.getElementById('back-to-list-btn');
    const prevBtn = document.getElementById('prev-name-btn');
    const nextBtn = document.getElementById('next-name-btn');
    const progressFill = document.getElementById('reader-progress-fill');
    const readerBadge = document.getElementById('reader-badge');
    const readerName = document.getElementById('reader-name');
    const readerMeaning = document.getElementById('reader-meaning');
    const readerCounter = document.getElementById('reader-counter');

    if (!grid || !searchInput || typeof allahNames === 'undefined' || !allahNames.length) return;

    const esc = window.App.escapeHtml;
    let currentNameIndex = 0;

    function normalizeArabic(text) {
      return text.replace(/[\u064B-\u065F\u0670]/g, '').trim();
    }

    // رسم كروت مدمجة تعرض الرقم والاسم فقط بنفس التصميم مع الكلاسات المخصصة للمسافات
    function renderNames(filterText = '') {
      grid.innerHTML = '';
      const rawQuery = filterText.trim();
      const normalizedQuery = normalizeArabic(rawQuery);

      const filtered = allahNames
        .map((item, index) => ({ ...item, originalIndex: index }))
        .filter(item => {
          if (!rawQuery) return true;
          const numMatch = String(item.originalIndex + 1) === rawQuery;
          const nameMatch = normalizeArabic(item.name).includes(normalizedQuery) || item.name.includes(rawQuery);
          const meaningMatch = normalizeArabic(item.meaning).includes(normalizedQuery) || item.meaning.includes(rawQuery);
          return numMatch || nameMatch || meaningMatch;
        });

      if (filtered.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-search-state';
        emptyState.textContent = `لا توجد نتائج مطابقة لبحثك "${filterText}"`;
        grid.appendChild(emptyState);
        return;
      }

      filtered.forEach((item) => {
        const cardBtn = document.createElement('button');
        cardBtn.type = 'button';
        cardBtn.className = 'action-card allah-name-card open-name-btn';
        cardBtn.setAttribute('data-index', item.originalIndex);
        cardBtn.setAttribute('aria-label', `عرض معنى اسم الله ${item.name}`);

        cardBtn.innerHTML = `
          <span class="allah-name-badge">${esc(item.originalIndex + 1)}</span>
          <strong class="allah-name-card-title">${esc(item.name)}</strong>
          <small class="tap-hint-text">عرض المعنى ←</small>
        `;
        grid.appendChild(cardBtn);
      });
    }

    // فتح واجهة القراءة والتدبر للاسم المختار
    function openReader(index) {
      currentNameIndex = index;
      const item = allahNames[index];
      if (!item) return;

      if (readerBadge) readerBadge.textContent = `الاسم رقم ${index + 1} من ${allahNames.length}`;
      if (readerName) readerName.textContent = item.name;
      if (readerMeaning) readerMeaning.textContent = item.meaning;
      if (readerCounter) readerCounter.textContent = `${index + 1} / ${allahNames.length}`;

      if (progressFill) progressFill.style.width = `${Math.round(((index + 1) / allahNames.length) * 100)}%`;

      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === allahNames.length - 1;

      if (listView) listView.hidden = true;
      if (readerView) readerView.hidden = false;

      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (navigator.vibrate) navigator.vibrate(25);
    }

    function closeReader() {
      if (readerView) readerView.hidden = true;
      if (listView) listView.hidden = false;
    }

    grid.addEventListener('click', (e) => {
      const openBtn = e.target.closest('.open-name-btn');
      if (openBtn) {
        const index = parseInt(openBtn.getAttribute('data-index'), 10);
        if (Number.isInteger(index)) openReader(index);
      }
    });

    if (backBtn) backBtn.addEventListener('click', closeReader);

    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (currentNameIndex > 0) openReader(currentNameIndex - 1);
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (currentNameIndex < allahNames.length - 1) openReader(currentNameIndex + 1);
    });

    if (copyBtn) copyBtn.addEventListener('click', () => {
      const item = allahNames[currentNameIndex];
      if (item) window.App.copyText(`${item.name} — ${item.meaning}`, `تم نسخ اسم الله "${item.name}" ومعناه ✨`);
    });

    searchInput.addEventListener('input', (e) => {
      renderNames(e.target.value);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && readerView && !readerView.hidden) closeReader();
    });

    // ضبط عدّاد الواجهة على العدد الفعلي للأسماء قبل فتح بطاقة القراءة
    if (readerCounter) readerCounter.textContent = `1 / ${allahNames.length}`;
    if (readerBadge) readerBadge.textContent = `الاسم رقم 1 من ${allahNames.length}`;

    renderNames();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNamesPage, { once: true });
  } else {
    initNamesPage();
  }
})();
