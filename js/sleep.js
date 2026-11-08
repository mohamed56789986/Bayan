/** منصة البيان — تهيئة جلسة أذكار النوم */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof sleepAdhkar === 'undefined' || !sleepAdhkar.length) {
    console.error('بيانات أذكار النوم غير محملة');
    return;
  }

  window.currentSession = new DhikrSessionEngine({
    sessionType: 'sleep',
    sessionTitle: 'أذكار النوم',
    items: sleepAdhkar
  });
});
