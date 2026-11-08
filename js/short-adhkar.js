/** منصة البيان — مكتبة الأذكار القصيرة */
(() => {
  'use strict';

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function initialiseShortAdhkar() {
    const grid = document.getElementById('short-adhkar-grid');
    const categoriesContainer = document.getElementById('short-adhkar-categories');
    const searchInput = document.getElementById('short-adhkar-search');
    const emptyState = document.getElementById('short-adhkar-empty');

    if (!grid || !categoriesContainer || !searchInput || typeof shortAdhkarData === 'undefined') return;

    let activeCategory = 'الكل';
    const categories = ['الكل', ...new Set(shortAdhkarData.map((item) => item.category))];

    function renderCategories() {
      categoriesContainer.innerHTML = categories.map((category) => `
        <button type="button" class="category-chip ${category === activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `).join('');

      categoriesContainer.querySelectorAll('[data-category]').forEach((button) => {
        button.addEventListener('click', () => {
          activeCategory = button.dataset.category || 'الكل';
          renderCategories();
          renderCards();
        });
      });
    }

    function getVisibleItems() {
      const query = searchInput.value.trim().toLowerCase();
      return shortAdhkarData.filter((item) => {
        const categoryMatch = activeCategory === 'الكل' || item.category === activeCategory;
        const haystack = `${item.title} ${item.category} ${item.text} ${item.source}`.toLowerCase();
        return categoryMatch && (!query || haystack.includes(query));
      });
    }

    function renderCards() {
      const items = getVisibleItems();
      emptyState.hidden = items.length !== 0;
      grid.innerHTML = items.map((item) => `
        <article class="short-dhikr-card" data-id="${escapeHtml(item.id)}">
          <div class="short-dhikr-card-header">
            <span class="dua-category-badge">${escapeHtml(item.category)}</span>
            <span class="short-dhikr-repetitions">${item.repetitions > 1 ? `${item.repetitions} مرات` : 'مرة واحدة'}</span>
          </div>
          <h2 class="short-dhikr-title">${escapeHtml(item.title)}</h2>
          <p class="short-dhikr-text">${escapeHtml(item.text)}</p>
          <p class="dua-card-source">المصدر: ${escapeHtml(item.source)}</p>
          <div class="card-actions-bar">
            <button type="button" class="tool-btn short-copy-btn" data-id="${escapeHtml(item.id)}">نسخ</button>
            <button type="button" class="tool-btn short-share-btn" data-id="${escapeHtml(item.id)}">مشاركة</button>
          </div>
        </article>
      `).join('');

      grid.querySelectorAll('.short-copy-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const item = shortAdhkarData.find((entry) => entry.id === button.dataset.id);
          if (item && window.App) window.App.copyText(`${item.title}\n${item.text}\nالمصدر: ${item.source}`);
        });
      });

      grid.querySelectorAll('.short-share-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const item = shortAdhkarData.find((entry) => entry.id === button.dataset.id);
          if (item && window.App) {
            window.App.shareContent({
              title: `${item.title} — البيان`,
              text: `${item.text}\nالمصدر: ${item.source}`
            });
          }
        });
      });
    }

    searchInput.addEventListener('input', renderCards);
    renderCategories();
    renderCards();
  }

  document.addEventListener('DOMContentLoaded', initialiseShortAdhkar);
})();
