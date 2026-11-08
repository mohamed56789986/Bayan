(() => {
  'use strict';

  function initAzkarRoutesPage() {
    const azkarGrid = document.getElementById('azkar-grid');
    const searchInput = document.getElementById('azkar-search');
    if (!azkarGrid || !searchInput) return;

    const esc = window.App.escapeHtml;

    function normalizeArabic(text) {
      return text
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();
    }

    function renderAzkarCards(filterQuery = '') {
      azkarGrid.innerHTML = '';
      const cleanQuery = normalizeArabic(filterQuery);

      const filtered = AZKAR_PAGES.filter((item) => {
        if (!cleanQuery) return true;
        const searchableText = normalizeArabic(`${item.title} ${item.description} ${item.keywords || ''}`);
        return searchableText.includes(cleanQuery);
      });

      if (filtered.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-search-state';
        emptyState.textContent = `لا توجد أذكار مطابقة لبحثك "${filterQuery}"`;
        azkarGrid.appendChild(emptyState);
        return;
      }

      filtered.forEach((item) => {
        const cardLink = document.createElement('a');
        cardLink.href = item.url;
        cardLink.className = 'service-router-card';
        cardLink.setAttribute('aria-label', `${item.title} — ${item.description}`);

        cardLink.innerHTML = `
          <div class="service-card-top">
            <div class="service-card-icon" aria-hidden="true">${esc(item.icon)}</div>
            <div class="service-card-body">
              <h2 class="service-card-title">${esc(item.title)}</h2>
              <p class="service-card-desc">${esc(item.description)}</p>
            </div>
          </div>
          <div class="service-card-footer">
            <span class="service-card-pill">${esc(item.actionText || 'عرض الأذكار ←')}</span>
          </div>
        `;

        azkarGrid.appendChild(cardLink);
      });
    }

    searchInput.addEventListener('input', (e) => {
      renderAzkarCards(e.target.value);
    });

    renderAzkarCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAzkarRoutesPage, { once: true });
  } else {
    initAzkarRoutesPage();
  }
})();
