/*
 * منصة البيان — قارئ المصحف المحلي (صفحات مصحف المدينة ٦٠٤)
 * مصدر النص: Tanzil Uthmani Text. تُقرأ الآيات كما هي من data/quran-uthmani.txt.
 * حدود الصفحات والجزء من بيانات Tanzil نفسها: <pages/> و<juzs/> داخل data/quran-metadata.xml.
 */
(() => {
  'use strict';

  const QURAN_TEXT_URL = '../data/quran-uthmani.txt';
  const QURAN_METADATA_URL = '../data/quran-metadata.xml';
  const EXPECTED_VERSE_COUNT = 6236;
  const EXPECTED_SURA_COUNT = 114;
  const EXPECTED_PAGE_COUNT = 604;
  const DAILY_SURAH_IDS = [36, 56, 55, 44, 67, 2, 18, 62, 76, 53];
  const BOOKMARK_KEY = 'bayan_quran_manual_bookmark_v2';

  const state = {
    verses: [],       // مرتبة ترتيبًا مصحفيًا؛ فهرس المصفوفة = الرقم العام للآية (من صفر)
    suras: [],        // start = عدد الآيات قبل السورة
    pages: [],        // pages[p-1] = أول آية في الصفحة p من مصحف المدينة
    juzs: [],
    pageRanges: [],   // نطاق آيات كل صفحة بالأرقام العامة (شاملان)
    currentPage: 1,
    requestedSurah: null,
    requestedAyah: null,
    hasExplicitLocation: false,
    options: [],
    labelIsPristine: true
  };

  const elements = {};
  let activeOption = null;
  let scrollTimer = 0;
  let navigating = false;
  let basmalaVariants = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function arabicNumber(value) {
    return Number(value).toLocaleString('ar-EG');
  }

  function normalizeArabic(text) {
    return String(text)
      .replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200E]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim()
      .toLowerCase();
  }

  function suraTitle(sura) {
    return `${arabicNumber(sura.id)} — سورة ${sura.name}`;
  }

  function getSura(id) {
    return state.suras.find((sura) => sura.id === id);
  }

  function parseRequestedLocation() {
    const params = new URLSearchParams(window.location.search);
    const surah = Number(params.get('surah'));
    const ayah = Number(params.get('ayah'));
    if (Number.isInteger(surah) && surah >= 1 && surah <= EXPECTED_SURA_COUNT) {
      state.requestedSurah = surah;
      state.hasExplicitLocation = true;
      if (Number.isInteger(ayah) && ayah > 0) state.requestedAyah = ayah;
    }
  }

  function parseQuranText(rawText) {
    const verses = rawText.split(/\r?\n/).reduce((all, line) => {
      if (!/^\d+\|\d+\|/.test(line)) return all;
      const firstSeparator = line.indexOf('|');
      const secondSeparator = line.indexOf('|', firstSeparator + 1);
      const surah = Number(line.slice(0, firstSeparator));
      const ayah = Number(line.slice(firstSeparator + 1, secondSeparator));
      const text = line.slice(secondSeparator + 1);
      if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !text) return all;
      all.push({ surah, ayah, text });
      return all;
    }, []);

    if (verses.length !== EXPECTED_VERSE_COUNT) {
      throw new Error(`فشل التحقق من عدد الآيات: وُجد ${verses.length} بدلًا من ${EXPECTED_VERSE_COUNT}.`);
    }
    return verses;
  }

  function parseMetadata(xmlText) {
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('تعذر قراءة بيانات السور المحلية.');
    const suras = [...xml.querySelectorAll('sura[index]')].map((node) => ({
      id: Number(node.getAttribute('index')),
      name: node.getAttribute('name'),
      ayas: Number(node.getAttribute('ayas')),
      type: node.getAttribute('type'),
      start: Number(node.getAttribute('start'))
    }));

    if (suras.length !== EXPECTED_SURA_COUNT || suras.some((sura) => !sura.name || !sura.ayas)) {
      throw new Error('فشل التحقق من بيانات السور المحلية.');
    }

    // حدود الصفحات من خريطة مصحف المدينة المنشورة في بيانات Tanzil نفسها، لا من تقسيم تقريبي
    const pages = [...xml.querySelectorAll('page[index]')].map((node) => ({
      surah: Number(node.getAttribute('sura')),
      ayah: Number(node.getAttribute('aya'))
    }));
    if (pages.length !== EXPECTED_PAGE_COUNT || pages.some((page) => !Number.isInteger(page.surah) || !Number.isInteger(page.ayah))) {
      throw new Error(`فشل التحقق من خريطة الصفحات: المطلوب ${EXPECTED_PAGE_COUNT} صفحة من بيانات Tanzil.`);
    }

    const juzs = [...xml.querySelectorAll('juz[index]')].map((node) => ({
      surah: Number(node.getAttribute('sura')),
      ayah: Number(node.getAttribute('aya'))
    }));

    return { suras, pages, juzs };
  }

  // الرقم العام للآية: عدد الآيات قبل سورتها + رقم آيتها (من صفر)
  function globalIndex(surah, ayah) {
    const sura = getSura(surah);
    return sura ? sura.start + ayah - 1 : -1;
  }

  // يُبنى مرة واحدة: نطاق آيات كل صفحة، والتحقق أن كل آية تقع في صفحة واحدة بالضبط
  function buildPageIndex() {
    const starts = state.pages.map((page) => globalIndex(page.surah, page.ayah));
    if (starts[0] !== 0) throw new Error('الصفحة الأولى يجب أن تبدأ من فاتحة الكتاب.');
    starts.forEach((value, i) => {
      if (!Number.isInteger(value) || value < 0 || (i > 0 && value <= starts[i - 1])) throw new Error('خريطة الصفحات غير صالحة.');
    });
    state.pageRanges = starts.map((from, i) => ({
      from,
      to: i + 1 < starts.length ? starts[i + 1] - 1 : EXPECTED_VERSE_COUNT - 1
    }));
    const covered = state.pageRanges.reduce((total, range) => total + range.to - range.from + 1, 0);
    if (covered !== EXPECTED_VERSE_COUNT) throw new Error('نطاقات الصفحات لا تغطي كل الآيات.');
  }

  // أحدث صفحة أول آيتها ≤ الآية المطلوبة
  function pageOfVerse(surah, ayah) {
    const target = globalIndex(surah, ayah);
    let low = 0;
    let high = state.pageRanges.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (state.pageRanges[mid].from <= target) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  }

  function juzOfVerse(surah, ayah) {
    const target = globalIndex(surah, ayah);
    let result = 1;
    state.juzs.forEach((juz, i) => {
      if (globalIndex(juz.surah, juz.ayah) <= target) result = i + 1;
    });
    return result;
  }

  function pageFirstVerse() {
    return state.pages[state.currentPage - 1] || { surah: 1, ayah: 1 };
  }

  // البسملة في الملف جزء من نص الآية الأولى للسور ٢–١١٤ عدا التوبة؛ الصيغتان مشتقتان من الفاتحة نفسها (٩٥ و٩٦ تشكيلة مختلفة)
  function initBasmalaVariants() {
    const base = state.verses[0].text;
    basmalaVariants = [base, `${base.slice(0, 1)}\u0651${base.slice(1)}`];
  }

  // تقسيم عرضي فقط: لا يُحذف ولا يُضاف أي حرف من النص العثماني
  function splitBasmala(text) {
    for (const prefix of basmalaVariants) {
      if (text === prefix) return { basmala: prefix, rest: '' };
      if (text.startsWith(`${prefix} `)) return { basmala: prefix, rest: text.slice(prefix.length + 1) };
    }
    return null;
  }

  function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('error', isError);
  }

  function readBookmark() {
    try {
      const bookmark = JSON.parse(localStorage.getItem(BOOKMARK_KEY));
      const sura = bookmark && getSura(Number(bookmark.surah));
      const ayah = Number(bookmark && bookmark.ayah);
      if (!sura || !Number.isInteger(ayah) || ayah < 1 || ayah > sura.ayas) return null;
      return { surah: sura.id, ayah };
    } catch (_) {
      return null;
    }
  }

  function writeBookmark(surah, ayah) {
    const sura = getSura(surah);
    if (!sura || !Number.isInteger(ayah) || ayah < 1 || ayah > sura.ayas) return null;
    const bookmark = { surah, ayah, savedAt: Date.now() };
    try {
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
      return bookmark;
    } catch (_) {
      return null;
    }
  }

  function describeBookmark(bookmark) {
    const sura = bookmark && getSura(bookmark.surah);
    return sura ? `سورة ${sura.name} — الآية ${arabicNumber(bookmark.ayah)}` : '';
  }

  function renderBookmarkPanel(message) {
    const bookmark = readBookmark();
    if (!bookmark) {
      elements.bookmarkMessage.textContent = message || 'ضع علامة عند الآية التي توقفتِ عندها، لتعودي إليها عند فتح المصحف.';
      elements.resumeButton.hidden = true;
      return;
    }
    const description = describeBookmark(bookmark);
    elements.bookmarkMessage.textContent = message || `علامتك المحفوظة: ${description}`;
    elements.resumeButton.hidden = false;
    elements.resumeButton.textContent = `العودة إلى ${description}`;
  }

  function setSelectedSura(id) {
    if (!getSura(id)) return;
    syncComboField(id);
    // أول صفحة تحوي بداية السورة، مع تمييز أول آية منها إن بدأت في منتصف الصفحة
    goToPage(pageOfVerse(id, 1), { highlight: { surah: id, ayah: 1 }, scroll: true });
  }

  function resumeBookmark() {
    const bookmark = readBookmark();
    if (!bookmark) return;
    syncComboField(bookmark.surah);
    goToPage(pageOfVerse(bookmark.surah, bookmark.ayah), { highlight: bookmark, scroll: true });
  }

  function saveBookmarkAt(surah, ayah) {
    const bookmark = writeBookmark(surah, ayah);
    if (!bookmark) return;

    document.querySelectorAll('.quran-ayah.is-bookmarked').forEach((node) => node.classList.remove('is-bookmarked'));
    document.querySelectorAll('.quran-ayah-bookmark.is-active').forEach((node) => {
      node.classList.remove('is-active');
      node.setAttribute('aria-pressed', 'false');
      node.title = node.dataset.defaultTitle || 'وضع علامة مرجعية عند هذه الآية';
    });

    const target = document.getElementById(`ayah-${surah}-${ayah}`);
    if (target) {
      target.classList.add('is-bookmarked');
      const button = target.querySelector('.quran-ayah-bookmark');
      if (button) {
        button.classList.add('is-active');
        button.setAttribute('aria-pressed', 'true');
        button.title = 'هذه هي علامتك المرجعية';
      }
    }
    renderBookmarkPanel(`تم وضع علامة مرجعية عند ${describeBookmark(bookmark)}.`);
  }

  function buildSuraOptions() {
    // عُقدتان ثابتة لكل سورة: التصفية تُخفي وتُظهر، فلا يُعاد بناء القائمة مع كل ضغطة مفتاح
    state.options = state.suras.map((sura) => {
      const node = element('li', 'quran-combo-option');
      node.id = `quran-sura-option-${sura.id}`;
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', 'false');
      node.dataset.sura = String(sura.id);
      // الاسم الكامل كما كان في قائمة الاختيار الأصلية، وعرض السورة يقرأه قارئ الشاشة بلا فراغات بين الحقلين
      node.setAttribute('aria-label', `${arabicNumber(sura.id)} — سورة ${sura.name} (${arabicNumber(sura.ayas)} آية)`);
      node.appendChild(element('span', 'quran-combo-option-name', suraTitle(sura)));
      node.appendChild(element('span', 'quran-combo-option-count', `${arabicNumber(sura.ayas)} آية`));
      return { sura, node, searchable: normalizeArabic(sura.name) };
    });
    elements.list.replaceChildren(...state.options.map((entry) => entry.node));
  }

  function syncComboField(id) {
    const sura = getSura(id);
    if (!sura) return;
    elements.combo.value = suraTitle(sura);
    state.labelIsPristine = true;
    state.options.forEach((entry) => {
      entry.node.setAttribute('aria-selected', String(entry.sura.id === id));
    });
  }

  function renderDailyShortcuts() {
    elements.shortcuts.replaceChildren();
    DAILY_SURAH_IDS.forEach((id) => {
      const sura = getSura(id);
      if (!sura) return;
      const button = element('button', 'quran-shortcut', `سورة ${sura.name}`);
      button.type = 'button';
      button.addEventListener('click', () => setSelectedSura(id));
      elements.shortcuts.appendChild(button);
    });
  }

  function visibleOptions() {
    return state.options.filter((entry) => !entry.node.hidden).map((entry) => entry.node);
  }

  function isPopupOpen() {
    return !elements.popup.hidden;
  }

  function setExpanded(open) {
    elements.popup.hidden = !open;
    elements.combo.setAttribute('aria-expanded', String(open));
    elements.toggle.setAttribute('aria-expanded', String(open));
  }

  function filterOptions(rawQuery) {
    const query = normalizeArabic(rawQuery);
    let matches = 0;
    state.options.forEach((entry) => {
      const show = !query || entry.searchable.includes(query);
      entry.node.hidden = !show;
      if (show) matches++;
    });
    elements.empty.hidden = !(query && matches === 0);
    return matches;
  }

  function setActiveOption(node) {
    if (activeOption && activeOption !== node) activeOption.classList.remove('is-active');
    activeOption = node || null;
    if (!activeOption) {
      elements.combo.removeAttribute('aria-activedescendant');
      return;
    }
    activeOption.classList.add('is-active');
    activeOption.scrollIntoView({ block: 'nearest' });
    elements.combo.setAttribute('aria-activedescendant', activeOption.id);
  }

  function moveActive(step) {
    const visible = visibleOptions();
    if (!visible.length) {
      setActiveOption(null);
      return;
    }
    const currentIndex = activeOption ? visible.indexOf(activeOption.node) : -1;
    const nextIndex = currentIndex === -1
      ? (step > 0 ? 0 : visible.length - 1)
      : Math.min(Math.max(currentIndex + step, 0), visible.length - 1);
    setActiveOption(visible[nextIndex]);
  }

  function openDropdown({ highlightFirst = false } = {}) {
    if (!state.options.length) return;
    if (state.labelIsPristine) filterOptions('');
    setExpanded(true);
    setActiveOption(highlightFirst ? visibleOptions()[0] || null : null);
  }

  function closeDropdown() {
    if (!isPopupOpen()) return;
    setExpanded(false);
    setActiveOption(null);
    syncComboField(pageFirstVerse().surah);
  }

  function commitSura(id) {
    if (!getSura(id)) return;
    closeDropdown();
    setSelectedSura(id);
  }

  function onComboInput() {
    state.labelIsPristine = false;
    const query = elements.combo.value.trim();
    const first = filterOptions(query) ? visibleOptions()[0] : null;
    setExpanded(true);
    setActiveOption(query ? first : null);
  }

  function onComboKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isPopupOpen()) openDropdown({ highlightFirst: true });
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      if (isPopupOpen() && activeOption) {
        event.preventDefault();
        commitSura(Number(activeOption.dataset.sura));
      }
      return;
    }
    if (event.key === 'Escape') {
      if (isPopupOpen()) {
        event.preventDefault();
        closeDropdown();
      }
      return;
    }
    if (event.key === 'Tab') {
      closeDropdown();
      return;
    }
    // الاسم المحدَّد صالح للعرض لا للبحث: أول حرف مكتوب يستبدله كله
    if (state.labelIsPristine && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
      elements.combo.select();
    }
  }

  function onComboClick() {
    if (isPopupOpen()) return;
    openDropdown({ highlightFirst: !state.labelIsPristine });
  }

  function onToggleClick() {
    if (isPopupOpen()) {
      closeDropdown();
      return;
    }
    elements.combo.focus();
    // السهم يفتح القائمة كاملة: استعادة الاسم المحدَّد تُبقي التصفية بلا استعلام
    syncComboField(pageFirstVerse().surah);
    openDropdown();
  }

  function onListClick(event) {
    const option = event.target.closest('.quran-combo-option');
    if (!option || option.hidden) return;
    commitSura(Number(option.dataset.sura));
  }

  function onDocumentPointerDown(event) {
    if (!isPopupOpen() || elements.root.contains(event.target)) return;
    closeDropdown();
  }

  function renderMushafPage(highlight) {
    const pageNumber = state.currentPage;
    const range = state.pageRanges[pageNumber - 1];
    const activeBookmark = readBookmark();
    const surahIds = [...new Set(state.verses.slice(range.from, range.to + 1).map((verse) => verse.surah))];
    const firstSura = getSura(surahIds[0]);
    const pageStart = pageFirstVerse();

    elements.pageFolio.textContent = `الصفحة ${arabicNumber(pageNumber)} من ${arabicNumber(EXPECTED_PAGE_COUNT)}`;
    elements.pageTitle.textContent = surahIds.map((id) => `سورة ${getSura(id).name}`).join(' • ');
    elements.pageMeta.textContent =
      `الجزء ${arabicNumber(juzOfVerse(pageStart.surah, pageStart.ayah))} — ${firstSura.type === 'Medinan' ? 'مدنية' : 'مكية'}`;

    const body = document.createDocumentFragment();
    for (let i = range.from; i <= range.to; i++) {
      const verse = state.verses[i];
      let displayText = verse.text;
      if (verse.ayah === 1) {
        // عنوان زخرفي كامل العرض، منفصل عن تدفق النص ولا يشارك في تسويقه
        const heading = element('div', 'quran-sura-heading');
        heading.appendChild(element('span', 'quran-sura-heading-name', `سورة ${getSura(verse.surah).name}`));
        body.appendChild(heading);
        if (verse.surah !== 1 && verse.surah !== 9) {
          const split = splitBasmala(verse.text);
          if (split) {
            body.appendChild(element('div', 'quran-basmala-line', split.basmala));
            displayText = split.rest;
          }
        }
      }
      const isBookmarked = Boolean(activeBookmark && activeBookmark.surah === verse.surah && activeBookmark.ayah === verse.ayah);
      const isTarget = Boolean(highlight && highlight.surah === verse.surah && highlight.ayah === verse.ayah);
      const ayah = element('span', `quran-ayah${isBookmarked ? ' is-bookmarked' : ''}${isTarget ? ' quran-ayah-target' : ''}`);
      ayah.id = `ayah-${verse.surah}-${verse.ayah}`;
      ayah.appendChild(element('span', 'quran-ayah-text', displayText));
      ayah.appendChild(element('span', 'quran-ayah-number', `﴿${arabicNumber(verse.ayah)}﴾`));
      const bookmarkButton = element('button', `quran-ayah-bookmark${isBookmarked ? ' is-active' : ''}`, '🔖');
      const bookmarkLabel = isBookmarked ? 'هذه هي علامتك المرجعية' : `وضع علامة مرجعية عند الآية ${arabicNumber(verse.ayah)}`;
      bookmarkButton.type = 'button';
      bookmarkButton.dataset.defaultTitle = 'وضع علامة مرجعية عند هذه الآية';
      bookmarkButton.title = bookmarkLabel;
      bookmarkButton.setAttribute('aria-label', bookmarkLabel);
      bookmarkButton.setAttribute('aria-pressed', String(isBookmarked));
      bookmarkButton.addEventListener('click', () => saveBookmarkAt(verse.surah, verse.ayah));
      ayah.appendChild(bookmarkButton);
      body.appendChild(ayah);
      body.appendChild(document.createTextNode(' '));
    }
    // لا يُعاد بناء إلا آيات الصفحة الحالية (١٣ آية تقريبًا)، لا المصحف كله
    elements.pageBody.replaceChildren(body);

    elements.counter.textContent = `${arabicNumber(pageNumber)} / ${arabicNumber(EXPECTED_PAGE_COUNT)}`;
    elements.pageInput.value = String(pageNumber);
    elements.prev.disabled = pageNumber === 1;
    elements.next.disabled = pageNumber === EXPECTED_PAGE_COUNT;

    window.clearTimeout(scrollTimer);
    if (highlight) {
      scrollTimer = window.setTimeout(() => {
        const target = document.getElementById(`ayah-${highlight.surah}-${highlight.ayah}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }

  // الرابط المباشر يعكس أول آية في الصفحة الحالية: إعادة التحميل تُعيد نفس الموضع
  function syncUrlToPage() {
    const start = pageFirstVerse();
    const params = new URLSearchParams(window.location.search);
    params.set('surah', String(start.surah));
    params.set('ayah', String(start.ayah));
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }

  function goToPage(pageNumber, { highlight = null, scroll = false } = {}) {
    if (navigating) return;
    const clamped = Math.min(Math.max(Math.trunc(Number(pageNumber)) || 1, 1), EXPECTED_PAGE_COUNT);
    navigating = true;
    try {
      state.currentPage = clamped;
      renderMushafPage(highlight);
      syncUrlToPage();
    } finally {
      navigating = false;
    }
    if (scroll) elements.reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function stepPage(delta) {
    goToPage(state.currentPage + delta);
  }

  function onPageJump() {
    const raw = Number(elements.pageInput.value);
    if (!Number.isFinite(raw) || raw === 0) {
      elements.pageInput.value = String(state.currentPage);
      return;
    }
    goToPage(raw);
  }

  function onKeyDown(event) {
    const tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || isPopupOpen()) return;
    // اتجاه المصحف: اليمين تقدُّم واليسار رجوع
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepPage(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepPage(-1);
    }
  }

  // السحب الأفقي وحده يقلب الصفحة؛ الرأسي يبقى للتمرير، وتحديد النص يمنع التقليب
  let touchTrack = null;

  function onTouchStart(event) {
    touchTrack = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  }

  function onTouchEnd(event) {
    if (!touchTrack) return;
    const track = touchTrack;
    touchTrack = null;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - track.x;
    const dy = touch.clientY - track.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (window.getSelection && String(window.getSelection())) return;
    stepPage(dx > 0 ? 1 : -1);
  }

  async function initializeReader() {
    try {
      const [textResponse, metadataResponse] = await Promise.all([
        fetch(QURAN_TEXT_URL, { cache: 'no-store' }),
        fetch(QURAN_METADATA_URL, { cache: 'no-store' })
      ]);
      if (!textResponse.ok || !metadataResponse.ok) throw new Error('تعذر فتح ملف المصحف المحلي.');
      const [rawText, metadataText] = await Promise.all([textResponse.text(), metadataResponse.text()]);
      state.verses = parseQuranText(rawText);
      const metadata = parseMetadata(metadataText);
      state.suras = metadata.suras;
      state.pages = metadata.pages;
      state.juzs = metadata.juzs;
      buildPageIndex();
      initBasmalaVariants();

      // ترتيب الملف يجب أن يطابق الأرقام العامة من بيانات السور: لا آية ناقصة أو مكررة
      state.verses.forEach((verse, index) => {
        if (globalIndex(verse.surah, verse.ayah) !== index) throw new Error('ترتيب الآيات لا يطابق بيانات السور.');
      });

      let initialHighlight = null;
      if (state.hasExplicitLocation) {
        const sura = getSura(state.requestedSurah);
        const ayah = Number.isInteger(state.requestedAyah) && state.requestedAyah >= 1 && state.requestedAyah <= sura.ayas
          ? state.requestedAyah
          : 1;
        initialHighlight = { surah: sura.id, ayah };
        state.currentPage = pageOfVerse(sura.id, ayah);
      } else {
        const bookmark = readBookmark();
        if (bookmark) {
          initialHighlight = bookmark;
          state.currentPage = pageOfVerse(bookmark.surah, bookmark.ayah);
        }
      }

      buildSuraOptions();
      syncComboField(pageFirstVerse().surah);
      renderDailyShortcuts();
      renderBookmarkPanel();
      renderMushafPage(initialHighlight);
      syncUrlToPage();
      setStatus(`تم التحقق من ${arabicNumber(EXPECTED_PAGE_COUNT)} صفحة و${arabicNumber(EXPECTED_VERSE_COUNT)} آية و${arabicNumber(EXPECTED_SURA_COUNT)} سورة محليًا.`);
    } catch (error) {
      console.error('Quran reader error:', error);
      setStatus('تعذر تحميل المصحف المحلي. تأكد من فتح التطبيق مرة واحدة مع الإنترنت حتى تُحفظ كل الملفات.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    elements.root = document.getElementById('quran-sura-combo-root');
    elements.combo = document.getElementById('quran-sura-combo');
    elements.toggle = document.getElementById('quran-combo-toggle');
    elements.popup = document.getElementById('quran-combo-popup');
    elements.list = document.getElementById('quran-sura-listbox');
    elements.empty = document.getElementById('quran-combo-empty');
    elements.shortcuts = document.getElementById('quran-daily-shortcuts');
    elements.status = document.getElementById('quran-reader-status');
    elements.reader = document.getElementById('quran-reader');
    elements.pageBody = document.getElementById('quran-page-body');
    elements.pageFolio = document.getElementById('quran-page-folio');
    elements.pageTitle = document.getElementById('quran-page-title');
    elements.pageMeta = document.getElementById('quran-page-meta');
    elements.counter = document.getElementById('quran-page-counter');
    elements.prev = document.getElementById('quran-prev-page');
    elements.next = document.getElementById('quran-next-page');
    elements.pageInput = document.getElementById('quran-page-input');
    elements.pageGo = document.getElementById('quran-page-go');
    elements.bookmarkMessage = document.getElementById('quran-bookmark-message');
    elements.resumeButton = document.getElementById('quran-resume-button');
    parseRequestedLocation();

    elements.combo.addEventListener('input', onComboInput);
    elements.combo.addEventListener('keydown', onComboKeydown);
    elements.combo.addEventListener('click', onComboClick);
    elements.toggle.addEventListener('click', onToggleClick);
    // مستمع واحد مُفوَّض بدل مستمع لكل سورة: لا تتكرر المستمعون مع كل تصفية
    elements.list.addEventListener('click', onListClick);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    elements.resumeButton.addEventListener('click', resumeBookmark);

    elements.prev.addEventListener('click', () => stepPage(-1));
    elements.next.addEventListener('click', () => stepPage(1));
    elements.pageGo.addEventListener('click', onPageJump);
    elements.pageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onPageJump();
      }
    });
    document.addEventListener('keydown', onKeyDown);
    elements.reader.addEventListener('touchstart', onTouchStart, { passive: true });
    elements.reader.addEventListener('touchend', onTouchEnd, { passive: true });

    initializeReader();
  });
})();
