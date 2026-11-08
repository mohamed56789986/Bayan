/**
 * منصة البيان — صفحة مواقيت الصلاة
 *
 * مصدر المواقيت هو الحساب المحلي في js/prayer-calc.js من إحداثيات الموقع
 * وتاريخ اليوم في منطقة ذلك الموقع: لا إنترنت لازم، ولا مواقيت أمس.
 * الموقع المخزَّن احتياطٌ لا حقيقةٌ دائمة: كل زيارة تطلب موقعاً جديداً
 * من الجهاز بمخزونٍ عمره صفر، والعدّاد لا يلمس المستشعرات أبداً.
 *
 * كل موقع يُحسب بملف حسابه: تفضيل المستخدم، ثم ملف المدينة المُنسَّق، ثم
 * منهج إقليمها، ثم الافتراضي المعلن. لا منهج قطرٍ مفروض على العالم، ولا
 * استنتاج يحتاج إنترنت: المدينة الأقرب تُختار من البيانات المحزَّمة نفسها.
 */
(() => {
  'use strict';

  const PRAYER_NAMES_AR = {
    Fajr: 'الفجر',
    Sunrise: 'الشروق',
    Dhuhr: 'الظهر',
    Asr: 'العصر',
    Maghrib: 'المغرب',
    Isha: 'العشاء'
  };

  const DISPLAY_PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const COUNTDOWN_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  const ISLAMIC_EVENTS = [
    { name: 'عاشوراء', m: 1, d: 10 },
    { name: 'المولد النبوي', m: 3, d: 12 },
    { name: 'الإسراء والمعراج', m: 7, d: 27 },
    { name: 'النصف من شعبان', m: 8, d: 15 },
    { name: 'بداية رمضان', m: 9, d: 1 },
    { name: 'عيد الفطر', m: 10, d: 1 },
    { name: 'يوم عرفة', m: 12, d: 9 },
    { name: 'عيد الأضحى', m: 12, d: 10 }
  ];

  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;
  const MINUTE_MS = 60000;
  const MINUTES_PER_DAY = 1440;
  const MINUTES_PER_HOUR = 60;

  const GEO_TIMEOUT_MS = 15000;
  const GEO_MAX_AGE_MS = 0; 
  const FRESH_WINDOW_MS = 5 * MINUTE_MS; 
  const ROLLOVER_CHECK_MS = 20000;
  const CITY_AUTO_OPTION = '__device__';
  const CITY_PLACEHOLDER_OPTION = '__pick__';
  // القيمة الفارغة في قائمتي التفضيل = بلا تفضيل: يرجع الحساب لمدينة الموقع وإقليمها
  const PREF_AUTO_OPTION = '';
  // البوصلة: مهلة هدوء المستشعر قبل الإبلاغ عن حالته، وأصغر حركة سهم تُكتب
  const COMPASS_QUIET_MS = 8000;
  const COMPASS_MIN_MOVE_DEG = 0.5;

  function initPrayerPage() {
    const els = {
      locationBanner: document.getElementById('location-banner'),
      dashboard: document.getElementById('prayer-dashboard'),
      timingsGrid: document.getElementById('timings-grid'),
      errorText: document.getElementById('location-error'),
      offsetPanel: document.getElementById('offset-panel'),
      offsetDisplay: document.getElementById('offset-display'),
      compassCard: document.getElementById('qibla-section'),
      cityText: document.getElementById('city-text'),
      locationStatus: document.getElementById('location-status'),
      hijriDay: document.getElementById('hijri-day'),
      hijriMonthYear: document.getElementById('hijri-month-year'),
      eventsList: document.getElementById('events-list'),
      nextPrayerName: document.getElementById('next-prayer-name'),
      countdownTimer: document.getElementById('countdown-timer'),
      compassStatus: document.getElementById('compass-status'),
      compassNeedle: document.getElementById('compass-needle'),
      initBtn: document.getElementById('init-location-btn'),
      locatingText: document.getElementById('locating-text'),
      settingsBtn: document.getElementById('settings-toggle-btn'),
      offsetPlusBtn: document.getElementById('offset-plus-btn'),
      offsetMinusBtn: document.getElementById('offset-minus-btn'),
      citySelect: document.getElementById('city-select'),
      methodSelect: document.getElementById('method-select'),
      asrSelect: document.getElementById('asr-select'),
      bannerCitySelect: document.getElementById('banner-city-select'),
      refreshLocationBtn: document.getElementById('refresh-location-btn'),
      useDeviceBtn: document.getElementById('use-device-location-btn')
    };

    if (!els.timingsGrid || !els.initBtn || !window.PrayerCalc) return;


    let current = null; // { latitude, longitude, timeZone, source, acquiredAt, ... }
    let timings = null;
    let locationTimeZone = null;
    let computedDateKey = null;
    let qiblaDegrees = null;
    let offsetMinutes = window.StorageManager ? window.StorageManager.loadPrayerOffset() : 0;
    // تفضيلات المستخدم الصريحة للمنهج ومدرسة العصر؛ null ما لم يختر المستخدم شيئاً
    // تحديد الموقع لا يكتبها أبداً، فلا تُدهس يدُ المستخدم بآليّة
    let userPrefs = null;
    // موضع الحساب الفعّال: المدينة المُنسَّقة وإقليمها وملفهما وتحذيراتهما
    let activePlacement = null;
    let compassState = 'off';
    // مستمع اتجاه واحد مُقتفَّى: التثبيت المتكرر يصنع طوابير من القراءات
    let compassListener = null;
    let compassPermissionAsked = false;
    let compassPermissionGranted = false;
    let compassAlphaSeen = 0;
    let compassNorthSeen = false;
    let compassQuietTimer = null;
    let needleRotation = 0; // تراكمي بلا قفز: السهم لا يدور دورة كاملة عند عبور 360°
    let countdownInterval = null;
    let rolloverInterval = null;
    let waitingForPosition = false;

    function parseClock(timeStr) {
      const match = /^(\d{1,2}):(\d{2})/.exec(String(timeStr || ''));
      if (!match) return null;
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours > 23 || minutes > 59) return null;
      return hours * MINUTES_PER_HOUR + minutes;
    }

    function shiftedClock(timeStr) {
      const base = parseClock(timeStr);
      if (base === null) return null;
      const shifted = (base + offsetMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      return formatClockMinutes(shifted);
    }

    function formatClockMinutes(totalMinutes) {
      return `${String(Math.floor(totalMinutes / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(totalMinutes % MINUTES_PER_HOUR).padStart(2, '0')}`;
    }

    // ضبط دقائق المستخدم للصوات الخمس دون الشروق: الشروق حدٌّ فلكي لا يُؤخَّر لمسجد
    function displayClock(prayer, timeStr) {
      if (prayer !== 'Sunrise') return shiftedClock(timeStr);
      const base = parseClock(timeStr);
      return base === null ? null : formatClockMinutes(base);
    }

    function secondsOfDayInZone(timeZone) {
      try {
        const parts = new Intl.DateTimeFormat('en-u-nu-latn', {
          timeZone: timeZone || undefined,
          hourCycle: 'h23',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).formatToParts(new Date());
        const value = (type) => {
          const part = parts.find((p) => p.type === type);
          return part ? Number(part.value) : 0;
        };
        return value('hour') * 3600 + value('minute') * MINUTES_PER_HOUR + value('second');
      } catch (e) {
        const now = new Date();
        return now.getHours() * 3600 + now.getMinutes() * MINUTES_PER_HOUR + now.getSeconds();
      }
    }

    function clockOf(instant) {
      const d = new Date(instant);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function dayKey(date) {
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    function describeAge(iso) {
      const when = new Date(iso);
      if (Number.isNaN(when.getTime())) return 'في وقت غير معروف';
      const minutesAgo = Math.floor((Date.now() - when.getTime()) / MINUTE_MS);
      if (minutesAgo < 1) return 'قبل لحظة';
      if (minutesAgo < MINUTES_PER_HOUR) return `منذ ${minutesAgo} دقيقة`;

      const savedKey = dayKey(when);
      const time = clockOf(when);
      if (savedKey === dayKey(new Date())) return `اليوم الساعة ${time}`;
      if (savedKey === dayKey(new Date(Date.now() - DAY_MS))) return `أمس الساعة ${time}`;
      return `بتاريخ ${when.getDate()}/${when.getMonth() + 1}/${when.getFullYear()}`;
    }

    function isFreshlyCaptured(record) {
      if (!record || record.source !== 'device') return false;
      const taken = new Date(record.acquiredAt).getTime();
      return Number.isFinite(taken) && Date.now() - taken < FRESH_WINDOW_MS;
    }


    function showError(message) {
      if (!els.errorText) return;
      els.errorText.textContent = message;
      els.errorText.hidden = false;
    }

    function clearError() {
      if (!els.errorText) return;
      els.errorText.hidden = true;
      els.errorText.textContent = '';
    }

    function setOffsetDisplay() {
      if (els.offsetDisplay) {
        els.offsetDisplay.textContent = offsetMinutes > 0 ? `+${offsetMinutes}` : String(offsetMinutes);
      }
    }

    function setLocationStatus(message, tone) {
      if (!els.locationStatus) return;
      els.locationStatus.textContent = message;
      els.locationStatus.classList.remove('is-fresh', 'is-stale', 'is-manual');
      if (tone) els.locationStatus.classList.add(tone);
    }

    function setLocating(active) {
      waitingForPosition = active;
      if (els.locatingText) els.locatingText.hidden = !active;
      if (els.initBtn) els.initBtn.disabled = active;
      if (els.refreshLocationBtn) els.refreshLocationBtn.disabled = active;
    }

    function showBanner(message) {
      els.dashboard.hidden = true;
      els.locationBanner.hidden = false;
      els.initBtn.disabled = false;
      showError(message);
    }

    function showDashboard() {
      clearError();
      els.locationBanner.hidden = true;
      els.dashboard.hidden = false;
    }


    function renderTimingsUI() {
      els.timingsGrid.innerHTML = '';

      DISPLAY_PRAYERS.forEach((prayer) => {
        const clock = displayClock(prayer, timings[prayer]);

        const card = document.createElement('div');
        card.className = 'prayer-time-card';
        card.id = `card-${prayer}`;

        const title = document.createElement('div');
        title.className = 'prayer-time-title';
        title.textContent = PRAYER_NAMES_AR[prayer];

        const value = document.createElement('div');
        value.className = 'prayer-time-val';

        if (!clock) {
          value.textContent = '--:--';
          card.classList.add('is-unavailable');
          card.title = 'لا يوجد وقت فلكي لهذا اليوم في موقعك';
          card.append(title, value);
          els.timingsGrid.append(card);
          return;
        }

        const [hoursRaw, minutes] = clock.split(':').map(Number);
        const period = document.createElement('span');
        period.className = 'prayer-time-period';
        period.textContent = hoursRaw >= 12 ? 'م' : 'ص';
        value.textContent = `${String(hoursRaw % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} `;
        value.append(period);

        card.append(title, value);
        els.timingsGrid.append(card);
      });
    }


    function tickCountdown() {
      if (!timings || !els.countdownTimer) return;

      const nowSeconds = secondsOfDayInZone(locationTimeZone);

      let nextPrayer = null;
      let nextSeconds = null;

      for (const prayer of COUNTDOWN_PRAYERS) {
        const minutes = parseClock(shiftedClock(timings[prayer]));
        if (minutes === null) continue;
        const seconds = minutes * MINUTES_PER_HOUR;
        if (seconds > nowSeconds) {
          nextPrayer = prayer;
          nextSeconds = seconds;
          break;
        }
      }

      if (nextPrayer === null) {
        const fajrMinutes = parseClock(shiftedClock(timings.Fajr));
        if (fajrMinutes === null) {
          if (els.nextPrayerName) els.nextPrayerName.textContent = '--';
          els.countdownTimer.textContent = '--:--:--';
          return;
        }
        nextPrayer = 'Fajr';
        nextSeconds = fajrMinutes * MINUTES_PER_HOUR + MINUTES_PER_DAY * MINUTES_PER_HOUR;
      }

      let diff = Math.max(0, Math.round(nextSeconds - nowSeconds));
      const hours = Math.floor(diff / 3600);
      diff -= hours * 3600;
      const minutes = Math.floor(diff / MINUTES_PER_HOUR);
      const seconds = diff - minutes * MINUTES_PER_HOUR;

      els.timingsGrid.querySelectorAll('.prayer-time-card').forEach((c) => c.classList.remove('active'));
      const activeCard = document.getElementById(`card-${nextPrayer}`);
      if (activeCard) activeCard.classList.add('active');

      if (els.nextPrayerName) els.nextPrayerName.textContent = PRAYER_NAMES_AR[nextPrayer];
      els.countdownTimer.textContent = [hours, minutes, seconds]
        .map((n) => String(n).padStart(2, '0'))
        .join(':');
    }

    function restartCountdown() {
      if (countdownInterval) clearInterval(countdownInterval);
      tickCountdown();
      countdownInterval = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        tickCountdown();
      }, 1000);
    }

    function todayKeyInLocationZone() {
      if (!current) return null;
      try {
        return window.PrayerCalc.civilDateInZone(
          current.timeZone || window.PrayerCalc.deviceZone() || 'UTC',
          new Date()
        ).key;
      } catch (e) {
        return null;
      }
    }

    function ensureTodayTimes() {
      if (!current || !computedDateKey) return;
      const today = todayKeyInLocationZone();
      if (today && today !== computedDateKey) applyLocation(current);
    }


    function upcomingIslamicEvents() {
      const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric',
        month: 'numeric',
        timeZone: 'UTC'
      });

      const today = window.PrayerCalc.civilDateInZone(
        current && current.timeZone ? current.timeZone : window.PrayerCalc.deviceZone() || 'UTC',
        new Date()
      );
      const startUtc = Date.UTC(today.year, today.month - 1, today.day, 12);
      const pending = ISLAMIC_EVENTS.map((event) => ({ ...event, daysLeft: null }));

      for (let day = 0; day <= 384 && pending.some((e) => e.daysLeft === null); day++) {
        const parts = formatter.formatToParts(new Date(startUtc + day * DAY_MS));
        const month = Number(parts.find((p) => p.type === 'month').value);
        const dom = Number(parts.find((p) => p.type === 'day').value);
        pending.forEach((event) => {
          if (event.daysLeft === null && event.m === month && event.d === dom) event.daysLeft = day;
        });
      }

      return pending
        .filter((event) => event.daysLeft !== null)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 3);
    }

    function renderEvents() {
      if (!els.eventsList) return;
      els.eventsList.innerHTML = '';

      let events;
      try {
        events = upcomingIslamicEvents();
      } catch (e) {
        const note = document.createElement('div');
        note.className = 'prayer-event-row';
        note.textContent = 'تقويم المناسبات غير مدعوم في هذا المتصفح.';
        els.eventsList.appendChild(note);
        return;
      }

      events.forEach((event) => {
        let timeText;
        if (event.daysLeft === 0) timeText = 'اليوم!';
        else if (event.daysLeft === 1) timeText = 'غداً';
        else timeText = `بعد ${event.daysLeft} يوم`;

        const row = document.createElement('div');
        row.className = 'prayer-event-row';

        const name = document.createElement('span');
        name.className = 'prayer-event-name';
        name.textContent = event.name;

        const badge = document.createElement('span');
        badge.className = event.daysLeft <= 1 ? 'prayer-event-badge is-soon' : 'prayer-event-badge';
        badge.textContent = timeText;

        row.append(name, badge);
        els.eventsList.appendChild(row);
      });
    }

    function renderHijri() {
      if (!current) return;
      const hijri = window.PrayerCalc.hijriDate(new Date(), current.timeZone, current.utcOffsetMinutes);
      if (els.hijriDay) els.hijriDay.textContent = hijri.day;
      if (els.hijriMonthYear) {
        els.hijriMonthYear.textContent = `${hijri.monthAr} ${hijri.year} هـ`;
        els.hijriMonthYear.title =
          hijri.source === 'umalqura'
            ? 'تقويم أم القرى'
            : 'حساب تقويمي تقريبي: أم القرى غير مدعومة في هذا المتصفح';
      }
      renderEvents();
    }


    function needsCompassPermission() {
      return typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function';
    }

    function qiblaBearingText() {
      return qiblaDegrees === null ? '' : `اتجاه الكعبة ${Math.round(qiblaDegrees)}° من الشمال.`;
    }

    const COMPASS_MESSAGES = {
      initializing: () => 'تهيئة البوصلة…',
      waiting: () => 'في انتظار إشارة البوصلة…',
      active: () => 'البوصلة تعمل الآن. اتجاه الكعبة مشار إليه بالسهم الذهبي.',
      permissionRequired: () => 'البوصلة تحتاج إذن مستشعر الاتجاه في هذا المتصفح. المس بطاقة البوصلة للسماح باستخدامه.',
      permissionDenied: () => `رُفض إذن المستشعر. افتح إعدادات هذا الموقع في متصفحك وامنح الإذن للمستشعرات، ثم أعد تحميل الصفحة. ${qiblaBearingText()}`,
      unsupported: () => `متصفحك أو جهازك لا يوفّر مستشعر اتجاه. ${qiblaBearingText()}`,
      noSignal: () => `لم تصل قراءة من مستشعر الاتجاه بعد: حرّك هاتفك على شكل ثمانيّة لتسحيحه. ${qiblaBearingText()}`,
      invalid: () => `قراءات جهازك تصل بلا مرجع إلى الشمال: حرّك هاتفك على شكل ثمانيّة، وإن استمرّ فبوصلتك غير متاحة. ${qiblaBearingText()}`,
      insecure: () => `المتصفح يحجب مستشعر الاتجاه لأن الصفحة غير مؤمَّنة: افتحها على https لتعمل البوصلة. ${qiblaBearingText()}`
    };

    // زاوية الواجهة عن وضعها الطبيعي: من دونها تقفز البوصلة بين الطولي والعرضي
    function screenOrientationAngle() {
      const orientation = window.screen && window.screen.orientation;
      if (orientation && Number.isFinite(orientation.angle)) return orientation.angle;
      if (Number.isFinite(window.orientation)) return window.orientation;
      return 0;
    }

    function normalizeBearing(degrees) {
      return ((degrees % 360) + 360) % 360;
    }

    // الاتجاه من الشمال في اتجاه عقارب الساعة، أو null إن لم تكن قراءة يوثق بها
    function headingFromEvent(event) {
      if (!event) return null;
      // آيفون يعطي heading مرجوعه أعلى الواجهة، فيعوّض دوران الشاشة من نفسه
      if (Number.isFinite(event.webkitCompassHeading)) return normalizeBearing(event.webkitCompassHeading);
      if (!Number.isFinite(event.alpha)) return null;
      // قناة absolute تُوثَق بها وإن لم تُبلّغ الحدث عن نفسها؛ النسبي يعدّ من وضع ابتداء عشوائي
      const absoluteChannel = event.type === 'deviceorientationabsolute';
      if (!event.absolute && !absoluteChannel) return null;
      return normalizeBearing(360 - event.alpha + screenOrientationAngle());
    }

    function setNeedleHeading(heading) {
      if (!els.compassNeedle || qiblaDegrees === null) return;
      const desired = normalizeBearing(qiblaDegrees - heading);
      const current = normalizeBearing(needleRotation);
      // أقصر مسار: من 359° إلى 1° درجتان لا ثلاثمائة وخمس وسبعون
      const step = ((desired - current + 540) % 360) - 180;
      if (Math.abs(step) < COMPASS_MIN_MOVE_DEG) return;
      needleRotation += step;
      els.compassNeedle.style.transform = `rotate(${needleRotation}deg)`;
    }

    function reportCompass(state) {
      compassState = state;
      if (els.compassCard) els.compassCard.dataset.compass = state;
      if (els.compassStatus && COMPASS_MESSAGES[state]) {
        els.compassStatus.textContent = COMPASS_MESSAGES[state]();
      }
    }

    function handleOrientation(event) {
      if (event && (Number.isFinite(event.webkitCompassHeading) || Number.isFinite(event.alpha))) {
        compassAlphaSeen += 1;
      }
      const heading = headingFromEvent(event);
      if (heading === null) return;
      compassNorthSeen = true;
      setNeedleHeading(heading);
      if (compassState !== 'active') reportCompass('active');
    }

    function attachCompassSensors() {
      // مستمعات مُقتفَّاة مرة واحدة: المدينة تتبدّل والتثبيت لا يتكرر خلفها
      if (compassListener) return;
      if (typeof DeviceOrientationEvent === 'undefined') {
        reportCompass('unsupported');
        return;
      }
      // القناتان معاً: آيفون وأشباهه لا يعرفون absolute، وبعض أندرويد لا يطلق سواها.
      // القراءة النسبية تُرفض في headingFromEvent، فلا ازدواج في الحساب.
      const names = 'ondeviceorientationabsolute' in window
        ? ['deviceorientationabsolute', 'deviceorientation']
        : ['deviceorientation'];
      names.forEach((name) => window.addEventListener(name, handleOrientation, true));
      compassListener = { names };
      compassAlphaSeen = 0;
      compassNorthSeen = false;
      disarmCompassCardControl();
      reportCompass('waiting');

      clearTimeout(compassQuietTimer);
      compassQuietTimer = setTimeout(() => {
        if (compassNorthSeen) return;
        // عيب في جهاز المستخدم لا قرار منه: لا نصفّ الصمت أو النسبي مرفوضاً
        reportCompass(compassAlphaSeen > 0 ? 'invalid' : 'noSignal');
      }, COMPASS_QUIET_MS);
    }

    function detachCompassSensors() {
      if (!compassListener) return;
      compassListener.names.forEach((name) => window.removeEventListener(name, handleOrientation, true));
      compassListener = null;
      clearTimeout(compassQuietTimer);
      compassQuietTimer = null;
    }

    // البطاقة نفسها سطح الطلب: تصير قابلة للتركيز والضغط حين يكون الإذن معلّقاً فقط
    function armCompassCardControl() {
      if (!els.compassCard || els.compassCard.dataset.compassControl === 'on') return;
      els.compassCard.dataset.compassControl = 'on';
      els.compassCard.setAttribute('role', 'button');
      els.compassCard.setAttribute('tabindex', '0');
    }

    function disarmCompassCardControl() {
      if (!els.compassCard || els.compassCard.dataset.compassControl !== 'on') return;
      delete els.compassCard.dataset.compassControl;
      els.compassCard.removeAttribute('role');
      els.compassCard.removeAttribute('tabindex');
    }

    // تُنادى داخل معالج حدث موثوق وحده: لا تُستدعى مراراً في عمر الصفحة
    function requestCompassPermission() {
      if (compassPermissionAsked) return;
      compassPermissionAsked = true;
      reportCompass('initializing');

      let request = null;
      try {
        request = DeviceOrientationEvent.requestPermission();
      } catch (error) {
        compassPermissionAsked = false;
        reportCompass('permissionRequired');
        window.App.showToast('تعذّر طلب إذن البوصلة.');
        return;
      }

      Promise.resolve(request).then((state) => {
        if (state === 'granted') {
          compassPermissionGranted = true;
          attachCompassSensors();
          return;
        }
        if (state === 'denied') {
          reportCompass('permissionDenied');
          window.App.showToast('تم رفض إذن مستشعرات البوصلة.');
          return;
        }
        // 'prompt' ومن يماثله: لم يُصوَّت بعد، فالبطاقة ما تزال سطح الطلب
        compassPermissionAsked = false;
        reportCompass('permissionRequired');
      }).catch(() => {
        // خطأ الاستدعاء من المتصفح لا قرار للمستخدم: لا يُنسب إليه الرفض
        compassPermissionAsked = false;
        reportCompass('permissionRequired');
        armCompassCardControl();
        window.App.showToast('تعذّر طلب إذن البوصلة.');
      });
    }

    function onCompassCardActivate(event) {
      // Enter وحده لوحة المفاتيح: المسافة تمرّر الصفحة ولها سلوك عام آخر
      if (event.type === 'keydown' && event.key !== 'Enter') return;
      if (compassState === 'permissionDenied') {
        window.App.showToast('الإذن مرفوض: افتح إعدادات هذا الموقع في متصفحك وفعّل المستشعرات.');
        return;
      }
      if (compassState !== 'permissionRequired') return;
      requestCompassPermission();
    }

    function setupCompass() {
      if (!els.compassStatus || qiblaDegrees === null) return;
      if (compassListener) return; // الموقع تبدّل: القراءة التالية تحدّث السهم بلا إعادة تهيئة

      // الأصل غير المؤمَّن (http على عنوان شبكة) يحجب المستشعرات: لا حيلة في الكود،
      // والصمت عنه يُقرأ عطلاً في البوصلة، فليكن مُسمّى
      if (window.isSecureContext === false) {
        reportCompass('insecure');
        return;
      }

      if (typeof DeviceOrientationEvent === 'undefined') {
        reportCompass('unsupported');
        return;
      }

      if (needsCompassPermission()) {
        // الإذن ممنوح في هذه الصفحة: العودة من الخلفية تُعيد المستمع بلا طلب جديد
        if (compassPermissionGranted) {
          attachCompassSensors();
          return;
        }
        if (compassState === 'permissionDenied') return;
        if (compassPermissionAsked) return;
        armCompassCardControl();
        reportCompass('permissionRequired');
        return;
      }

      attachCompassSensors();
    }


    function cityNameFromNetwork(latitude, longitude) {
      if (!navigator.onLine || typeof fetch !== 'function') return;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&accept-language=ar`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const address = data && data.address;
          if (!address || !current || current.source !== 'device') return;
          const place = address.city || address.town || address.village || address.state || address.county;
          const label = [place, address.country].filter(Boolean).join('، ');
          if (!label) return;
          current.label = label.replace('محافظة ', '').replace('مركز ', '');
          if (window.StorageManager) window.StorageManager.savePrayerLocation(current);
          renderLocationLabel();
        })
        .catch(() => {
          // ignore network errors
        })
        .finally(() => clearTimeout(timer));
    }


    // ------------------------------------------------------------------
    // ملف الحساب: المستخدم، ثم المدينة، ثم إقليم أقرب مدينة، ثم المحفوظ، ثم المعلن
    // الاستنتاج محلي بالكامل: لا رجوع جغرافي عبر الشبكة.
    // ------------------------------------------------------------------
    const EARTH_RADIUS_KM = 6371;
    // خارج هذا البُعد لا تُعدّ مدينة المنطقة الزمنية مجاورة لموقع الجهاز:
    // ساعة الجهاز قد تكون ساعة بلد المستخدم لا ساعة بلد سفره.
    const ZONE_MATCH_KM = 250;

    // ساعة الموقع من موقعه لا من ساعة الجهاز وحدها: إن كان الإحداثيان قريبين
    // من مدينة منسَّقة في منطقة أخرى (مسافر لم تُحدَّث ساعته بعد) فخذ منطقة المدينة.
    function zoneFor(record, match) {
      const near = match && match.inferred && match.city &&
        Number.isFinite(match.distanceKm) && match.distanceKm <= ZONE_MATCH_KM;

      if (near && match.city.timeZone && match.city.timeZone !== record.timeZone) {
        return {
          timeZone: match.city.timeZone,
          utcOffsetMinutesFallback: match.city.utcMinutes
        };
      }
      return {
        timeZone: record.timeZone,
        utcOffsetMinutesFallback: record.utcOffsetMinutes
      };
    }

    function locationOptions(record, zone, profile) {
      return {
        latitude: record.latitude,
        longitude: record.longitude,
        timeZone: zone.timeZone,
        utcOffsetMinutesFallback: zone.utcOffsetMinutesFallback,
        profile
      };
    }

    function distanceKm(a, b) {
      const rad = (deg) => (deg * Math.PI) / 180;
      const dLat = rad(b.latitude - a.latitude);
      const dLng = rad(b.longitude - a.longitude);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
      return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    function nearestInList(record, list) {
      let best = list[0];
      let bestKm = Infinity;
      list.forEach((city) => {
        const km = distanceKm(record, city);
        if (km < bestKm) {
          bestKm = km;
          best = city;
        }
      });
      return best ? { city: best, km: bestKm } : null;
    }

    function curatedCityFor(record) {
      if (!window.PrayerCities) return null;

      if (record.cityId) {
        const chosen = window.PrayerCities.byId(record.cityId);
        if (chosen) return { city: chosen, inferred: false };
      }

      const list = window.PrayerCities.list;
      if (!list.length) return null;

      const global = nearestInList(record, list);
      if (record.timeZone) {
        const sameZone = list.filter((c) => c.timeZone === record.timeZone);
        if (sameZone.length) {
          const byZone = nearestInList(record, sameZone);
          // منطقة الجهاز تَضبط حين يكون القرب معها: دولة واحدة أصدق من مدينة عبر حدٍّ
          if (byZone.km <= ZONE_MATCH_KM || byZone.km < global.km) {
            return { city: byZone.city, inferred: true, distanceKm: Math.round(byZone.km) };
          }
        }
      }
      return { city: global.city, inferred: true, distanceKm: Math.round(global.km) };
    }

    function resolveFor(record) {
      const match = curatedCityFor(record) || { city: null, inferred: false };
      const city = match.city;
      const region = city && window.PrayerRegions ? window.PrayerRegions.byId(city.region) : null;
      const persisted = record.profile && typeof record.profile === 'object' ? record.profile : null;

      // البيانات المُنسَّقة مرجعٌ أولاً؛ الملف المحفوظ شبكة أمان إن غابت عن المتصفح
      const resolved = window.PrayerCalc.resolveProfile({
        user: userPrefs,
        city: city && city.profile ? city.profile : null,
        region: region ? region.profile : persisted
      });

      return { ...match, region, resolved };
    }

    // ما يُحفَظ للموقع: الإعدادات الفعّالة، لا الأوقات المحسوبة
    function effectiveProfileForStorage(profile) {
      return {
        method: profile.method,
        asr: profile.asr,
        highLat: profile.highLat,
        adjust: profile.adjust
      };
    }

    // ثقة المنهج وحدها لا تكفي: إقليم بلا هيئة منشورة الزوايا يبقى غير موثَّق
    // ولو كان المنهج المستعمل موثَّقاً في ذاته، وإلا قرأ المستخدم ادّعاءً رسمياً لا أصل له.
    const CONFIDENCE_RANK = { verified: 0, secondary: 1, unverified: 2 };

    function authorityConfidence(placement) {
      const methodConfidence = placement.profile.confidence;
      if (placement.resolved.profile.source === 'user') return methodConfidence;
      const regionConfidence = placement.region ? placement.region.confidence : 'unverified';
      return CONFIDENCE_RANK[regionConfidence] > CONFIDENCE_RANK[methodConfidence]
        ? regionConfidence
        : methodConfidence;
    }

    function methodNote(profile, confidence) {
      if (confidence === 'verified') return `حسب ${profile.methodLabel}`;
      if (confidence === 'secondary') {
        return `حسب ${profile.methodLabel} (جدول مكتبي غير موثَّق عن الهيئة نفسها)`;
      }
      return `حسب ${profile.methodLabel} — لا هيئة محلية موثَّقة لموقعك، وأنت قادر على تغيير المنهج`;
    }

    function applyLocation(record) {
      const placement = resolveFor(record);

      if (!placement.resolved.valid) {
        console.warn('ملف حساب غير صالح لهذا الموقع:', placement.resolved.problems);
      }

      const zone = zoneFor(record, placement);
      const result = window.PrayerCalc.computeTimes(
        locationOptions(record, zone, placement.resolved.profile)
      );
      if (!result) {
        showBanner('إحداثيات هذا الموقع غير صالحة. اختر مدينتك من القائمة.');
        return false;
      }

      current = {
        ...record,
        timeZone: result.timeZone || record.timeZone,
        utcOffsetMinutes: result.utcOffsetMinutes,
        profile: effectiveProfileForStorage(result.profile)
      };
      activePlacement = { ...placement, profile: result.profile };
      timings = result.times;
      locationTimeZone = result.timeZone;
      computedDateKey = result.dateKey;
      qiblaDegrees = window.PrayerCalc.qiblaBearing(record.latitude, record.longitude);

      if (record.source === 'device' && window.StorageManager) {
        window.StorageManager.savePrayerLocation(current);
      }

      showDashboard();
      renderTimingsUI();
      restartCountdown();
      renderHijri();
      setupCompass();
      renderLocationLabel();
      renderLocationStatus();
      syncCitySelects();
      return true;
    }

    function renderLocationLabel() {
      if (!current || !els.cityText) return;

      if (current.source === 'manual') {
        els.cityText.textContent = current.label || 'مدينتك المختارة';
        return;
      }
      if (isFreshlyCaptured(current)) {
        els.cityText.textContent = current.label || 'موقع جهازك الآن';
        return;
      }
      els.cityText.textContent = current.label ? `${current.label} — محفوظ` : 'آخر موقع محفوظ';
    }

    function accuracyNote(record) {
      const accuracy = Number(record.accuracy);
      return Number.isFinite(accuracy) && accuracy >= 0 ? `، الدقة ±${Math.round(accuracy)} متراً` : '';
    }

    // شفافية الملف المستعمل: منهج الهيئة، وإن كان الموقع مستنتجاً، وإن استُعمل الافتراضي
    function profileNote() {
      if (!activePlacement) return '';
      const parts = [];

      if (activePlacement.inferred && activePlacement.city) {
        const near = Number.isFinite(activePlacement.distanceKm)
          ? ` (على بُعد نحو ${activePlacement.distanceKm} كم)`
          : '';
        const uncertain = activePlacement.distanceKm > 150
          ? ' — التقدير بعيد؛ اختر مدينتك إن لم يكن موقعك ضمن هذا النطاق'
          : '';
        parts.push(`موقع جهازك يُقارب ${activePlacement.city.name}${near} في الحساب${uncertain}`);
      }

      const profile = activePlacement.profile;
      if (!profile) return parts.length ? ` — ${parts.join(' — ')}` : '';

      const device = window.PrayerCalc.deviceZone();
      if (current && current.timeZone && device && current.timeZone !== device) {
        parts.push(`ساعة الحساب ${current.timeZone}، لا ساعة جهازك ${device}`);
      }

      if (activePlacement.resolved.usedFallback) {
        parts.push(`لا ملف محدد لموقعك: استُعمل ${profile.methodLabel} المعلن كافتراضي`);
      } else {
        const chosen = activePlacement.resolved.profile.source === 'user' ? ' — باختيارك' : '';
        parts.push(`${methodNote(profile, authorityConfidence(activePlacement))}${chosen}`);
      }
      const asrText = profile.asr === 'hanafi' ? 'العصر على مدرسة الحنفية' : 'العصر على مدرسة الجمهور';
      if (userPrefs && userPrefs.asr) parts.push(`${asrText} باختيارك`);
      else if (profile.asr === 'hanafi') parts.push(asrText);
      if (activePlacement.resolved.problems.length) {
        parts.push(`تنبيه في ملف الحساب: ${activePlacement.resolved.problems.join('، ')}`);
      }
      return ` — ${parts.join(' — ')}`;
    }

    function renderLocationStatus() {
      if (!current) return;

      if (els.useDeviceBtn) {
        els.useDeviceBtn.hidden = current.source !== 'manual';
      }

      if (current.source === 'manual') {
        const deviceNote = waitingForPosition
          ? 'نجرب تحديد موقع جهازك الآن.'
          : window.StorageManager && window.StorageManager.loadPrayerLocation()
            ? 'موقع جهازك متاح: اضغط «استخدم موقع جهازي» للعودة إليه.'
            : '';
        setLocationStatus(
          `المواقيت محسوبة لمدينتك المختارة${profileNote()}${deviceNote ? `. ${deviceNote}` : ''}`,
          'is-manual'
        );
        return;
      }

      if (isFreshlyCaptured(current)) {
        setLocationStatus(
          `حُسبت من موقع جهازك في هذه الزيارة${accuracyNote(current)}${profileNote()}.` +
          ' وتُعاد الحسابات محلياً كل يوم بلا إنترنت.' +
          (waitingForPosition ? ' جارٍ تحديث…' : ''),
          'is-fresh'
        );
        return;
      }

      setLocationStatus(
        `تعذّر تحديد موقعك الآن. ما تراه محسوب من آخر موقع محفوظ ${describeAge(current.acquiredAt)}${accuracyNote(current)}${profileNote()} — وهو ليس تأكيداً بموقعك الحالي. حدّث موقعك أو اختر مدينتك.`,
        'is-stale'
      );
    }
    function cityRecord(city) {
      return {
        latitude: city.latitude,
        longitude: city.longitude,
        accuracy: null,
        timeZone: city.timeZone,
        utcOffsetMinutes: city.utcMinutes,
        label: `${city.name}، ${city.country}`,
        cityId: city.id,
        source: 'manual',
        acquiredAt: new Date().toISOString()
      };
    }

    function populateCitySelect(select) {
      if (!select || !window.PrayerCities) return;
      select.innerHTML = '';

      const placeholder = document.createElement('option');
      placeholder.value = CITY_PLACEHOLDER_OPTION;
      placeholder.textContent = '— اختر مدينتك —';
      select.appendChild(placeholder);

      const auto = document.createElement('option');
      auto.value = CITY_AUTO_OPTION;
      auto.textContent = 'استخدم موقع جهازي تلقائياً';
      select.appendChild(auto);

      window.PrayerCities.grouped().forEach((group) => {
        const groupEl = document.createElement('optgroup');
        groupEl.label = group.label;
        group.cities.forEach((city) => {
          const option = document.createElement('option');
          option.value = city.id;
          option.textContent = `${city.name} — ${city.country}`;
          groupEl.appendChild(option);
        });
        select.appendChild(groupEl);
      });
    }

    function syncCitySelects() {
      if (!current) return;
      const value = current.source === 'manual' ? current.cityId : CITY_AUTO_OPTION;
      [els.citySelect, els.bannerCitySelect].forEach((select) => {
        if (!select) return;
        const known = Array.from(select.options).some((option) => option.value === value);
        select.value = known ? value : CITY_PLACEHOLDER_OPTION;
      });
    }

    // منهج الحساب ومدرسة العصر: تفضيل المستخدم يسبق المدينة والإقليم ولا تمسّه التلقائية
    function methodOptionLabel(method) {
      const isha = method.ishaInterval
        ? `عشاء بعد ${method.ishaInterval} دقيقة من المغرب`
        : `عشاء ${method.ishaAngle}°`;
      const caveat = method.confidence === 'unverified' ? ' — غير موثَّق' : '';
      return `${method.label}: فجر ${method.fajrAngle}° / ${isha}${caveat}`;
    }

    function populateMethodSelect() {
      const select = els.methodSelect;
      if (!select || !window.PrayerCalc) return;
      select.innerHTML = '';

      const auto = document.createElement('option');
      auto.value = PREF_AUTO_OPTION;
      auto.textContent = 'تلقائياً حسب مدينتك وإقليمها';
      select.appendChild(auto);

      Object.keys(window.PrayerCalc.METHODS).forEach((id) => {
        const method = window.PrayerCalc.METHODS[id];
        const option = document.createElement('option');
        option.value = id;
        option.textContent = methodOptionLabel(method);
        select.appendChild(option);
      });
    }

    function syncPrefSelects() {
      if (!window.PrayerCalc) return;
      const prefs = userPrefs || { method: null, asr: null };
      if (els.methodSelect) {
        const known = prefs.method && !!window.PrayerCalc.METHODS[prefs.method];
        els.methodSelect.value = known ? prefs.method : PREF_AUTO_OPTION;
      }
      if (els.asrSelect) {
        const known = prefs.asr === 'standard' || prefs.asr === 'hanafi';
        els.asrSelect.value = known ? prefs.asr : PREF_AUTO_OPTION;
      }
    }

    function savePrefsFromUI() {
      userPrefs = {
        method: els.methodSelect && els.methodSelect.value ? els.methodSelect.value : null,
        asr: els.asrSelect && els.asrSelect.value ? els.asrSelect.value : null
      };
      if (window.StorageManager) window.StorageManager.savePrayerPrefs(userPrefs);

      if (!current) return;
      // الملف المحفوظ أثرٌ من الحساب السابق: مع كل تفضيل يُعاد اشتقاقه من البيانات المُنسَّقة
      const record = { ...current };
      delete record.profile;
      applyLocation(record);

      const chosen = userPrefs.method
        ? window.PrayerCalc.METHODS[userPrefs.method].label
        : 'المنهج التلقائي لموقعك';
      const asrLabels = { hanafi: ' والحنفية', standard: ' والجمهور' };
      window.App.showToast(`الحساب الآن حسب ${chosen}${asrLabels[userPrefs.asr] || ''}.`);
    }

    function useDeviceLocation() {
      if (window.StorageManager) window.StorageManager.clearManualPrayerCity();
      const stored = window.StorageManager ? window.StorageManager.loadPrayerLocation() : null;
      if (stored) {
        applyLocation(stored);
        window.App.showToast('رجعنا إلى موقع جهازك المحفوظ، ونحدّثه الآن.');
      } else {
        showBanner('لا يوجد موقع محفوظ لجهازك. اضغط «تحديد موقعي الآن» أو اختر مدينتك.');
      }
      requestFreshPosition({ silent: true });
    }

    function chooseCity(cityId) {
      if (cityId === CITY_AUTO_OPTION) {
        useDeviceLocation();
        return;
      }
      const city = window.PrayerCities && window.PrayerCities.byId(cityId);
      if (!city) return;
      if (window.StorageManager) window.StorageManager.saveManualPrayerCity(city);
      applyLocation(cityRecord(city));
      window.App.showToast(`المواقيت الآن حسب ${city.name}.`);
    }


    function requestFreshPosition(options = {}) {
      if (!navigator.geolocation) {
        handlePositionFailure('unsupported', options);
        return;
      }

      setLocating(true);
      if (!options.silent) setLocationStatus('جارٍ تحديد موقع جهازك…', 'is-fresh');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocating(false);
          const coords = position.coords;
          const record = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
            timeZone: window.PrayerCalc.deviceZone(),
            // بالدقائق من ساعة الجهاز نفسها، بلا ICU: احتياطٌ لمنطقةٍ لا يفهمها المتصفح
            utcOffsetMinutes: -new Date(position.timestamp || Date.now()).getTimezoneOffset(),
            label: null,
            cityId: null,
            source: 'device',
            acquiredAt: new Date(position.timestamp || Date.now()).toISOString()
          };

          if (window.StorageManager && !window.StorageManager.savePrayerLocation(record)) {
            console.warn('Prayer location could not be persisted.');
          }

          const manualIsActive = current && current.source === 'manual';
          if (manualIsActive) {
            setLocating(false);
            renderLocationStatus();
            if (els.useDeviceBtn) els.useDeviceBtn.hidden = false;
            window.App.showToast('موقع جهازك جديد محفوظ. مدينتك المختارة ما زالت هي المعروضة.');
            return;
          }

          if (!applyLocation(record)) return;
          cityNameFromNetwork(record.latitude, record.longitude);
          if (options.silent === false) window.App.showToast('تم تحديث المواقيت حسب موقع جهازك.');
        },
        (error) => handlePositionFailure(error && error.code, options),
        {
          enableHighAccuracy: true, 
          timeout: GEO_TIMEOUT_MS,
          maximumAge: GEO_MAX_AGE_MS 
        }
      );
    }

    function handlePositionFailure(code, options) {
      setLocating(false);

      if (current && current.source === 'manual') {
        renderLocationStatus();
        window.App.showToast(positionMessage(code));
        return;
      }

      const stored = window.StorageManager ? window.StorageManager.loadPrayerLocation() : null;

      if (stored) {
        applyLocation(stored);
        window.App.showToast(positionMessage(code));
        return;
      }

      showBanner(positionMessage(code));
      setLocationStatus('اختر مدينتك من القائمة أو اسمح بالوصول إلى الموقع.', 'is-stale');
    }

    function positionMessage(code) {
      const PERMISSION_DENIED = 1;
      const POSITION_UNAVAILABLE = 2;
      const TIMEOUT = 3;
      const numeric = Number(code);

      if (code === 'unsupported') return 'متصفحك لا يدعم تحديد الموقع الجغرافي؛ اختر مدينتك يدوياً.';
      if (numeric === PERMISSION_DENIED) return 'تم رفض إذن الموقع. فعّله من إعدادات المتصفح، أو اختر مدينتك من القائمة.';
      if (numeric === TIMEOUT) return 'انتهت مهلة تحديد الموقع. جرّب في مكان مفتوح، أو اختر مدينتك.';
      if (numeric === POSITION_UNAVAILABLE) return 'تعذّر الحصول على موقع الآن: قد يكون مفتاح الموقع مطفأً أو الإشارة ضعيفة.';
      return 'تعذّر تحديد موقعك الحالي؛ يمكنك اختيار مدينتك يدوياً.';
    }


    function boot() {
      setOffsetDisplay();
      populateCitySelect(els.citySelect);
      populateCitySelect(els.bannerCitySelect);
      populateMethodSelect();
      if (window.StorageManager) userPrefs = window.StorageManager.loadPrayerPrefs();
      syncPrefSelects();

      const stored = window.StorageManager ? window.StorageManager.loadPrayerLocation() : null;
      const manualCity = window.StorageManager ? window.StorageManager.loadManualPrayerCity() : null;

      let initial = null;
      if (manualCity && window.PrayerCities) {
        const city = window.PrayerCities.byId(manualCity.id);
        if (city) initial = cityRecord(city);
      }
      if (!initial && stored) initial = stored;

      if (initial) {
        applyLocation(initial);
      } else {
        showBanner('جارٍ تحديد موقعك…');
        setLocationStatus('لم نحصل على موقع بعد: نطلب إذن الموقع الآن، وإن رفضته فاختر مدينتك — تعمل المواقيت محلياً بلا إنترنت.', 'is-stale');
      }

      requestFreshPosition({ silent: true });

      rolloverInterval = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        ensureTodayTimes();
      }, ROLLOVER_CHECK_MS);
    }

    function adjustOffset(change) {
      offsetMinutes += change;
      if (window.StorageManager) window.StorageManager.savePrayerOffset(offsetMinutes);
      setOffsetDisplay();
      if (timings) {
        renderTimingsUI();
        restartCountdown();
      }
    }

    els.initBtn.addEventListener('click', () => {
      clearError();
      requestFreshPosition({ silent: false });
    });

    if (els.refreshLocationBtn) {
      els.refreshLocationBtn.addEventListener('click', () => requestFreshPosition({ silent: false }));
    }

    if (els.useDeviceBtn) {
      els.useDeviceBtn.addEventListener('click', useDeviceLocation);
    }

    [els.citySelect, els.bannerCitySelect].forEach((select) => {
      if (!select) return;
      select.addEventListener('change', (event) => {
        const value = event.target.value;
        if (value === CITY_PLACEHOLDER_OPTION || !value) return;
        chooseCity(value);
      });
    });

    [els.methodSelect, els.asrSelect].forEach((select) => {
      if (!select) return;
      select.addEventListener('change', savePrefsFromUI);
    });

    if (els.settingsBtn && els.offsetPanel) {
      els.settingsBtn.addEventListener('click', () => {
        els.offsetPanel.hidden = !els.offsetPanel.hidden;
      });
    }

    if (els.offsetPlusBtn) els.offsetPlusBtn.addEventListener('click', () => adjustOffset(1));
    if (els.offsetMinusBtn) els.offsetMinusBtn.addEventListener('click', () => adjustOffset(-1));
    if (els.compassCard) {
      els.compassCard.addEventListener('click', onCompassCardActivate);
      els.compassCard.addEventListener('keydown', onCompassCardActivate);
    }
    // الهاتف يُطلق pagehide عند تغطية الشاشة أو تبديل التطبيق: بلا pageshow تبقى البوصلة ميتة
    window.addEventListener('pagehide', detachCompassSensors);
    window.addEventListener('pageshow', setupCompass);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      tickCountdown();
      ensureTodayTimes();
    });

    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrayerPage, { once: true });
  } else {
    initPrayerPage();
  }
})();
