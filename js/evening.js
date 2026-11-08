/**
 * منصة البيان — أذكار المساء (Evening Session Controller)
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof eveningAdhkar === 'undefined' || !eveningAdhkar.length) {
    console.error('بيانات أذكار المساء غير محملة');
    return;
  }

  window.currentSession = new DhikrSessionEngine({
    sessionType: 'evening',
    sessionTitle: 'أذكار المساء',
    items: eveningAdhkar
  });
});
