/**
 * منصة البيان — محرك حساب المواقيت المحلي
 *
 * كل حسابات المواقيت والقبلة والتاريخ الهجري تُنفَّذ هنا داخل المتصفح.
 * لا طلب شبكة ولا خدمة خارجية: الصفحة تعمل بلا إنترنت، والمواقيت
 * تُحسب لتاريخ اليوم نفسه فلا تُورَث مواقيت الأمس.
 *
 * المراجع الحسابية: موضع الشمس من (Julian date) بمعاملات NOAA/PrayTimes،
 * وزاوية الساعتها، ثم تحويلها بساعة المنطقة الزمنية للموقع نفسها.
 *
 * كل موقع يُحسب بمنهجه: ملف حساب (زوايا الفجر والعشاء، أو فترة العشاء،
 * وقاعدة المغرب، ومدرسة العصر، وقاعدة خطوط العرض العالية، وتعديلات
 * الدقائق) يُقرأ من بيانات المدينة أو الإقليم، ولا يُفرض منهج قطر واحد
 * على العالم. الأرقام مأخوذة من جدول Methods المعتمد لدى aladhan/PrayTimes
 * عن الهيئات المذكورة لكل منهج، وتُستعمل عند التحقق من التوقيت المحلي.
 */
(() => {
  'use strict';

  const DEG = Math.PI / 180;

  const sin = (d) => Math.sin(d * DEG);
  const cos = (d) => Math.cos(d * DEG);
  const tan = (d) => Math.tan(d * DEG);
  const asin = (x) => Math.asin(x) / DEG;
  const acos = (x) => Math.acos(x) / DEG;
  const atan = (x) => Math.atan(x) / DEG;
  const atan2d = (y, x) => Math.atan2(y, x) / DEG;
  // ظل الزاوية العكسي: قيمته بين 0 و180 درجة
  const acot = (x) => atan2d(1, x);

  const fixAngle = (a) => ((a % 360) + 360) % 360;
  const fixHour = (h) => ((h % 24) + 24) % 24;

  const SUNRISE_SET_ALTITUDE = -0.833; // نصف قطر الشمس ظاهرياً + الانكسار الجوي
  const KAABA = { latitude: 21.4224779, longitude: 39.8257794 };

  const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // مدارس العصر: ظل المثل، أو ظل المثلين (حنفي)
  const ASR_SCHOOLS = { standard: 1, hanafi: 2 };

  // قواعد خطوط العرض العالية حين لا تبلغ الشمس الارتفاع المطلوب:
  //   none        لا تُطبق: يبقى الوقت null
  //   angleBased  قسمة الليل بالزاوية: N × (الزاوية/60)
  //   oneSeventh  سُبع الليل
  //   nightMiddle نصف الليل
  const HIGH_LAT_RULES = ['none', 'angleBased', 'oneSeventh', 'nightMiddle'];

  // المنهج المعروض حين لا ملف للمدينة ولا للإقليم: معلن، لا ضمني
  const FALLBACK_METHOD = 'mwl';

  // مصطلحات التوقيت المعتمدة. الأرقام من جدول الهيئات نفسه، لا من اختبار يوم واحد.
  // confidence: verified = منشور عن الهيئة، secondary = جدول مكتبي متداول،
  //             unverified = لا هيئة موثقة خلفه (يُعرض على المستخدم قابلاً للتغيير)
  const METHODS = {
    egypt: {
      label: 'الهيئة المصرية العامة للمساحة', aladhanId: 5,
      fajrAngle: 19.5, ishaAngle: 17.5, confidence: 'verified'
    },
    ummAlQura: {
      label: 'جامعة أم القرى — مكة المكرمة', aladhanId: 4,
      fajrAngle: 18.5, ishaInterval: 90, confidence: 'verified'
    },
    mwl: {
      label: 'رابطة العالم الإسلامي', aladhanId: 3,
      fajrAngle: 18, ishaAngle: 17, confidence: 'verified'
    },
    karachi: {
      label: 'جامعة العلوم الإسلامية — كراتشي', aladhanId: 1,
      fajrAngle: 18, ishaAngle: 18, confidence: 'secondary'
    },
    isna: {
      label: 'الجمعية الإسلامية لأمريكا الشمالية', aladhanId: 2,
      fajrAngle: 15, ishaAngle: 15, confidence: 'verified'
    },
    tehran: {
      label: 'معهد الجيوفيزياء — جامعة طهران', aladhanId: 7,
      fajrAngle: 17.7, ishaAngle: 14, maghribArc: 4.5, confidence: 'secondary'
    },
    diyanet: {
      label: 'رئاسة الشؤون الدينية التركية', aladhanId: 13,
      fajrAngle: 18, ishaAngle: 17, confidence: 'verified',
      // تمكين منشور عن الهيئة نفسها (vakithesaplama.diyanet.gov.tr/temkin.php):
      // سبع دقائق على الشروق والمغرب، خمس على الظهر، أربع على العصر، ولا شيء على الفجر والعشاء
      adjust: { Sunrise: -7, Dhuhr: 5, Asr: 4, Maghrib: 7 }
    },
    morocco: {
      label: 'وزارة الأوقاف والشؤون الإسلامية — المغرب', aladhanId: 21,
      fajrAngle: 19, ishaAngle: 17, confidence: 'secondary'
    },
    algeria: {
      label: 'وزارة الشؤون الدينية — الجزائر', aladhanId: 19,
      fajrAngle: 18, ishaAngle: 17, confidence: 'secondary'
    },
    tunisia: {
      label: 'لجنة المواقيت — وزارة الشؤون الدينية بتونس', aladhanId: 18,
      fajrAngle: 18, ishaAngle: 18, confidence: 'secondary'
    },
    jordan: {
      label: 'دائرة الإفتاء والأوقاف الأردنية', aladhanId: 23,
      fajrAngle: 18, ishaAngle: 18, maghribMinutes: 5, confidence: 'secondary'
    },
    kuwait: {
      label: 'وزارة الأوقاف — الكويت', aladhanId: 9,
      fajrAngle: 18, ishaAngle: 17.5, confidence: 'secondary'
    },
    qatar: {
      label: 'وزارة الأوقاف — قطر', aladhanId: 10,
      fajrAngle: 18, ishaInterval: 90, confidence: 'secondary'
    },
    gulf: {
      label: 'الهيئة العامة للشؤون الإسلامية — دول الخليج', aladhanId: 8,
      fajrAngle: 19.5, ishaInterval: 90, confidence: 'secondary'
    },
    dubai: {
      label: 'دائرة الشؤون الإسلامية — دبي (تجريبي)', aladhanId: 16,
      fajrAngle: 18.2, ishaAngle: 18.2, confidence: 'unverified'
    },
    malaysia: {
      label: 'JAKIM — ماليزيا', aladhanId: 17,
      fajrAngle: 20, ishaAngle: 18, confidence: 'secondary'
    },
    singapore: {
      label: 'MUIS — سنغافورة', aladhanId: 11,
      fajrAngle: 20, ishaAngle: 18, confidence: 'secondary'
    },
    indonesia: {
      label: 'Kemenag — إندونيسيا', aladhanId: 20,
      fajrAngle: 20, ishaAngle: 18, confidence: 'secondary'
    },
    russia: {
      label: 'الإدارة الدينية لمسلمي روسيا', aladhanId: 14,
      fajrAngle: 16, ishaAngle: 15, confidence: 'secondary'
    },
    france: {
      label: 'اتحاد المنظمات الإسلامية في فرنسا', aladhanId: 12,
      fajrAngle: 12, ishaAngle: 12, confidence: 'secondary'
    }
  };

  const zeroAdjust = () => PRAYER_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});

  // ------------------------------------------------------------------
  // ملف الحساب: تطبيع وتحقّق. لا يُقبل رقم خارج مداه الصريح.
  // ------------------------------------------------------------------
  function normalizeProfile(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    const problems = [];

    const methodId = METHODS[input.method] ? input.method : null;
    if (!methodId) problems.push(`منهج غير معروف: ${String(input.method)}`);
    const method = METHODS[methodId] || METHODS[FALLBACK_METHOD];

    const pickNumber = (key, fallback) => {
      const value = input[key];
      if (value === undefined || value === null || value === '') return fallback;
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const fajrAngle = pickNumber('fajrAngle', method.fajrAngle);
    if (!(fajrAngle > 0 && fajrAngle <= 25)) problems.push(`زاوية الفجر خارج المدى: ${fajrAngle}`);

    const ishaInterval = pickNumber('ishaInterval', method.ishaInterval ?? null);
    if (ishaInterval !== null && !(ishaInterval >= 0 && ishaInterval <= 240)) {
      problems.push(`فترة العشاء خارج المدى: ${ishaInterval}`);
    }

    // إن كانت العشاء بفترة فلا زاوية لها: لا يُختلط معيار على الآخر
    const ishaAngle = ishaInterval === null ? pickNumber('ishaAngle', method.ishaAngle ?? null) : null;
    if (ishaAngle === null && ishaInterval === null) problems.push('العشاء بلا زاوية وبلا فترة');
    if (ishaAngle !== null && !(ishaAngle > 0 && ishaAngle <= 25)) {
      problems.push(`زاوية العشاء خارج المدى: ${ishaAngle}`);
    }

    const maghribArc = pickNumber('maghribArc', method.maghribArc ?? null);
    if (maghribArc !== null && !(maghribArc > 0 && maghribArc <= 15)) {
      problems.push(`قوس المغرب خارج المدى: ${maghribArc}`);
    }

    const maghribMinutes = pickNumber('maghribMinutes', method.maghribMinutes ?? 0);
    if (Math.abs(maghribMinutes) > 30) problems.push(`تعديل دقائق المغرب خارج المدى: ${maghribMinutes}`);

    const asr = ASR_SCHOOLS[input.asr] ? input.asr : 'standard';
    const asrFactor = ASR_SCHOOLS[asr];

    const highLat = HIGH_LAT_RULES.includes(input.highLat) ? input.highLat : 'angleBased';

    const adjust = zeroAdjust();
    // دقائق الهيئة المنشورة عن نفسها (تمكين ديانت) أساسٌ، وتعديل المدينة أو المستخدم فوقه
    const baseAdjust = method.adjust && typeof method.adjust === 'object' ? method.adjust : {};
    const givenAdjust = input.adjust && typeof input.adjust === 'object' ? input.adjust : {};
    const rawAdjust = { ...baseAdjust, ...givenAdjust };
    for (const key of PRAYER_KEYS) {
      const value = Number(rawAdjust[key]);
      if (Number.isFinite(value)) {
        if (Math.abs(value) > 60) problems.push(`تعديل ${key} خارج المدى: ${value}`);
        else adjust[key] = Math.round(value);
      }
    }

    return {
      profile: {
        method: methodId || FALLBACK_METHOD,
        methodLabel: method.label,
        confidence: method.confidence,
        fajrAngle,
        ishaAngle,
        ishaInterval,
        maghribArc,
        maghribMinutes,
        asr,
        asrFactor,
        highLat,
        adjust
      },
      problems,
      valid: methodId !== null && problems.length === 0
    };
  }

  // ------------------------------------------------------------------
  // أولوية الملف: تفضيل المستخدم، ثم المدينة، ثم الإقليم، ثم المتعارف المعلن
  // ------------------------------------------------------------------
  function resolveProfile({ user, city, region } = {}) {
    const pick = (key) => {
      if (user && user[key] !== undefined && user[key] !== null && user[key] !== '') {
        return { value: user[key], from: 'user' };
      }
      if (city && city[key] !== undefined && city[key] !== null) return { value: city[key], from: 'city' };
      if (region && region[key] !== undefined && region[key] !== null) return { value: region[key], from: 'region' };
      return { value: undefined, from: 'fallback' };
    };

    const methodPick = pick('method');
    const asrPick = pick('asr');
    const highLatPick = pick('highLat');
    const adjustPick = pick('adjust');

    const source = methodPick.from === 'fallback' ? 'fallback' : methodPick.from;

    const raw = {
      method: methodPick.value || FALLBACK_METHOD,
      asr: asrPick.value,
      highLat: highLatPick.value,
      adjust: adjustPick.value
    };

    // المدينة قد تخصص زاوية دون تغيير اسم المنهج (ضبط هيئة محلية)
    if (city && city.fajrAngle !== undefined) raw.fajrAngle = city.fajrAngle;
    if (city && city.ishaAngle !== undefined) raw.ishaAngle = city.ishaAngle;
    if (city && city.ishaInterval !== undefined) raw.ishaInterval = city.ishaInterval;

    const normalized = normalizeProfile(raw);

    return {
      ...normalized,
      profile: { ...normalized.profile, source },
      usedFallback: source === 'fallback'
    };
  }

  // ------------------------------------------------------------------
  // التقويم اليولياني
  // ------------------------------------------------------------------
  function toJulianDay(year, month, day) {
    let y = year;
    let m = month;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const a = Math.floor(y / 100);
    const b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
  }

  // ------------------------------------------------------------------
  // موضع الشمس: الميل وإقان الوقت
  // ------------------------------------------------------------------
  function sunPosition(julianDay) {
    const d = julianDay - 2451545.0;
    const meanAnomaly = fixAngle(357.529 + 0.98560028 * d);
    const meanLongitude = fixAngle(280.459 + 0.98564736 * d);
    const eclipticLongitude = fixAngle(
      meanLongitude + 1.915 * sin(meanAnomaly) + 0.020 * sin(2 * meanAnomaly)
    );
    const obliquity = 23.439 - 0.00000036 * d;

    const rightAscension =
      atan2d(cos(obliquity) * sin(eclipticLongitude), cos(eclipticLongitude)) / 15;
    const equationOfTime = meanLongitude / 15 - fixHour(rightAscension);
    const declination = asin(sin(obliquity) * sin(eclipticLongitude));

    return { declination, equationOfTime };
  }

  // نصف قوس الشمس بالدرجات لارتفاع معين؛ null إن لم تبلغه الشمس أبداً
  function hourAngle(altitude, latitude, declination) {
    const value =
      (sin(altitude) - sin(latitude) * sin(declination)) / (cos(declination) * cos(latitude));
    if (value > 1 || value < -1) return null;
    return acos(value);
  }

  // ------------------------------------------------------------------
  // الساعة الزمنية للمنطقة: إزاحة حقيقية بالتوقيت الصيفي إن وُجد
  // ------------------------------------------------------------------
  function zoneParts(timeZone, instant, options) {
    const formatter = new Intl.DateTimeFormat('en-u-nu-latn', {
      timeZone,
      hourCycle: 'h23',
      ...options
    });
    const map = {};
    formatter.formatToParts(instant).forEach((part) => {
      if (part.type !== 'literal') map[part.type] = part.value;
    });
    return map;
  }

  function zoneOffsetMinutes(timeZone, instant) {
    const p = zoneParts(timeZone, instant, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const asIfUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second)
    );
    // بالدقائق لا بالساعات: +05:30 و+05:45 و+03:30 وأنصاف الساعات السالبة
    return Math.round((asIfUtc - instant.getTime()) / 60000);
  }

  // التاريخ الميلادي كما يراه سكان المنطقة نفسها، لا بتوقيت الجهاز
  function civilDateInZone(timeZone, instant) {
    const p = zoneParts(timeZone, instant, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return {
      year: Number(p.year),
      month: Number(p.month),
      day: Number(p.day),
      key: `${p.year}-${p.month}-${p.day}`
    };
  }

  function zoneIsUsable(timeZone) {
    if (typeof timeZone !== 'string' || !timeZone) return false;
    try {
      new Intl.DateTimeFormat('en', { timeZone });
      return true;
    } catch (e) {
      return false;
    }
  }

  const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || null;

  const pad2 = (n) => String(n).padStart(2, '0');

  function civilFromShiftedUtc(instant, offsetMinutes) {
    const shifted = new Date(instant.getTime() + offsetMinutes * 60000);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth() + 1;
    const day = shifted.getUTCDate();
    return { year, month, day, key: `${year}-${pad2(month)}-${pad2(day)}` };
  }

  // تاريخ اليوم وإزاحته بالدقائق في منطقة الموقع، بمراتب واضحة:
  //  1) المنطقة IANA للموقع، والإزاحة من ذلك اليوم نفسه فيدخل الصيفي صحيحاً.
  //  2) إزاحة المدينة المحفوظة بالدقائق، إن جهل المتصفحُ اسم المنطقة.
  //  3) ساعة الجهاز، آخر ملاذٍ وهي معروضة المصدر لا متستّرة.
  function zoneInfo(requestedTimeZone, instant, fallbackUtcMinutes) {
    if (zoneIsUsable(requestedTimeZone)) {
      const civil = civilDateInZone(requestedTimeZone, instant);
      // الإزاحة عند ظهر اليوم المحلي، لا عند ظهر UTC: تحوّلات الصيف تقع فجراً
      const rough = zoneOffsetMinutes(requestedTimeZone, instant);
      const localNoon = new Date(Date.UTC(civil.year, civil.month - 1, civil.day, 12) - rough * 60000);
      return {
        timeZone: requestedTimeZone,
        civil,
        utcOffsetMinutes: zoneOffsetMinutes(requestedTimeZone, localNoon),
        zoneSource: 'iana'
      };
    }

    const fallback = Number(fallbackUtcMinutes);
    if (Number.isFinite(fallback)) {
      return {
        timeZone: null,
        civil: civilFromShiftedUtc(instant, fallback),
        utcOffsetMinutes: fallback,
        zoneSource: 'city'
      };
    }

    const local = deviceZone();
    if (zoneIsUsable(local)) {
      return {
        timeZone: local,
        civil: civilDateInZone(local, instant),
        utcOffsetMinutes: zoneOffsetMinutes(local, instant),
        zoneSource: 'device'
      };
    }

    return {
      timeZone: null,
      civil: civilFromShiftedUtc(instant, 0),
      utcOffsetMinutes: 0,
      zoneSource: 'utc'
    };
  }

  // ------------------------------------------------------------------
  // تنسيق ساعة الموقع
  // ------------------------------------------------------------------
  function toClock(hours) {
    if (typeof hours !== 'number' || !Number.isFinite(hours)) return null;
    let total = Math.round(fixHour(hours) * 60);
    if (total >= 1440) total -= 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------------
  // حساب المواقيت ليوم بعينه
  // ------------------------------------------------------------------
  // الخيارات: latitude, longitude, timeZone, date, profile, utcOffsetMinutesFallback
  // النتيجة: { times, profile, timeZone, utcOffsetMinutes, zoneSource, dateKey }
  function computeTimes(options = {}) {
    const latitude = Number(options.latitude);
    const longitude = Number(options.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

    // الملف قرار المُستدعي: لا يُخفى المحرك منهجاً حين لا يُعطى واحداً
    const profile = options.profile;
    if (!profile || !METHODS[profile.method]) return null;

    const instant = options.date ? new Date(options.date) : new Date();
    if (Number.isNaN(instant.getTime())) return null;

    const zone = zoneInfo(options.timeZone, instant, options.utcOffsetMinutesFallback);
    const timeZone = zone.timeZone;
    const civil = zone.civil;
    // الإزاحة دقائق صحيحة في كل السلسلة؛ التحويل إلى ساعات هنا وحده
    const utcOffsetMinutes = zone.utcOffsetMinutes;
    const offsetHours = utcOffsetMinutes / 60;

    // اليوم اليولياني عند خط طول الموقع: مرجع حساب موضع الشمس
    const julianBase = toJulianDay(civil.year, civil.month, civil.day) - longitude / (15 * 24);
    const sunAt = (clockHour, dayOffset = 0) =>
      sunPosition(julianBase + dayOffset + fixHour(clockHour) / 24);

    const dhuhrFrom = (estimate, dayOffset = 0) => {
      const { equationOfTime } = sunAt(estimate, dayOffset);
      return fixHour(12 - equationOfTime) + offsetHours - longitude / 15;
    };

    // زاوية ارتفاع الشمس عند العصر: cot(A) = factor + tan|φ − δ|
    const asrAltitude = (estimate) => {
      const { declination } = sunAt(estimate);
      return acot(profile.asrFactor + tan(Math.abs(latitude - declination)));
    };

    // وقت يُحسب لارتفاع معيّن؛ تكراران على التقدير يكفيان لدقة أقل من دقيقة
    const timeForAltitude = (altitude, estimate, beforeNoon, dayOffset = 0) => {
      let clock = estimate;
      for (let i = 0; i < 2; i++) {
        const { declination } = sunAt(clock, dayOffset);
        const dhuhr = dhuhrFrom(clock, dayOffset);
        const angle = hourAngle(altitude, latitude, declination);
        if (angle === null) return null;
        clock = beforeNoon ? dhuhr - angle / 15 : dhuhr + angle / 15;
      }
      const { declination } = sunAt(clock, dayOffset);
      const angle = hourAngle(altitude, latitude, declination);
      return angle === null ? null : clock;
    };

    const dhuhr = dhuhrFrom(12);
    const sunrise = timeForAltitude(SUNRISE_SET_ALTITUDE, 6, true);
    const sunset = timeForAltitude(SUNRISE_SET_ALTITUDE, 18, false);
    const tomorrowSunrise = timeForAltitude(SUNRISE_SET_ALTITUDE, 6, true, 1);

    // المغرب: الغروب، أو قوسٌ محدد تحت الأفق (طهران/قم)، أو دقائق بعده (الأردن)
    let maghrib = null;
    if (profile.maghribArc !== null && profile.maghribArc !== undefined) {
      maghrib = timeForAltitude(-profile.maghribArc, 18.5, false);
    }
    if (maghrib === null) maghrib = sunset;
    if (maghrib !== null && profile.maghribMinutes) maghrib += profile.maghribMinutes / 60;

    // الليل من غروب اليوم إلى شروق الغد، لا 24 ناقصاً نهار اليوم: أدق عند الخطوط العالية
    let nightHours = 12;
    if (sunset !== null && tomorrowSunrise !== null) {
      nightHours = fixHour(tomorrowSunrise + 24 - sunset);
    }

    // حدّ خطوط العرض العالية لكلٍّ من الفجر والعشاء حسب قاعدة الملف
    const nightLimit = (angle, anchor, beforeAnchor) => {
      if (profile.highLat === 'none' || anchor === null) return null;
      const portion =
        profile.highLat === 'oneSeventh' ? nightHours / 7
        : profile.highLat === 'nightMiddle' ? nightHours / 2
        : nightHours * (angle / 60);
      return beforeAnchor ? anchor - portion : anchor + portion;
    };

    // حدّ خطوط العرض العالية: الفجر لا يسبق قسطه من الليل، والعشاء لا يتأخر عنه.
    // إن بلغتهما الشمس فعلاً، فالوقت الحقيقي هو المرجع ولا يُبدَّل بالقسط.
    let fajr = timeForAltitude(-profile.fajrAngle, 5, true);
    if (profile.highLat !== 'none') {
      const limit = nightLimit(profile.fajrAngle, sunrise, true);
      if (limit !== null && (fajr === null || fajr < limit)) fajr = limit;
    }

    let isha;
    if (profile.ishaInterval !== null) {
      isha = maghrib === null ? null : maghrib + profile.ishaInterval / 60;
    } else {
      isha = timeForAltitude(-profile.ishaAngle, 19, false);
      if (profile.highLat !== 'none') {
        const limit = nightLimit(profile.ishaAngle, maghrib, false);
        if (limit !== null && (isha === null || isha > limit)) isha = limit;
      }
    }

    const asr = timeForAltitude(asrAltitude(13), 13, false);

    // تعديلات الدقائق المحلية، لكل صلاة على حدة، ولا تمسّ حساباً غيرها
    const withAdjust = (hours, key) => {
      if (hours === null) return null;
      const minutes = profile.adjust && Number(profile.adjust[key]);
      return Number.isFinite(minutes) && minutes !== 0 ? hours + minutes / 60 : hours;
    };

    const times = {
      Fajr: toClock(withAdjust(fajr, 'Fajr')),
      Sunrise: toClock(withAdjust(sunrise, 'Sunrise')),
      Dhuhr: toClock(withAdjust(dhuhr, 'Dhuhr')),
      Asr: toClock(withAdjust(asr, 'Asr')),
      Maghrib: toClock(withAdjust(maghrib, 'Maghrib')),
      Isha: toClock(withAdjust(isha, 'Isha'))
    };

    return {
      times,
      profile,
      method: profile.method,
      methodLabel: profile.methodLabel,
      asr: profile.asr,
      highLat: profile.highLat,
      timeZone,
      utcOffsetMinutes,
      zoneSource: zone.zoneSource,
      dateKey: civil.key
    };
  }

  // ------------------------------------------------------------------
  // اتجاه القبلة: Bearing أولي للدائرة العظمى إلى الكعبة
  // ------------------------------------------------------------------
  function qiblaBearing(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const deltaLongitude = KAABA.longitude - lng;
    const bearing = atan2d(
      sin(deltaLongitude) * cos(KAABA.latitude),
      cos(lat) * sin(KAABA.latitude) - sin(lat) * cos(KAABA.latitude) * cos(deltaLongitude)
    );
    return fixAngle(bearing);
  }

  // ------------------------------------------------------------------
  // التاريخ الهجري: أم القرى إن دعمها المتصفح، وإلا الحساب التقويمي
  // ------------------------------------------------------------------
  const HIJRI_MONTHS_AR = [
    'محرم',
    'صفر',
    'ربيع الأول',
    'ربيع الآخر',
    'جمادى الأولى',
    'جمادى الآخرة',
    'رجب',
    'شعبان',
    'رمضان',
    'شوال',
    'ذو القعدة',
    'ذو الحجة'
  ];

  // تحويل تقويمي وجد (Kuwaiti/tabular) يُستخدم احتياطاً فقط
  function arithmeticHijri(instant) {
    const jd = Math.floor(toJulianDay(
      instant.getUTCFullYear(),
      instant.getUTCMonth() + 1,
      instant.getUTCDate()
    ) + 0.5);
    const l0 = jd - 1948440 + 10632;
    const n = Math.floor((l0 - 1) / 10631);
    let l = l0 - 10631 * n + 354;
    const j =
      Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
      Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l =
      l -
      Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
      29;
    const month = Math.floor((24 * l) / 709);
    const day = l - Math.floor((709 * month) / 24);
    const year = 30 * n + j - 30;
    return { day, month, year, monthAr: HIJRI_MONTHS_AR[Math.min(11, Math.max(0, month - 1))] };
  }

  // تاريخ الهجري لليوم الحالي في منطقة الموقع، لا في منطقة الجهاز
  function hijriDate(instant, timeZone, fallbackUtcMinutes) {
    const date = instant ? new Date(instant) : new Date();
    const zone = zoneInfo(timeZone, date, fallbackUtcMinutes);
    const civilNoon = new Date(Date.UTC(zone.civil.year, zone.civil.month - 1, zone.civil.day, 12));
    try {
      const parts = new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura-nu-latn', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).formatToParts(civilNoon);
      const pick = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value : '';
      };
      const day = Number(pick('day'));
      const year = Number(String(pick('year')).replace(/[^\d]/g, ''));
      const monthName = pick('month').replace(/\s+/g, ' ').trim();
      if (!Number.isFinite(day) || !Number.isFinite(year) || !monthName) throw new Error('bad parts');
      return { day, year, monthAr: monthName, source: 'umalqura' };
    } catch (e) {
      return { ...arithmeticHijri(civilNoon), source: 'arithmetic' };
    }
  }

  window.PrayerCalc = {
    METHODS,
    ASR_SCHOOLS,
    HIGH_LAT_RULES,
    PRAYER_KEYS,
    FALLBACK_METHOD,
    normalizeProfile,
    resolveProfile,
    computeTimes,
    qiblaBearing,
    hijriDate,
    civilDateInZone,
    zoneOffsetMinutes,
    zoneInfo,
    zoneIsUsable,
    deviceZone: () => deviceZone(),
    helpers: { toJulianDay, sunPosition, fixHour, toClock }
  };
})();
