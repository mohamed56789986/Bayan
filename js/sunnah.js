


    const grid = document.getElementById('sunnah-grid');
    const searchInput = document.getElementById('sunnah-search');
    const categoryContainer = document.getElementById('sunnah-categories');

    let activeCategory = 'all';

    function showToast(message) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 2600);
    }

    function normalizeArabic(text) {
      return text
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();
    }

    function renderSunnahs() {
      grid.innerHTML = '';
      const query = normalizeArabic(searchInput.value);

      const filtered = DAILY_SUNNAHS.filter((item) => {
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        if (!matchesCategory) return false;

        if (!query) return true;
        const searchable = normalizeArabic(`${item.title} ${item.description} ${item.source} ${item.keywords || ''}`);
        return searchable.includes(query);
      });

      if (filtered.length === 0) {
        grid.innerHTML = `
          <div class="empty-search-state">
            لا توجد سنن مطابقة لبحثك "${searchInput.value}"
          </div>
        `;
        return;
      }

      filtered.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'dua-card';

        card.innerHTML = `
          <div>
            <div class="dua-card-header">
              <span class="dua-category-badge">${item.categoryLabel}</span>
              <span class="short-dhikr-repetitions">${item.icon}</span>
            </div>
            <h2 class="short-dhikr-title">${item.title}</h2>
            <p class="dua-card-text">${item.description}</p>
            <p class="dua-card-source">📚 المصدر: ${item.source}</p>
          </div>
          <div class="card-actions-bar">
            <button type="button" class="tool-btn copy-sunnah-btn" data-index="${DAILY_SUNNAHS.indexOf(item)}">
              📋 نسخ السُّنة والدليل
            </button>
          </div>
        `;

        grid.appendChild(card);
      });
    }

    // فلترة بالتصنيف (Chips)
    categoryContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;

      document.querySelectorAll('#sunnah-categories .category-chip').forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });

      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      activeCategory = chip.getAttribute('data-category');
      renderSunnahs();
    });

    // فلترة بالبحث النصي
    searchInput.addEventListener('input', renderSunnahs);

    // نسخ نصوص السنن مع الدليل
    grid.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-sunnah-btn');
      if (!copyBtn) return;

      const idx = parseInt(copyBtn.getAttribute('data-index'), 10);
      const item = DAILY_SUNNAHS[idx];
      const textToCopy = `🌿 ${item.title}\n${item.description}\n📚 المصدر: ${item.source}`;

      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('تم نسخ السُّنة النبوية والدليل بنجاح ✨');
      });
    });

    renderSunnahs();