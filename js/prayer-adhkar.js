/* منصة البيان — عرض أذكار ما بعد الصلاة */
(() => {
  'use strict';

  const data = window.prayerAdhkarData;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function actionButton(item) {
    if (item.kind === 'quran-link') {
      const link = createElement('a', 'prayer-quran-link', item.linkLabel);
      link.href = item.link;
      return link;
    }

    if (item.kind === 'quran-links') {
      const links = createElement('div', 'prayer-quran-links');
      item.links.forEach((entry) => {
        const link = createElement('a', 'prayer-quran-link', entry.label);
        link.href = entry.href;
        links.appendChild(link);
      });
      return links;
    }

    if (item.kind === 'tasbeeh') return null;

    const button = createElement('button', 'tool-btn prayer-copy-btn', 'نسخ الذكر');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (window.App) window.App.copyText(item.text, 'تم نسخ الذكر بنجاح');
    });
    return button;
  }

  function renderTasbeeh(item) {
    const wrap = createElement('div', 'prayer-tasbeeh-wrap');
    const counts = createElement('div', 'prayer-tasbeeh-counts');

    item.tasbeehs.forEach((dhikr) => {
      const unit = createElement('div', 'prayer-tasbeeh-unit');
      unit.appendChild(createElement('strong', '', dhikr.count));
      unit.appendChild(createElement('span', '', dhikr.label));
      unit.appendChild(createElement('p', '', dhikr.text));
      counts.appendChild(unit);
    });

    const completion = createElement('div', 'prayer-tasbeeh-completion');
    completion.appendChild(createElement('span', '', 'ثم تمام المئة'));
    completion.appendChild(createElement('p', '', item.completion));
    wrap.append(counts, completion);
    return wrap;
  }

  function renderItems() {
    const container = document.getElementById('prayer-adhkar-content');
    if (!container || !data) return;
    container.replaceChildren();

    const heading = createElement('div', 'prayer-selection-heading prayer-page-heading');
    heading.append(createElement('span', 'prayer-selection-icon', '🕌'));
    heading.append(createElement('h2', '', 'أذكار مشتركة بعد كل صلاة مفروضة'));
    container.appendChild(heading);

    data.items.forEach((item, index) => {
      const card = createElement('article', `prayer-dhikr-card${item.kind === 'tasbeeh' ? ' is-tasbeeh-card' : ''}`);
      const header = createElement('div', 'prayer-dhikr-card-header');
      header.append(createElement('span', 'prayer-dhikr-number', String(index + 1)));
      header.append(createElement('h3', 'prayer-dhikr-title', item.title));
      header.append(createElement('span', `prayer-dhikr-count${item.special ? ' is-special' : ''}`, item.repetitions));
      card.appendChild(header);

      if (item.special) card.appendChild(createElement('p', 'prayer-special-note', item.special));
      if (item.kind === 'tasbeeh') {
        card.appendChild(renderTasbeeh(item));
      } else if (item.text) {
        card.appendChild(createElement('p', 'prayer-dhikr-text', item.text));
      }

      const action = actionButton(item);
      if (action) card.appendChild(action);
      card.appendChild(createElement('p', 'prayer-dhikr-source', `المصدر: ${item.source}`));
      container.appendChild(card);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!data || !Array.isArray(data.items)) {
      console.error('بيانات أذكار ما بعد الصلاة غير متوفرة');
      return;
    }
    renderItems();
  });
})();
