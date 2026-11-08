(() => {
  'use strict';

  function initRouterPage() {
    const servicesGrid = document.getElementById('services-grid');
    const searchInput = document.getElementById('services-search');
    if (!servicesGrid || !searchInput) return;

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

    function renderServices(filterQuery = '') {
      servicesGrid.innerHTML = '';
      const cleanQuery = normalizeArabic(filterQuery);

      const filtered = PLATFORM_SERVICES.filter((service) => {
        if (!cleanQuery) return true;
        const searchableText = normalizeArabic(`${service.title} ${service.description} ${service.keywords || ''}`);
        return searchableText.includes(cleanQuery);
      });

      if (filtered.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-search-state';
        emptyState.textContent = `لا توجد خدمات مطابقة لبحثك "${filterQuery}"`;
        servicesGrid.appendChild(emptyState);
        return;
      }

      filtered.forEach((service) => {
        const cardLink = document.createElement('a');
        cardLink.href = service.url;
        cardLink.className = 'service-router-card';
        cardLink.setAttribute('aria-label', `${service.title} — ${service.description}`);

        cardLink.innerHTML = `
          <div class="service-card-top">
            <div class="service-card-icon" aria-hidden="true">${esc(service.icon)}</div>
            <div class="service-card-body">
              <h2 class="service-card-title">${esc(service.title)}</h2>
              <p class="service-card-desc">${esc(service.description)}</p>
            </div>
          </div>
          <div class="service-card-footer">
            <span class="service-card-pill">عرض الخدمة ←</span>
          </div>
        `;

        servicesGrid.appendChild(cardLink);
      });
    }

    searchInput.addEventListener('input', (e) => {
      renderServices(e.target.value);
    });

    renderServices();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouterPage, { once: true });
  } else {
    initRouterPage();
  }
})();
