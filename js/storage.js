/**
 * منصة البيان - وحدة إدارة التخزين المحلي (Storage Engine)
 * مسؤولة عن إدارة حالة الموقع، حفظ التقدم، الثيم، السلسلة اليومية، والتفضيلات
 */

const StorageKeys = {
  THEME: 'alBayan_theme',
  MORNING_PROGRESS: 'alBayan_morning_progress',
  EVENING_PROGRESS: 'alBayan_evening_progress',
  SLEEP_PROGRESS: 'alBayan_sleep_progress',
  LAST_SESSION: 'alBayan_last_session',
  STREAK: 'alBayan_streak',
  COMPLETED_SESSIONS: 'alBayan_completed_sessions',
  SPLASH_DISMISSED: 'alBayan_splash_dismissed',
  PRAYER_OFFSET: 'alBayan_prayer_offset',
  LEGACY_PRAYER_OFFSET: 'ather_prayer_offset',
  PRAYER_LOCATION: 'alBayan_prayer_location',
  PRAYER_CITY: 'alBayan_prayer_city',
  PRAYER_PREFS: 'alBayan_prayer_prefs'
};

// مفتاح التاريخ بالتوقيت المحلي للجهاز، وليس بتوقيت UTC
function localDateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysBetweenKeys(olderKey, newerKey) {
  const diff = parseDateKey(newerKey) - parseDateKey(olderKey);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

const StorageManager = {
  // --- Safe Helper Methods ---
  _getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`LocalStorage read failed for ${key}:`, e);
      return null;
    }
  },

  _setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`LocalStorage write failed for ${key}:`, e);
    }
  },

  _getJSON(key, defaultValue = null) {
    const raw = this._getItem(key);
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Error parsing JSON for ${key}:`, e);
      return defaultValue;
    }
  },

  _setJSON(key, value) {
    try {
      this._setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error stringifying JSON for ${key}:`, e);
    }
  },

  // --- Theme Management ---
  saveTheme(theme) {
    this._setItem(StorageKeys.THEME, theme === 'dark' ? 'dark' : 'light');
  },

  loadTheme() {
    const saved = this._getItem(StorageKeys.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    // لا تفضيل محفوظ: نحترم إعداد النظام
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  },

  // --- Progress Management ---
  _getProgressKey(type) {
    const progressKeys = {
      morning: StorageKeys.MORNING_PROGRESS,
      evening: StorageKeys.EVENING_PROGRESS,
      sleep: StorageKeys.SLEEP_PROGRESS
    };
    return progressKeys[type] || null;
  },

  saveProgress(type, data) {
    const key = this._getProgressKey(type);
    if (!key) return;
    this._setJSON(key, {
      currentIndex: data.currentIndex || 0,
      currentCount: data.currentCount || 0,
      completedItems: data.completedItems || [],
      totalItems: data.totalItems || 0,
      progressPercent: data.progressPercent || 0,
      updatedAt: new Date().toISOString()
    });
  },

  loadProgress(type) {
    const key = this._getProgressKey(type);
    if (!key) return null;
    return this._getJSON(key, null);
  },

  clearProgress(type) {
    const key = this._getProgressKey(type);
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to clear progress for ${type}:`, e);
    }
  },

  // --- Last Session Management ---
  saveLastSession(sessionData) {
    this._setJSON(StorageKeys.LAST_SESSION, {
      type: sessionData.type, // 'morning' | 'evening'
      title: sessionData.title,
      currentIndex: sessionData.currentIndex,
      totalItems: sessionData.totalItems,
      progressPercent: sessionData.progressPercent,
      timestamp: new Date().toISOString()
    });
  },

  loadLastSession() {
    return this._getJSON(StorageKeys.LAST_SESSION, null);
  },

  clearLastSession() {
    try {
      localStorage.removeItem(StorageKeys.LAST_SESSION);
    } catch (e) {
      console.warn('Failed to clear last session:', e);
    }
  },

  // --- Streak Management ---
  loadStreak() {
    const streak = this._getJSON(StorageKeys.STREAK, {
      count: 0,
      lastCompletedDate: null
    });

    if (!streak.lastCompletedDate) return { count: 0, lastCompletedDate: null };

    // السلسلة منتهية إذا مرّ أكثر من يوم على آخر إتمام
    const daysSince = daysBetweenKeys(streak.lastCompletedDate, localDateKey());
    if (daysSince > 1) return { count: 0, lastCompletedDate: streak.lastCompletedDate };

    return streak;
  },

  saveStreak(streakData) {
    this._setJSON(StorageKeys.STREAK, streakData);
  },

  recordSessionCompletion(type) {
    const today = localDateKey();
    const streak = this._getJSON(StorageKeys.STREAK, {
      count: 0,
      lastCompletedDate: null
    });

    if (streak.lastCompletedDate === today) {
      // Already completed today, maintain streak
      return streak;
    }

    if (!streak.lastCompletedDate) {
      // First time
      streak.count = 1;
    } else {
      const diffDays = daysBetweenKeys(streak.lastCompletedDate, today);

      if (diffDays === 1) {
        // Consecutive day
        streak.count = (streak.count || 0) + 1;
      } else if (diffDays > 1) {
        // Streak broken
        streak.count = 1;
      }
    }

    streak.lastCompletedDate = today;
    this.saveStreak(streak);

    // Save into completed sessions history
    const history = this.loadCompletedSessions();
    history.push({
      type,
      date: today,
      timestamp: new Date().toISOString()
    });
    // Keep last 30 sessions
    if (history.length > 30) history.shift();
    this.saveCompletedSessions(history);

    return streak;
  },

  // --- Completed Sessions History ---
  loadCompletedSessions() {
    return this._getJSON(StorageKeys.COMPLETED_SESSIONS, []);
  },

  saveCompletedSessions(list) {
    this._setJSON(StorageKeys.COMPLETED_SESSIONS, list);
  },

  // --- Prayer Timing Offset ---
  loadPrayerOffset() {
    const stored = this._getItem(StorageKeys.PRAYER_OFFSET);
    if (stored !== null) return parseInt(stored, 10) || 0;

    // نسخة واحدة من تفضيل كان محفوظاً باسم مشروع سابق
    const legacy = this._getItem(StorageKeys.LEGACY_PRAYER_OFFSET);
    if (legacy === null) return 0;

    const value = parseInt(legacy, 10) || 0;
    this.savePrayerOffset(value);
    try {
      localStorage.removeItem(StorageKeys.LEGACY_PRAYER_OFFSET);
    } catch (e) {
      console.warn('Failed to clear legacy prayer offset:', e);
    }
    return value;
  },

  savePrayerOffset(minutes) {
    this._setItem(StorageKeys.PRAYER_OFFSET, String(parseInt(minutes, 10) || 0));
  },

  // --- Prayer Location ---
  // يُحفظ الموقع نفسه (إحداثيات + دقة + لحظة الأخذ) وحده، لا المواقيت المحسوبة منه.
  // المواقيت تُعاد حسابها لكل يوم من الإحداثيات، فلا يتحوّل المخزون إلى قفل.
  savePrayerLocation(record) {
    const clean = this._cleanLocation(record);
    if (!clean) return false;
    this._setJSON(StorageKeys.PRAYER_LOCATION, clean);
    return true;
  },

  loadPrayerLocation() {
    return this._cleanLocation(this._getJSON(StorageKeys.PRAYER_LOCATION, null));
  },

  clearPrayerLocation() {
    try {
      localStorage.removeItem(StorageKeys.PRAYER_LOCATION);
    } catch (e) {
      console.warn('Failed to clear prayer location:', e);
    }
  },

  _cleanLocation(record) {
    if (!record || typeof record !== 'object') return null;

    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

    const accuracy = Number(record.accuracy);
    const acquiredAt = new Date(record.acquiredAt);
    if (Number.isNaN(acquiredAt.getTime())) return null;

    const source = record.source === 'manual' ? 'manual' : 'device';
    if (latitude === 0 && longitude === 0) return null; // إحداثيات فارغة لا تُعتبر موقعاً

    const utcOffsetMinutes = Number(record.utcOffsetMinutes);

    return {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      timeZone: typeof record.timeZone === 'string' && record.timeZone ? record.timeZone : null,
      utcOffsetMinutes: Number.isFinite(utcOffsetMinutes) ? utcOffsetMinutes : null,
      label: typeof record.label === 'string' ? record.label : null,
      cityId: typeof record.cityId === 'string' ? record.cityId : null,
      profile: this._cleanProfile(record.profile),
      source,
      acquiredAt: acquiredAt.toISOString()
    };
  },

  // الملف الفعّال المحفوظ للموقع: إعدادات حساب لا أوقات محسوبة.
  // يُستعمل بلا إنترنت حين لا تُحلّ المدينة من الإحداثيات وحدها.
  _cleanProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;

    const text = (value) => (typeof value === 'string' && value ? value : null);
    const adjust = {};
    const rawAdjust = profile.adjust && typeof profile.adjust === 'object' ? profile.adjust : {};
    Object.keys(rawAdjust).forEach((key) => {
      const value = Number(rawAdjust[key]);
      if (Number.isFinite(value)) adjust[key] = Math.round(value);
    });

    return {
      method: text(profile.method),
      asr: text(profile.asr),
      highLat: text(profile.highLat),
      adjust: Object.keys(adjust).length ? adjust : null
    };
  },

  // المدينة المختارة يدوياً تبقى حتى يغيّرها المستخدم أو يلغيها
  saveManualPrayerCity(city) {
    if (!city || typeof city.id !== 'string') return false;
    this._setJSON(StorageKeys.PRAYER_CITY, {
      id: city.id,
      label: String(city.label || city.name || city.id),
      updatedAt: new Date().toISOString()
    });
    return true;
  },

  loadManualPrayerCity() {
    const city = this._getJSON(StorageKeys.PRAYER_CITY, null);
    if (!city || typeof city.id !== 'string') return null;
    return city;
  },

  clearManualPrayerCity() {
    try {
      localStorage.removeItem(StorageKeys.PRAYER_CITY);
    } catch (e) {
      console.warn('Failed to clear manual prayer city:', e);
    }
  },

  // --- Prayer Method Preferences ---
  // تفضيل المستخدم الصريح للمنهج ومدرسة العصر. لا تكتبه هذه الدوال إلا واجهة
  // الإعدادات: تحديد الموقع لا يمسّ الاختيار اليدوي أبداً. القيم الفارغة = بلا تفضيل.
  loadPrayerPrefs() {
    const prefs = this._getJSON(StorageKeys.PRAYER_PREFS, null);
    if (!prefs || typeof prefs !== 'object') return { method: null, asr: null };

    const method = typeof prefs.method === 'string' && prefs.method ? prefs.method : null;
    const asr = prefs.asr === 'standard' || prefs.asr === 'hanafi' ? prefs.asr : null;
    return { method, asr };
  },

  savePrayerPrefs(prefs) {
    const source = prefs && typeof prefs === 'object' ? prefs : {};
    this._setJSON(StorageKeys.PRAYER_PREFS, {
      method: typeof source.method === 'string' && source.method ? source.method : null,
      asr: source.asr === 'standard' || source.asr === 'hanafi' ? source.asr : null
    });
  },

  // --- Splash Screen Dismissal ---
  hasSeenSplash() {
    try {
      return sessionStorage.getItem(StorageKeys.SPLASH_DISMISSED) === 'true';
    } catch (e) {
      return false;
    }
  },

  setSeenSplash(seen = true) {
    try {
      sessionStorage.setItem(StorageKeys.SPLASH_DISMISSED, seen ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to set splash state:', e);
    }
  }
};

// Global export for vanilla scripts
window.StorageManager = StorageManager;
