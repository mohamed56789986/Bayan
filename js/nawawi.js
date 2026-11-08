(() => {
  'use strict';

  function initNawawiPage() {
    const grid = document.getElementById('hadith-grid');
    const listView = document.getElementById('list-view');
    const readerView = document.getElementById('reader-view');
    const searchInput = document.getElementById('hadith-search');
    const copyBtn = document.getElementById('copy-hadith-btn');
    const backBtn = document.getElementById('back-to-list-btn');
    const prevBtn = document.getElementById('prev-hadith-btn');
    const nextBtn = document.getElementById('next-hadith-btn');
    const progressFill = document.getElementById('reader-progress-fill');
    const readerNumber = document.getElementById('reader-number');
    const readerTitle = document.getElementById('reader-title');
    const readerText = document.getElementById('reader-text');
    const readerExplanation = document.getElementById('reader-explanation');
    const readerCounter = document.getElementById('reader-counter');

    if (!grid || !searchInput || typeof hadiths === 'undefined' || !hadiths.length) return;

    const esc = window.App.escapeHtml;
    let currentHadithIndex = 0;

    // شرح الأربعون النووية يكتب في البيانات بوسوم <br> و<b> فقط؛ نحتفظ بها ونحيّد أي وسم آخر
    function sanitizeExplanation(html) {
      return esc(html)
        .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
        .replace(/&lt;b&gt;/gi, '<b>')
        .replace(/&lt;\/b&gt;/gi, '</b>');
    }

    function renderHadiths(filterText = '') {
      grid.innerHTML = '';
      const query = filterText.trim().toLowerCase();

      const filtered = hadiths
        .map((item, index) => ({ ...item, originalIndex: index }))
        .filter(item =>
          item.number.includes(query) ||
          item.title.includes(query) ||
          item.text.includes(query)
        );

      if (filtered.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-search-state';
        emptyState.textContent = `لا توجد أحاديث مطابقة لبحثك "${filterText}"`;
        grid.appendChild(emptyState);
        return;
      }

      filtered.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'dua-card';

        const snippet = item.text.length > 120 ? item.text.substring(0, 120) + '...' : item.text;

        card.innerHTML = `
          <div>
            <div class="dua-card-header">
              <span class="dua-category-badge">${esc(item.number)}</span>
              <span class="short-dhikr-repetitions">الأربعون النووية</span>
            </div>
            <h2 class="short-dhikr-title">${esc(item.title)}</h2>
            <p class="dua-card-text">${esc(snippet)}</p>
          </div>
          <div class="card-actions-bar">
            <button type="button" class="tool-btn read-hadith-btn" data-index="${item.originalIndex}">
              📖 قراءة الحديث والشرح
            </button>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    function openReader(index) {
      currentHadithIndex = index;
      const item = hadiths[index];
      if (!item) return;

      if (readerNumber) readerNumber.textContent = item.number;
      if (readerTitle) readerTitle.textContent = item.title;
      if (readerText) readerText.textContent = item.text;
      if (readerExplanation) readerExplanation.innerHTML = sanitizeExplanation(item.explanation);
      if (readerCounter) readerCounter.textContent = `${index + 1} / ${hadiths.length}`;

      if (progressFill) progressFill.style.width = `${Math.round(((index + 1) / hadiths.length) * 100)}%`;

      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === hadiths.length - 1;

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
      const btn = e.target.closest('.read-hadith-btn');
      if (btn) {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        if (Number.isInteger(index)) openReader(index);
      }
    });

    if (backBtn) backBtn.addEventListener('click', closeReader);

    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (currentHadithIndex > 0) openReader(currentHadithIndex - 1);
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (currentHadithIndex < hadiths.length - 1) openReader(currentHadithIndex + 1);
    });

    if (copyBtn) copyBtn.addEventListener('click', () => {
      const item = hadiths[currentHadithIndex];
      if (!item) return;
      const cleanExplanation = item.explanation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      const textToCopy = `${item.number} — ${item.title}\n\n${item.text}\n\n${cleanExplanation}`;
      window.App.copyText(textToCopy, 'تم نسخ الحديث والشرح بنجاح ✨');
    });

    searchInput.addEventListener('input', (e) => {
      renderHadiths(e.target.value);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && readerView && !readerView.hidden) closeReader();
    });

    if (readerCounter) readerCounter.textContent = `1 / ${hadiths.length}`;

    renderHadiths();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNawawiPage, { once: true });
  } else {
    initNawawiPage();
  }
})();
