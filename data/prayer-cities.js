/**
 * منصة البيان — قائمة المدن للاختيار اليدوي
 *
 * تُستخدم حين يرفض المستخدم إذن الموقع، أو حين يريد مواقيت مدينة أخرى.
 * الإحداثيات للمدينة نفسها، والمنطقة الزمنية باسمها IANA كي تُحسب الإزاحة
 * صحيحةً في التوقيت الصيفي. حقل utcMinutes بالدقائق احتياط عند متصفحٍ لا
 * يفهم اسم المنطقة: +05:30 = 330 و+05:45 = 345 و−05:00 = −300.
 *
 * كل مدينة تحمل region لإقليمها (data/prayer-regions.js) فترث منهجه، ولها
 * profile اختياري تخصص به ما يختلف عن إقليمها: منهجاً أو زاوية أو مدرسة عصر
 * أو قاعدة خطوط عالية أو دقائق تعديل لكل صلاة. لا تُخلَط مدينة بإقليم
 * جارتها حين تختلف الهيئتان.
 */
(() => {
  'use strict';

  const CITIES = [
    // الحرم والمملكة
    { id: 'makkah', name: 'مكة المكرمة', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh', utcMinutes: 180 },
    { id: 'madinah', name: 'المدينة المنورة', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 24.4672, longitude: 39.6111, timeZone: 'Asia/Riyadh', utcMinutes: 180 },
    { id: 'riyadh', name: 'الرياض', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 24.7136, longitude: 46.6753, timeZone: 'Asia/Riyadh', utcMinutes: 180 },
    { id: 'jeddah', name: 'جدة', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 21.4858, longitude: 39.1925, timeZone: 'Asia/Riyadh', utcMinutes: 180 },
    { id: 'dammam', name: 'الدمام', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 26.4207, longitude: 50.0888, timeZone: 'Asia/Riyadh', utcMinutes: 180 },
    { id: 'abha', name: 'أبها', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 18.2164, longitude: 42.5053, timeZone: 'Asia/Riyadh', utcMinutes: 180 },
    { id: 'tabuk', name: 'تبوك', country: 'السعودية', region: 'saudi-arabia', group: 'الحرمين والخليج', latitude: 28.3835, longitude: 36.5984, timeZone: 'Asia/Riyadh', utcMinutes: 180 },

    // الخليج
    { id: 'dubai', name: 'دبي', country: 'الإمارات', region: 'united-arab-emirates', group: 'الحرمين والخليج', latitude: 25.2048, longitude: 55.2708, timeZone: 'Asia/Dubai', utcMinutes: 240 },
    { id: 'abu-dhabi', name: 'أبوظبي', country: 'الإمارات', region: 'united-arab-emirates', group: 'الحرمين والخليج', latitude: 24.4539, longitude: 54.3773, timeZone: 'Asia/Dubai', utcMinutes: 240 },
    { id: 'sharjah', name: 'الشارقة', country: 'الإمارات', region: 'united-arab-emirates', group: 'الحرمين والخليج', latitude: 25.3463, longitude: 55.4209, timeZone: 'Asia/Dubai', utcMinutes: 240 },
    { id: 'doha', name: 'الدوحة', country: 'قطر', region: 'qatar', group: 'الحرمين والخليج', latitude: 25.2854, longitude: 51.531, timeZone: 'Asia/Qatar', utcMinutes: 180 },
    { id: 'kuwait', name: 'الكويت', country: 'الكويت', region: 'kuwait', group: 'الحرمين والخليج', latitude: 29.3759, longitude: 47.9774, timeZone: 'Asia/Kuwait', utcMinutes: 180 },
    { id: 'manama', name: 'المنامة', country: 'البحرين', region: 'bahrain', group: 'الحرمين والخليج', latitude: 26.2285, longitude: 50.586, timeZone: 'Asia/Bahrain', utcMinutes: 180 },
    { id: 'muscat', name: 'مسقط', country: 'عُمان', region: 'oman', group: 'الحرمين والخليج', latitude: 23.588, longitude: 58.3824, timeZone: 'Asia/Muscat', utcMinutes: 240 },

    // الشام والعراق
    { id: 'jerusalem', name: 'القدس', country: 'فلسطين', region: 'palestine', group: 'الشام والعراق', latitude: 31.7683, longitude: 35.2137, timeZone: 'Asia/Jerusalem', utcMinutes: 120 },
    { id: 'gaza', name: 'غزة', country: 'فلسطين', region: 'palestine', group: 'الشام والعراق', latitude: 31.5017, longitude: 34.4668, timeZone: 'Asia/Jerusalem', utcMinutes: 120 },
    { id: 'nablus', name: 'نابلس', country: 'فلسطين', region: 'palestine', group: 'الشام والعراق', latitude: 32.2211, longitude: 35.2544, timeZone: 'Asia/Jerusalem', utcMinutes: 120 },
    { id: 'hebron', name: 'الخليل', country: 'فلسطين', region: 'palestine', group: 'الشام والعراق', latitude: 31.5326, longitude: 35.0998, timeZone: 'Asia/Jerusalem', utcMinutes: 120 },
    { id: 'amman', name: 'عمّان', country: 'الأردن', region: 'jordan', group: 'الشام والعراق', latitude: 31.9539, longitude: 35.9106, timeZone: 'Asia/Amman', utcMinutes: 120 },
    { id: 'damascus', name: 'دمشق', country: 'سوريا', region: 'syria', group: 'الشام والعراق', latitude: 33.5138, longitude: 36.2765, timeZone: 'Asia/Damascus', utcMinutes: 120 },
    { id: 'aleppo', name: 'حلب', country: 'سوريا', region: 'syria', group: 'الشام والعراق', latitude: 36.2021, longitude: 37.1343, timeZone: 'Asia/Damascus', utcMinutes: 120 },
    { id: 'beirut', name: 'بيروت', country: 'لبنان', region: 'lebanon', group: 'الشام والعراق', latitude: 33.8938, longitude: 35.5018, timeZone: 'Asia/Beirut', utcMinutes: 120 },
    { id: 'baghdad', name: 'بغداد', country: 'العراق', region: 'iraq', group: 'الشام والعراق', latitude: 33.3152, longitude: 44.3661, timeZone: 'Asia/Baghdad', utcMinutes: 180 },
    { id: 'basra', name: 'البصرة', country: 'العراق', region: 'iraq', group: 'الشام والعراق', latitude: 30.5085, longitude: 47.7804, timeZone: 'Asia/Baghdad', utcMinutes: 180 },
    { id: 'erbil', name: 'أربيل', country: 'العراق', region: 'iraq', group: 'الشام والعراق', latitude: 36.1901, longitude: 44.0091, timeZone: 'Asia/Baghdad', utcMinutes: 180 },

    // مصر والسودان وبلاد المغرب
    { id: 'cairo', name: 'القاهرة', country: 'مصر', region: 'egypt', group: 'مصر والسودان والمغرب العربي', latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo', utcMinutes: 120 },
    { id: 'alexandria', name: 'الإسكندرية', country: 'مصر', region: 'egypt', group: 'مصر والسودان والمغرب العربي', latitude: 31.2001, longitude: 29.9187, timeZone: 'Africa/Cairo', utcMinutes: 120 },
    { id: 'aswan', name: 'أسوان', country: 'مصر', region: 'egypt', group: 'مصر والسودان والمغرب العربي', latitude: 24.0889, longitude: 32.8998, timeZone: 'Africa/Cairo', utcMinutes: 120 },
    { id: 'khartoum', name: 'الخرطوم', country: 'السودان', region: 'sudan', group: 'مصر والسودان والمغرب العربي', latitude: 15.5007, longitude: 32.5599, timeZone: 'Africa/Khartoum', utcMinutes: 120 },
    { id: 'tripoli-libya', name: 'طرابلس', country: 'ليبيا', region: 'libya', group: 'مصر والسودان والمغرب العربي', latitude: 32.8872, longitude: 13.1913, timeZone: 'Africa/Tripoli', utcMinutes: 120 },
    { id: 'benghazi', name: 'بنغازي', country: 'ليبيا', region: 'libya', group: 'مصر والسودان والمغرب العربي', latitude: 32.1167, longitude: 20.0667, timeZone: 'Africa/Tripoli', utcMinutes: 120 },
    { id: 'tunis', name: 'تونس', country: 'تونس', region: 'tunisia', group: 'مصر والسودان والمغرب العربي', latitude: 36.8065, longitude: 10.1815, timeZone: 'Africa/Tunis', utcMinutes: 60 },
    { id: 'algiers', name: 'الجزائر', country: 'الجزائر', region: 'algeria', group: 'مصر والسودان والمغرب العربي', latitude: 36.7538, longitude: 3.0588, timeZone: 'Africa/Algiers', utcMinutes: 60 },
    { id: 'casablanca', name: 'الدار البيضاء', country: 'المغرب', region: 'morocco', group: 'مصر والسودان والمغرب العربي', latitude: 33.5731, longitude: -7.5898, timeZone: 'Africa/Casablanca', utcMinutes: 60 },
    { id: 'rabat', name: 'الرباط', country: 'المغرب', region: 'morocco', group: 'مصر والسودان والمغرب العربي', latitude: 34.0209, longitude: -6.8416, timeZone: 'Africa/Casablanca', utcMinutes: 60 },
    { id: 'fes', name: 'فاس', country: 'المغرب', region: 'morocco', group: 'مصر والسودان والمغرب العربي', latitude: 34.0181, longitude: -5.0078, timeZone: 'Africa/Casablanca', utcMinutes: 60 },
    { id: 'marrakesh', name: 'مراكش', country: 'المغرب', region: 'morocco', group: 'مصر والسودان والمغرب العربي', latitude: 31.6295, longitude: -7.9811, timeZone: 'Africa/Casablanca', utcMinutes: 60 },
    { id: 'nouakchott', name: 'نواكشوط', country: 'موريتانيا', region: 'mauritania', group: 'مصر والسودان والمغرب العربي', latitude: 18.0735, longitude: -15.9582, timeZone: 'Africa/Nouakchott', utcMinutes: 0 },

    // أفريقيا الإسلامية
    { id: 'mogadishu', name: 'مقديشو', country: 'الصومال', region: 'somalia', group: 'شرق أفريقيا والقرن', latitude: 2.0469, longitude: 45.3182, timeZone: 'Africa/Mogadishu', utcMinutes: 180 },
    { id: 'djibouti', name: 'جيبوتي', country: 'جيبوتي', region: 'djibouti', group: 'شرق أفريقيا والقرن', latitude: 11.5721, longitude: 43.1456, timeZone: 'Africa/Djibouti', utcMinutes: 180 },
    { id: 'nairobi', name: 'نيروبي', country: 'كينيا', region: 'kenya', group: 'شرق أفريقيا والقرن', latitude: -1.2921, longitude: 36.8219, timeZone: 'Africa/Nairobi', utcMinutes: 180 },
    { id: 'dar-es-salaam', name: 'دار السلام', country: 'تنزانيا', region: 'tanzania', group: 'شرق أفريقيا والقرن', latitude: -6.7924, longitude: 39.2083, timeZone: 'Africa/Dar_es_Salaam', utcMinutes: 180 },
    { id: 'lagos', name: 'لاغوس', country: 'نيجيريا', region: 'nigeria', group: 'شرق أفريقيا والقرن', latitude: 6.5244, longitude: 3.3792, timeZone: 'Africa/Lagos', utcMinutes: 60 },

    // اليمن وآسيا
    { id: 'sanaa', name: 'صنعاء', country: 'اليمن', region: 'yemen', group: 'اليمن وآسيا', latitude: 15.3694, longitude: 44.191, timeZone: 'Asia/Aden', utcMinutes: 180 },
    { id: 'aden', name: 'عدن', country: 'اليمن', region: 'yemen', group: 'اليمن وآسيا', latitude: 12.7855, longitude: 45.0187, timeZone: 'Asia/Aden', utcMinutes: 180 },
    { id: 'tehran', name: 'طهران', country: 'إيران', region: 'iran', group: 'اليمن وآسيا', latitude: 35.6892, longitude: 51.389, timeZone: 'Asia/Tehran', utcMinutes: 210 },
    { id: 'karachi', name: 'كراتشي', country: 'باكستان', region: 'pakistan', group: 'اليمن وآسيا', latitude: 24.8607, longitude: 67.0011, timeZone: 'Asia/Karachi', utcMinutes: 300 },
    { id: 'lahore', name: 'لاهور', country: 'باكستان', region: 'pakistan', group: 'اليمن وآسيا', latitude: 31.5204, longitude: 74.3587, timeZone: 'Asia/Karachi', utcMinutes: 300 },
    { id: 'dhaka', name: 'دكا', country: 'بنغلاديش', region: 'bangladesh', group: 'اليمن وآسيا', latitude: 23.8103, longitude: 90.4125, timeZone: 'Asia/Dhaka', utcMinutes: 360 },
    { id: 'mumbai', name: 'مومباي', country: 'الهند', region: 'india', group: 'اليمن وآسيا', latitude: 19.076, longitude: 72.8777, timeZone: 'Asia/Kolkata', utcMinutes: 330 },
    { id: 'new-delhi', name: 'نيودلهي', country: 'الهند', region: 'india', group: 'اليمن وآسيا', latitude: 28.6139, longitude: 77.209, timeZone: 'Asia/Kolkata', utcMinutes: 330 },
    { id: 'kathmandu', name: 'كاتماندو', country: 'نيبال', region: 'nepal', group: 'اليمن وآسيا', latitude: 27.7172, longitude: 85.324, timeZone: 'Asia/Kathmandu', utcMinutes: 345 },
    { id: 'colombo', name: 'كولومبو', country: 'سريلانكا', region: 'srilanka', group: 'اليمن وآسيا', latitude: 6.9271, longitude: 79.8612, timeZone: 'Asia/Colombo', utcMinutes: 330 },
    { id: 'kabul', name: 'كابول', country: 'أفغانستان', region: 'afghanistan', group: 'اليمن وآسيا', latitude: 34.5553, longitude: 69.2075, timeZone: 'Asia/Kabul', utcMinutes: 270 },
    { id: 'yangon', name: 'يانغون', country: 'ميانمار', region: 'myanmar', group: 'اليمن وآسيا', latitude: 16.8661, longitude: 96.1951, timeZone: 'Asia/Yangon', utcMinutes: 390 },
    { id: 'jakarta', name: 'جاكرتا', country: 'إندونيسيا', region: 'indonesia', group: 'اليمن وآسيا', latitude: -6.2088, longitude: 106.8456, timeZone: 'Asia/Jakarta', utcMinutes: 420 },
    { id: 'bandung', name: 'باندونغ', country: 'إندونيسيا', region: 'indonesia', group: 'اليمن وآسيا', latitude: -6.9175, longitude: 107.6191, timeZone: 'Asia/Jakarta', utcMinutes: 420 },
    { id: 'kualalumpur', name: 'كوالالمبور', country: 'ماليزيا', region: 'malaysia', group: 'اليمن وآسيا', latitude: 3.139, longitude: 101.6869, timeZone: 'Asia/Kuala_Lumpur', utcMinutes: 480 },
    { id: 'singapore', name: 'سنغافورة', country: 'سنغافورة', region: 'singapore', group: 'اليمن وآسيا', latitude: 1.3521, longitude: 103.8198, timeZone: 'Asia/Singapore', utcMinutes: 480 },
    { id: 'tashkent', name: 'طشقند', country: 'أوزبكستان', region: 'uzbekistan', group: 'اليمن وآسيا', latitude: 41.2995, longitude: 69.2401, timeZone: 'Asia/Tashkent', utcMinutes: 300 },
    { id: 'almaty', name: 'ألماتي', country: 'كازاخستان', region: 'kazakhstan', group: 'اليمن وآسيا', latitude: 43.222, longitude: 76.8512, timeZone: 'Asia/Almaty', utcMinutes: 360 },
    { id: 'baku', name: 'باكو', country: 'أذربيجان', region: 'azerbaijan', group: 'اليمن وآسيا', latitude: 40.4093, longitude: 49.8671, timeZone: 'Asia/Baku', utcMinutes: 240 },

    // أوروبا
    { id: 'istanbul', name: 'إسطنبول', country: 'تركيا', region: 'turkey', group: 'أوروبا وأمريكا وأستراليا', latitude: 41.0082, longitude: 28.9784, timeZone: 'Europe/Istanbul', utcMinutes: 180 },
    { id: 'ankara', name: 'أنقرة', country: 'تركيا', region: 'turkey', group: 'أوروبا وأمريكا وأستراليا', latitude: 39.9334, longitude: 32.8597, timeZone: 'Europe/Istanbul', utcMinutes: 180 },
    { id: 'sarajevo', name: 'سراييفو', country: 'البوسنة', region: 'bosnia', group: 'أوروبا وأمريكا وأستراليا', latitude: 43.8563, longitude: 18.4131, timeZone: 'Europe/Sarajevo', utcMinutes: 60 },
    { id: 'tirana', name: 'تيرانا', country: 'ألبانيا', region: 'albania', group: 'أوروبا وأمريكا وأستراليا', latitude: 41.3275, longitude: 19.8187, timeZone: 'Europe/Tirane', utcMinutes: 60 },
    { id: 'london', name: 'لندن', country: 'بريطانيا', region: 'united-kingdom', group: 'أوروبا وأمريكا وأستراليا', latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London', utcMinutes: 0 },
    { id: 'paris', name: 'باريس', country: 'فرنسا', region: 'france', group: 'أوروبا وأمريكا وأستراليا', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', utcMinutes: 60 },
    { id: 'berlin', name: 'برلين', country: 'ألمانيا', region: 'germany', group: 'أوروبا وأمريكا وأستراليا', latitude: 52.52, longitude: 13.405, timeZone: 'Europe/Berlin', utcMinutes: 60 },
    { id: 'brussels', name: 'بروكسل', country: 'بلجيكا', region: 'belgium', group: 'أوروبا وأمريكا وأستراليا', latitude: 50.8503, longitude: 4.3517, timeZone: 'Europe/Brussels', utcMinutes: 60 },
    { id: 'amsterdam', name: 'أمستردام', country: 'هولندا', region: 'netherlands', group: 'أوروبا وأمريكا وأستراليا', latitude: 52.3676, longitude: 4.9041, timeZone: 'Europe/Amsterdam', utcMinutes: 60 },
    { id: 'madrid', name: 'مدريد', country: 'إسبانيا', region: 'spain', group: 'أوروبا وأمريكا وأستراليا', latitude: 40.4168, longitude: -3.7038, timeZone: 'Europe/Madrid', utcMinutes: 60 },
    { id: 'rome', name: 'روما', country: 'إيطاليا', region: 'italy', group: 'أوروبا وأمريكا وأستراليا', latitude: 41.9028, longitude: 12.4964, timeZone: 'Europe/Rome', utcMinutes: 60 },
    { id: 'vienna', name: 'فيينا', country: 'النمسا', region: 'austria', group: 'أوروبا وأمريكا وأستراليا', latitude: 48.2082, longitude: 16.3738, timeZone: 'Europe/Vienna', utcMinutes: 60 },
    { id: 'stockholm', name: 'ستوكهولم', country: 'السويد', region: 'sweden', group: 'أوروبا وأمريكا وأستراليا', latitude: 59.3293, longitude: 18.0686, timeZone: 'Europe/Stockholm', utcMinutes: 60 },
    { id: 'moscow', name: 'موسكو', country: 'روسيا', region: 'russia', group: 'أوروبا وأمريكا وأستراليا', latitude: 55.7558, longitude: 37.6173, timeZone: 'Europe/Moscow', utcMinutes: 180 },

    // أمريكا وأستراليا
    { id: 'new-york', name: 'نيويورك', country: 'أمريكا', region: 'united-states', group: 'أوروبا وأمريكا وأستراليا', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York', utcMinutes: -300 },
    { id: 'chicago', name: 'شيكاغو', country: 'أمريكا', region: 'united-states', group: 'أوروبا وأمريكا وأستراليا', latitude: 41.8781, longitude: -87.6298, timeZone: 'America/Chicago', utcMinutes: -360 },
    { id: 'houston', name: 'هيوستن', country: 'أمريكا', region: 'united-states', group: 'أوروبا وأمريكا وأستراليا', latitude: 29.7604, longitude: -95.3698, timeZone: 'America/Chicago', utcMinutes: -360 },
    { id: 'los-angeles', name: 'لوس أنجلوس', country: 'أمريكا', region: 'united-states', group: 'أوروبا وأمريكا وأستراليا', latitude: 34.0522, longitude: -118.2437, timeZone: 'America/Los_Angeles', utcMinutes: -480 },
    { id: 'toronto', name: 'تورونتو', country: 'كندا', region: 'canada', group: 'أوروبا وأمريكا وأستراليا', latitude: 43.6532, longitude: -79.3832, timeZone: 'America/Toronto', utcMinutes: -300 },
    { id: 'sao-paulo', name: 'ساو باولو', country: 'البرازيل', region: 'brazil', group: 'أوروبا وأمريكا وأستراليا', latitude: -23.5505, longitude: -46.6333, timeZone: 'America/Sao_Paulo', utcMinutes: -180 },
    { id: 'buenos-aires', name: 'بوينس آيرس', country: 'الأرجنتين', region: 'argentina', group: 'أوروبا وأمريكا وأستراليا', latitude: -34.6037, longitude: -58.3816, timeZone: 'America/Argentina/Buenos_Aires', utcMinutes: -180 },
    { id: 'sydney', name: 'سيدني', country: 'أستراليا', region: 'australia', group: 'أوروبا وأمريكا وأستراليا', latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney', utcMinutes: 600 },
    { id: 'adelaide', name: 'أديلايد', country: 'أستراليا', region: 'australia', group: 'أوروبا وأمريكا وأستراليا', latitude: -34.9285, longitude: 138.6007, timeZone: 'Australia/Adelaide', utcMinutes: 570 }
  ];

  const byId = (id) => CITIES.find((city) => city.id === id) || null;

  // تحقّق من البيانات: معرّف فريد، إحداثيات، منطقة زمنية، إقليم معروف
  function selfCheck() {
    const problems = [];
    const regions = window.PrayerRegions;
    const seen = new Set();

    CITIES.forEach((city) => {
      const at = `المدينة ${city.id || '?'}`;
      if (!city.id) problems.push(`${at}: بلا معرّف`);
      else if (seen.has(city.id)) problems.push(`${at}: معرّف مكرر`);
      seen.add(city.id);

      if (!Number.isFinite(city.latitude) || Math.abs(city.latitude) > 90) {
        problems.push(`${at}: خط عرض غير صالح`);
      }
      if (!Number.isFinite(city.longitude) || Math.abs(city.longitude) > 180) {
        problems.push(`${at}: خط طول غير صالح`);
      }
      if (typeof city.timeZone !== 'string' || !city.timeZone) {
        problems.push(`${at}: بلا منطقة زمنية IANA`);
      }
      if (!Number.isFinite(city.utcMinutes)) problems.push(`${at}: بلا utcMinutes`);
      if (!city.region) problems.push(`${at}: بلا إقليم`);
      else if (regions && !regions.byId(city.region)) problems.push(`${at}: إقليم مجهول ${city.region}`);

      if (city.profile && regions) {
        const check = window.PrayerCalc.normalizeProfile({
          method: city.profile.method || regions.byId(city.region).profile.method,
          ...city.profile
        });
        if (!check.valid) problems.push(`${at}: ملف حساب غير صالح — ${check.problems.join('، ')}`);
      }
    });

    const methods = window.PrayerCalc ? Object.keys(window.PrayerCalc.METHODS) : [];
    if (regions) {
      regions.list.forEach((region) => {
        if (!methods.includes(region.profile.method)) {
          problems.push(`الإقليم ${region.id}: منهج مجهول ${region.profile.method}`);
        }
      });
    }
    return problems;
  }

  function grouped() {
    const order = [];
    const map = new Map();
    CITIES.forEach((city) => {
      if (!map.has(city.group)) {
        map.set(city.group, []);
        order.push(city.group);
      }
      map.get(city.group).push(city);
    });
    return order.map((label) => ({ label, cities: map.get(label) }));
  }

  window.PrayerCities = { list: CITIES, byId, grouped, selfCheck };
})();
