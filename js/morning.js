/**
 * منصة البيان — أذكار الصباح (Morning Session Controller)
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof morningAdhkar === 'undefined' || !morningAdhkar.length) {
    console.error('بيانات أذكار الصباح غير محملة');
    return;
  }

  window.currentSession = new DhikrSessionEngine({
    sessionType: 'morning',
    sessionTitle: 'أذكار الصباح',
    items: morningAdhkar
  });
});
