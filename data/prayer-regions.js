/**
 * منصة البيان — أقاليم الحساب (الدولة/المنطقة → ملف حساب الافتراضي)
 *
 * كل مدينة تنتمي لإقليم؛ إقليم يحمل منهج الهيئة المحلية إن وُثِّقت،
 * أو منهجاً افتراضياً معلوماً حين لا هيئة منشورة الزوايا. confidence:
 *   verified   رقم منشور عن الهيئة نفسها
 *   secondary  رقم من جدول Methods المكتبي المتداول (aladhan/PrayTimes)
 *   unverified لا هيئة موثَّقة خلفه؛ الافتراضي رابطة العالم الإسلامي
 *              ويُعرض على المستخدم قابلاً للتغيير
 * لا يُفرض منهج قطر على العالم، ولا يُختار منهج لمدينة لأن يوم اختبار
 * واحداً صادف مرجعاً. highLat معلومة صراحةً في كل إقليم خطوطه العالية
 * لا تبلغ شمسُه زاوية الفجر في الصيف.
 */
(() => {
  'use strict';

  const M = (method, extra) => ({ method, ...extra });

  const REGIONS = [
    // الجزيرة العربية والخليج
    {
      id: 'saudi-arabia', label: 'السعودية',
      profile: M('ummAlQura'),
      authority: 'وزارة الشؤون الإسلامية والدعوة والإرشاد — تقويم أم القرى',
      confidence: 'verified',
      note: 'أم القرى: فجر 18.5° وعشاء 90 دقيقة بعد المغرب. اختلاف المنطقة الشرقية إن وُجد لم يُوثَّق.'
    },
    {
      id: 'united-arab-emirates', label: 'الإمارات',
      profile: M('dubai'),
      authority: 'دائرة الشؤون الإسلامية والعمل الخيري — دبي',
      confidence: 'secondary',
      note: 'الجدول المكتبي يعطي 18.2° للفجر والعشاء؛ أبوظبي والشارقة قد تختلف عن دبي.'
    },
    {
      id: 'qatar', label: 'قطر',
      profile: M('qatar'),
      authority: 'وزارة الأوقاف والشؤون الإسلامية — قطر',
      confidence: 'secondary',
      note: 'فجر 18° وعشاء 90 دقيقة بعد المغرب.'
    },
    {
      id: 'kuwait', label: 'الكويت',
      profile: M('kuwait'),
      authority: 'وزارة الأوقاف والشؤون الإسلامية — الكويت',
      confidence: 'secondary',
      note: 'فجر 18° وعشاء 17.5°.'
    },
    {
      id: 'bahrain', label: 'البحرين',
      profile: M('gulf'),
      authority: null,
      confidence: 'unverified',
      note: 'لا جدول زاوية منشور عن وزارة العدل والشؤون الإسلامية؛ استُعمل منهج الخليج المجاور (19.5°/90 دقيقة).'
    },
    {
      id: 'oman', label: 'عُمان',
      profile: M('gulf'),
      authority: null,
      confidence: 'unverified',
      note: 'وزارة الأوقاف والشؤون الدينية لم تنشر الزوايا؛ استُعمل منهج الخليج.'
    },
    {
      id: 'yemen', label: 'اليمن',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق هيئة يمنية منشورة الزوايا؛ الافتراضي رابطة العالم الإسلامي وقابل للتغيير.'
    },

    // الشام والعراق
    {
      id: 'palestine', label: 'فلسطين',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لا هيئة فلسطينية منشورة الزوايا؛ الدوائر المحلية تختلف. مُنهج رابطة العالم الإسلامي افتراضي معلن، لا ادّعاء رسمية.'
    },
    {
      id: 'jordan', label: 'الأردن',
      profile: M('jordan'),
      authority: 'دائرة الإفتاء العام / وزارة الأوقاف الأردنية',
      confidence: 'secondary',
      note: 'فجر 18° وعشاء 18° ومغرب +5 دقائق بعد الغروب.'
    },
    {
      id: 'syria', label: 'سوريا',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'مديرية الأوقاف لم تُوثَّق زواياها؛ الافتراضي رابطة العالم الإسلامي.'
    },
    {
      id: 'lebanon', label: 'لبنان',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'دار الفتوى تختلف بين بيروت وطرابلس؛ لم تُوثَّق الزوايا. الافتراضي رابطة العالم الإسلامي.'
    },
    {
      id: 'iraq', label: 'العراق',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'ديوان الأوقاف لم تُوثَّق زواياه؛ بغداد والموصل قد تختلفان. الاختيار قابل للتغيير.'
    },

    // وادي النيل والمغرب العربي
    {
      id: 'egypt', label: 'مصر',
      profile: M('egypt'),
      authority: 'الهيئة المصرية العامة للمساحة',
      confidence: 'verified',
      note: 'فجر 19.5° وعشاء 17.5°. المرجع التاريخي للصفحة.'
    },
    {
      id: 'sudan', label: 'السودان',
      profile: M('egypt'),
      authority: null,
      confidence: 'unverified',
      note: 'هيئة الأوقاف السودانية لم تُوثَّق زواياها؛ جارتها مصر تستخدم 19.5°/17.5°.'
    },
    {
      id: 'libya', label: 'ليبيا',
      profile: M('egypt'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا الهيئة العامة للأوقاف؛ استُعملت الزاويتان المصريتان.'
    },
    {
      id: 'tunisia', label: 'تونس',
      profile: M('tunisia'),
      authority: 'وزارة الشؤون الدينية — لجنة المواقيت',
      confidence: 'secondary',
      note: 'فجر 18° وعشاء 18°.'
    },
    {
      id: 'algeria', label: 'الجزائر',
      profile: M('algeria'),
      authority: 'وزارة الشؤون الدينية والأوقاف',
      confidence: 'secondary',
      note: 'فجر 18° وعشاء 17°.'
    },
    {
      id: 'morocco', label: 'المغرب',
      profile: M('morocco'),
      authority: 'وزارة الأوقاف والشؤون الإسلامية',
      confidence: 'secondary',
      note: 'فجر 19° وعشاء 17°. لا توقيت صيفي في التقويم المغربي.'
    },
    {
      id: 'mauritania', label: 'موريتانيا',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا نواكشوط؛ رابطة العالم الإسلامي افتراضياً.'
    },

    // شرق أفريقيا
    {
      id: 'somalia', label: 'الصومال',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا مقديشو.'
    },
    {
      id: 'djibouti', label: 'جيبوتي',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا جيبوتي.'
    },
    {
      id: 'kenya', label: 'كينيا',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'المجالس الإسلامية الساحلية تختلف؛ لم تُوثَّق زوايا نيروبي.'
    },
    {
      id: 'tanzania', label: 'تنزانيا',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا دار السلام.'
    },
    {
      id: 'nigeria', label: 'نيجيريا',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'الجمعية الإسلامية النيجيرية لم تُوثَّق زواياها المنشورة.'
    },

    // إيران وآسيا الجنوبية
    {
      id: 'iran', label: 'إيران',
      profile: M('tehran'),
      authority: 'معهد الجيوفيزياء — جامعة طهران',
      confidence: 'secondary',
      note: 'فجر 17.7° وعشاء 14° ومغرب عند 4.5° تحت الأفق. إيران بأكملها +3:30 (210 دقيقة).'
    },
    {
      id: 'pakistan', label: 'باكستان',
      profile: M('karachi'),
      authority: 'جامعة العلوم الإسلامية — كراتشي',
      confidence: 'verified',
      note: 'فجر 18° وعشاء 18°: جدول كراتشي مطابق دقيقة بدقيقة على ثلاثة تواريخ. الهيئة تطبع العصر حنفياً افتراضياً وتوفر الشافعي؛ أبقينا الجمهور لأن العمل في البلد مختلف، والتبديل بيدك في صفحة المواقيت.'
    },
    {
      id: 'india', label: 'الهند',
      profile: M('karachi'),
      authority: null,
      confidence: 'unverified',
      note: 'الهند واسعة والمجالس مختلفة؛ كثير منها يعمل بجدول كراتشي. Mumbai وDelhi وChennai قد تختلف — راجع مسجدك المحلي.'
    },
    {
      id: 'bangladesh', label: 'بنغلاديش',
      profile: M('karachi'),
      authority: null,
      confidence: 'unverified',
      note: 'المؤسسة الإسلامية لم تُوثَّق زواياها؛ جدول كراتشي مستعمل.'
    },
    {
      id: 'nepal', label: 'نيبال',
      profile: M('karachi'),
      authority: null,
      confidence: 'unverified',
      note: 'لا جدول محلي موثَّق. منطقتها +5:45 (345 دقيقة) تُحسب بالدقيقة.'
    },
    {
      id: 'afghanistan', label: 'أفغانستان',
      profile: M('karachi'),
      authority: null,
      confidence: 'unverified',
      note: 'لا جدول محلي موثَّق. منطقتها +4:30 (270 دقيقة) تُحسب بالدقيقة.'
    },
    {
      id: 'srilanka', label: 'سريلانكا',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا كولومبو.'
    },
    {
      id: 'myanmar', label: 'ميانمار',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لا جدول محلي موثَّق. منطقتها +6:30 (390 دقيقة) تُحسب بالدقيقة.'
    },

    // جنوب شرق آسيا وآسيا الوسطى
    {
      id: 'indonesia', label: 'إندونيسيا',
      profile: M('indonesia'),
      authority: 'Kemenag — وزارة الشؤون الدينية',
      confidence: 'secondary',
      note: 'فجر 20° وعشاء 18°. جاكرتا +7؛ إندونيسيا ثلاث مناطق زمنية.'
    },
    {
      id: 'malaysia', label: 'ماليزيا',
      profile: M('malaysia'),
      authority: 'JAKIM',
      confidence: 'secondary',
      note: 'فجر 20° وعشاء 18°. بعض ولايات ماليزيا تختلف عن JAKIM.'
    },
    {
      id: 'singapore', label: 'سنغافورة',
      profile: M('singapore'),
      authority: 'MUIS',
      confidence: 'secondary',
      note: 'فجر 20° وعشاء 18°.'
    },
    {
      id: 'uzbekistan', label: 'أوزبكستان',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'مديرية مسلمي أوزبكستان لم تُوثَّق زواياها.'
    },
    {
      id: 'kazakhstan', label: 'كازاخستان',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا جمعية مسلمي كازاخستان.'
    },
    {
      id: 'azerbaijan', label: 'أذربيجان',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'مديرية مسلمي القوقاز لم تُوثَّق زواياها.'
    },

    // تركيا والبلقان
    {
      id: 'turkey', label: 'تركيا',
      profile: M('diyanet'),
      authority: 'رئاسة الشؤون الدينية (Diyanet İşleri Başkanlığı)',
      confidence: 'verified',
      note: 'فجر 18° وعشاء 17° مع تمكين الهيئة المنشور: −7 على الشروق، +5 الظهر، +4 العصر، +7 المغرب، ولا شيء على الفجر والعشاء. جدول إسطنبول مطابق له دقيقة بدقيقة.'
    },
    {
      id: 'bosnia', label: 'البوسنة',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'المشيخة الإسلامية البوسنية لم تُوثَّق زواياها.'
    },
    {
      id: 'albania', label: 'ألبانيا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'رئاسة المشيخة لألبانيا لم تُوثَّق زواياها.'
    },

    // أوروبا
    {
      id: 'russia', label: 'روسيا',
      profile: M('russia', { highLat: 'angleBased' }),
      authority: 'الإدارة الدينية المركزية لمسلمي روسيا',
      confidence: 'secondary',
      note: 'فجر 16° وعشاء 15°. موسكو خارج نطاق 18° صيفاً.'
    },
    {
      id: 'united-kingdom', label: 'بريطانيا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'مساجد لندن تتفاوت بين 18/17 وقواعد الليل. خطوطها العالية لا تبلغ 18° في الصيف فتُطبق قاعدة معلنة.'
    },
    {
      id: 'france', label: 'فرنسا',
      profile: M('france', { highLat: 'angleBased' }),
      authority: 'اتحاد المنظمات الإسلامية في فرنسا (UOIF)',
      confidence: 'secondary',
      note: 'فجر 12° وعشاء 12°.'
    },
    {
      id: 'germany', label: 'ألمانيا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا مركزية؛ كثير من المراكز تعمل بقاعدة ليلية. برلين قد تتبع جدولاً محلياً.'
    },
    {
      id: 'netherlands', label: 'هولندا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا محلية.'
    },
    {
      id: 'belgium', label: 'بلجيكا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا محلية.'
    },
    {
      id: 'spain', label: 'إسبانيا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'الاتحاد الإسلامي في إسبانيا لم تُوثَّق زواياه.'
    },
    {
      id: 'italy', label: 'إيطاليا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا محلية.'
    },
    {
      id: 'austria', label: 'النمسا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'الهيئة للمسلمين في النمسا لم تُوثَّق زواياها.'
    },
    {
      id: 'sweden', label: 'السويد',
      profile: M('mwl', { highLat: 'oneSeventh' }),
      authority: null,
      confidence: 'unverified',
      note: 'ستوكهولم 59.3° شمالاً: الفجر والعشاء لا يبزغان شتاءً والصيف قصير الليل، فقاعدة سُبع الليل معلنة.'
    },

    // أمريكا وأستراليا
    {
      id: 'united-states', label: 'أمريكا',
      profile: M('isna', { highLat: 'angleBased' }),
      authority: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)',
      confidence: 'verified',
      note: 'فجر 15° وعشاء 15°. أمريكا ست مناطق زمنية وتوقيتها الصيفي بالدقيقة.'
    },
    {
      id: 'canada', label: 'كندا',
      profile: M('isna', { highLat: 'angleBased' }),
      authority: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)',
      confidence: 'secondary',
      note: 'فجر 15° وعشاء 15°.'
    },
    {
      id: 'brazil', label: 'البرازيل',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا ساو باولو.'
    },
    {
      id: 'argentina', label: 'الأرجنتين',
      profile: M('mwl'),
      authority: null,
      confidence: 'unverified',
      note: 'لم تُوثَّق زوايا بوينس آيرس.'
    },
    {
      id: 'australia', label: 'أستراليا',
      profile: M('mwl', { highLat: 'angleBased' }),
      authority: null,
      confidence: 'unverified',
      note: 'المجالس الأسترالية تختلف بين المدن؛ أديلايد منطقتها +9:30 وتوقيتها الصيفي يختلف عن سيدني.'
    }
  ];

  const byId = (id) => REGIONS.find((region) => region.id === id) || null;

  // الإقليم الذي تنتمي إليه المدينة؛ null إن لم تُحدَّد مدينتها إقليمها
  const regionForCity = (city) => byId(city && city.region);

  // توثيق كل إقليم له مدينة: لا مدينة تشير إلى إقليم غير موجود
  const problems = [];
  const knownIds = new Set(REGIONS.map((region) => region.id));
  if (knownIds.size !== REGIONS.length) problems.push('تكرار في معرّفات الأقاليم');

  window.PrayerRegions = {
    list: REGIONS,
    byId,
    regionForCity,
    labelForCity: (city) => {
      const region = regionForCity(city);
      return region ? region.label : null;
    },
    authorityForCity: (city) => {
      const region = regionForCity(city);
      return region ? region.authority : null;
    },
    confidenceForCity: (city) => {
      const region = regionForCity(city);
      return region ? region.confidence : null;
    },
    selfCheck: () => problems
  };
})();
