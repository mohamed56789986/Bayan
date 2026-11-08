/**
 * منصة البيان — إضافات الصفحة الرئيسية
 * رسالة اليوم وبطاقة الفاتحة؛ ملف مستقل لحماية منطق الصفحة الحالية.
 */
(() => {
  'use strict';

  function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }

  function renderDailyReflection() {
    const container = document.getElementById('daily-reflection-container');
    if (!container || typeof dailyReflections === 'undefined' || !dailyReflections.length) return;

    const reflection = dailyReflections[getDayOfYear() % dailyReflections.length];
    const escapeHtml = window.App.escapeHtml;
    container.innerHTML = `
      <article class="daily-reflection-card">
        <div class="daily-reflection-header">
          <span class="section-badge">${escapeHtml(reflection.label)}</span>
          <span class="daily-reflection-sun" aria-hidden="true">☀️</span>
        </div>
        <p class="daily-reflection-text">${escapeHtml(reflection.text)}</p>
        <p class="daily-reflection-source">${escapeHtml(reflection.source)}</p>
        <div class="card-actions-bar">
          <button type="button" class="tool-btn" id="copy-daily-reflection">نسخ الرسالة</button>
          <button type="button" class="tool-btn" id="share-daily-reflection">مشاركة الرسالة</button>
        </div>
      </article>
    `;

    const copyButton = document.getElementById('copy-daily-reflection');
    const shareButton = document.getElementById('share-daily-reflection');
    if (copyButton && window.App) {
      copyButton.addEventListener('click', () => window.App.copyText(reflection.shareText, 'تم نسخ رسالة اليوم ✨'));
    }
    if (shareButton && window.App) {
      shareButton.addEventListener('click', () => window.App.shareContent({
        title: 'رسالة اليوم من البيان',
        text: reflection.shareText
      }));
    }
  }

  function initialiseFatihaShare() {
    const button = document.getElementById('share-fatiha-btn');
    if (!button || !window.App) return;
    button.addEventListener('click', () => {
      window.App.shareContent({
        title: 'سورة الفاتحة ودعاء بالرحمة',
        text: 'سورة الفاتحة ودعاء بالرحمة لروح الشهيد المهندس مؤمن أكرم دبور والشهيد الشاب معاذ أكرم دبور.'
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderDailyReflection();
    initialiseFatihaShare();
  });
})();
