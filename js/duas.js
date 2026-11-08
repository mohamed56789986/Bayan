/**
 * منصة البيان — وحدة مكتبة الأدعية (Duas Controller)
 * تدير البحث الفوري، تصفية التصنيفات، العرض المتجاوب، النسخ والمشاركة
 */

document.addEventListener('DOMContentLoaded', () => {
  DuasController.init();
});

const DuasController = {
  activeCategory: 'all',
  searchQuery: '',
  duas: [],

  init() {
    if (typeof duasData === 'undefined' || !duasData.length) {
      console.warn('بيانات الأدعية غير متوفرة');
      return;
    }
    this.duas = duasData;

    this.initCategoryFilters();
    this.initSearch();
    this.render();
  },

  // Normalize Arabic text for reliable, tolerant searching
  normalizeArabic(text) {
    if (!text) return '';
    return text
      // Remove diacritics / tashkeel
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Normalize Alef variants
      .replace(/[أإآ]/g, 'ا')
      // Normalize Taa Marbuta
      .replace(/ة/g, 'ه')
      // Normalize Yaa / Alef Maksura
      .replace(/ى/g, 'ي')
      .trim()
      .toLowerCase();
  },

  initCategoryFilters() {
    const chips = document.querySelectorAll('.category-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.getAttribute('data-category');
        this.render();
      });
    });
  },

  initSearch() {
    const searchInput = document.getElementById('duas-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      if (clearBtn) {
        clearBtn.style.display = this.searchQuery ? 'block' : 'none';
      }
      this.render();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
        this.render();
      });
    }
  },

  filterDuas() {
    let list = this.duas;

    // Filter by category
    if (this.activeCategory !== 'all') {
      list = list.filter(d => d.category === this.activeCategory);
    }

    // Filter by search query
    if (this.searchQuery) {
      const q = this.normalizeArabic(this.searchQuery);
      list = list.filter(d => {
        const textMatch = this.normalizeArabic(d.text).includes(q);
        const sourceMatch = this.normalizeArabic(d.source).includes(q);
        const categoryMatch = this.normalizeArabic(d.categoryName).includes(q);
        const keywordsMatch = d.keywords && d.keywords.some(k => this.normalizeArabic(k).includes(q));
        return textMatch || sourceMatch || categoryMatch || keywordsMatch;
      });
    }

    return list;
  },

  render() {
    const grid = document.getElementById('duas-grid-container');
    const countBadge = document.getElementById('duas-count-badge');
    if (!grid) return;

    const filtered = this.filterDuas();

    if (countBadge) {
      countBadge.textContent = `${filtered.length} دعاء`;
    }

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-search-state">
          <p style="font-size: 1.2rem; margin-bottom: 8px;">لم يتم العثور على أدعية تطابق بحثك</p>
          <p style="font-size: 0.95rem; color: var(--text-light);">جرب البحث بكلمات أخرى أو اختر تصنيفًا مختلفًا</p>
        </div>
      `;
      return;
    }

    const escapeHtml = window.App.escapeHtml;
    grid.innerHTML = filtered.map(d => `
      <div class="dua-card" data-id="${d.id}">
        <div class="dua-card-header">
          <span class="dua-category-badge">${escapeHtml(d.categoryName)}</span>
        </div>
        <div class="dua-card-text">"${escapeHtml(d.text)}"</div>
        <div class="dua-card-source">المصدر: ${escapeHtml(d.source)}</div>
        <div class="card-actions-bar" style="justify-content: flex-start;">
          <button class="tool-btn copy-dua-btn" data-id="${d.id}" aria-label="نسخ هذا الدعاء">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            نسخ
          </button>
          <button class="tool-btn share-dua-btn" data-id="${d.id}" aria-label="مشاركة هذا الدعاء">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            مشاركة
          </button>
        </div>
      </div>
    `).join('');

    // Attach Copy and Share event listeners
    grid.querySelectorAll('.copy-dua-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const dua = this.duas.find(d => d.id === id);
        if (dua && window.App) {
          window.App.copyText(`"${dua.text}"\n\nالمصدر: ${dua.source}`);
        }
      });
    });

    grid.querySelectorAll('.share-dua-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const dua = this.duas.find(d => d.id === id);
        if (dua && window.App) {
          window.App.shareContent({
            title: `${dua.categoryName} — منصة البيان`,
            text: `"${dua.text}"\n\nالمصدر: ${dua.source}`
          });
        }
      });
    });
  }
};

window.DuasController = DuasController;
