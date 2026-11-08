/* منصة البيان — Service Worker للتشغيل دون اتصال */
const CORE_CACHE_NAME = 'bayan-pwa-v1.0.5';
const CONTENT_CACHE_NAME = 'bayan-content-v2';
const STATE_CACHE_NAME = 'bayan-state-v2';
const STATE_RECORD_URL = new URL('./offline-state.json', self.location).href;
const QUOTA_MARGIN_BYTES = 8 * 1024 * 1024;

/*
 * المصادر من قائمة مولَّدة زمن البناء، لا من يدوية في هذا الملف: صفحة أو أصل جديد
 * لا يستدعي تعديل العامل، والمسار وحده يبقى ثابتًا لأننا نعرفه قبل قراءة القائمة.
 */
const MANIFEST_URL = new URL('./data/offline-manifest.json', self.location).href;
const MANIFEST_SCHEMA = 'bayan-offline-manifest/1';
const KNOWN_TIERS = new Set(['core', 'content', 'optional']);

/*
 * scope التسجيل لا location العامل: الأخير عنوان الملف نفسه، ومنها تُحلّ روابط الجذر
 * فتصبح /service-worker.js بدل / على كل صفحة نسبية.
 */
function registrationScope() {
  return new URL(self.registration.scope);
}

// './' على نطاقٍ ينتهي دائمًا بشرطة، فجذر التطبيق يُشتقّ بلا تخمين لتركيب المسار
function scopeRootUrl() {
  return new URL('./', registrationScope()).href;
}

/* قائمة مشوَّهة لا تُستهلك نصف استهلاك: كل حقل لازم مفحوص قبل بناء أي خطة */
function parseOfflineManifest(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`قائمة الموارد ليست JSON صالحًا: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object') throw new Error('قائمة الموارد ليست كائنًا');
  if (manifest.schema !== MANIFEST_SCHEMA) throw new Error(`مخطط غير متوقع: ${String(manifest.schema)}`);
  if (typeof manifest.scope !== 'string' || !manifest.scope.startsWith('/')) throw new Error('scope مفقود أو غير جذري');
  if (!manifest.build || typeof manifest.build.buildId !== 'string') throw new Error('معرّف البناء مفقود');
  if (!Array.isArray(manifest.pages) || !manifest.pages.length) throw new Error('قائمة الصفحات فارغة');
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('قائمة الموارد فارغة');
  for (const page of manifest.pages) {
    if (!page || typeof page.url !== 'string' || !page.url.startsWith('/')) throw new Error('صفحة بلا مسار مطلق');
  }
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.url !== 'string' || !asset.url.startsWith('/')) throw new Error('مورد بلا مسار مطلق');
    if (!KNOWN_TIERS.has(asset.tier)) throw new Error(`طبقة غير معروفة ${String(asset.tier)} عند ${asset.url}`);
    if (typeof asset.required !== 'boolean') throw new Error(`required غير منطقي عند ${asset.url}`);
  }

  const content = manifest.content;
  if (content !== null) {
    if (!content || typeof content !== 'object') throw new Error('المحتوى ليس كائنًا ولا null');
    for (const key of ['url', 'checksumUrl', 'metadataUrl']) {
      if (typeof content[key] !== 'string' || !content[key].startsWith('/')) throw new Error(`المحتوى بلا ${key} مطلق`);
    }
    if (!Number.isInteger(content.surahs) || content.surahs < 1) throw new Error('عدد السور في القائمة غير صالح');
    if (!Number.isInteger(content.verses) || content.verses < 1) throw new Error('عدد الآيات في القائمة غير صالح');
    if (content.downloadRequests !== 1) throw new Error('المصحف يجب أن يبقى تنزيلًا واحدًا');
  }
  return manifest;
}

/*
 * تصنيفات القائمة هي طبقات S1: core+required يؤجّل التفعيل عند إخفاقه، والباقي
 * يُخزَّن ولا يُبطل الدورة، وcontent لا يدخل القائمة إذ تدقيقه في جهة أخرى.
 */
function buildInstallPlan(manifest) {
  const scope = registrationScope();
  const coreUrls = [scopeRootUrl()];
  const optionalUrls = [];
  const seen = new Set(coreUrls);

  for (const asset of manifest.assets) {
    const url = new URL(asset.url, scope).href;
    // القائمة خُزِّنت من النسخة التي جلبناها: لا طلب ثانٍ عليها ولا مفتاح مكرَّر
    if (url === MANIFEST_URL || seen.has(url)) continue;
    seen.add(url);
    if (asset.tier === 'content') continue;
    if (asset.tier === 'core' && asset.required) coreUrls.push(url);
    else optionalUrls.push(url);
  }

  const quran = manifest.content ? {
    textUrl: new URL(manifest.content.url, scope).href,
    checksumUrl: new URL(manifest.content.checksumUrl, scope).href,
    metadataUrl: new URL(manifest.content.metadataUrl, scope).href,
    textPath: new URL(manifest.content.url, scope).pathname,
    surahs: manifest.content.surahs,
    verses: manifest.content.verses
  } : null;

  return { manifest, coreUrls, optionalUrls, quran };
}

async function fetchManifestText() {
  const response = await fetch(new Request(MANIFEST_URL, { cache: 'reload' }));
  if (!response.ok) throw new Error(`قائمة الموارد غير متاحة (${response.status})`);
  return await response.text();
}

// المخزَّنة أولًا: التنشيط وطلبات الصفحات يقرؤونها دون طلب شبكة زائد بعد التثبيت
async function readManifestText() {
  const cached = await caches.match(MANIFEST_URL);
  if (cached) return await cached.text();
  return await fetchManifestText();
}

let installPlan = null;
let planRequest = null;

// وعدٌ جارٍ واحد: قارئ واحد للقائمة في أي لحظة، والإخفاق لا يُخزَّن كي لا يُورَّث
function getInstallPlan() {
  if (installPlan) return Promise.resolve(installPlan);
  if (!planRequest) {
    planRequest = readManifestText()
      .then((text) => buildInstallPlan(parseOfflineManifest(text)))
      .then((plan) => {
        installPlan = plan;
        planRequest = null;
        return plan;
      })
      .catch((error) => {
        planRequest = null;
        throw error;
      });
  }
  return planRequest;
}

// مقارنة بالمسار لا بالرابط الحرفي: نسخة تساؤل كانت لتخزَّن نيابة عن طبقة المحتوى بلا تدقيق
function isQuranDataset(request, plan) {
  if (!plan || !plan.quran) return false;
  const url = new URL(request.url);
  return url.href === plan.quran.textUrl || url.pathname === plan.quran.textPath;
}

async function storeShellEntry(cache, url) {
  const request = new Request(url, { cache: 'reload' });
  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`تعذّر تخزين ملف التطبيق: ${url} (${response.status})`);
  }

  if (response.redirected) {
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    const body = await response.blob();
    await cache.put(request, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers
    }));
    return;
  }

  await cache.put(request, response);
}

function rejectNames(urls, results) {
  return urls.filter((url, index) => results[index].status === 'rejected');
}

/*
 * التثبيت من القائمة المولَّدة: تعذّر جلبها أو تحليلها إخفاق نواة صريح لا رجوع فيه
 * إلى يدوية قديمة — يدوية قديمة تُثبّت موردًا محذوفًا وتُبقي التفعيل وهميًا.
 */
async function installShell() {
  const report = { coreFailed: [], optionalFailed: [], blocked: false, manifest: null };
  let cache = null;
  try {
    cache = await caches.open(CORE_CACHE_NAME);
  } catch (error) {
    report.blocked = true;
  }

  if (cache) {
    let plan = null;
    try {
      const text = await fetchManifestText();
      plan = buildInstallPlan(parseOfflineManifest(text));
      // القائمة تُخزَّن من النص الذي قرأناه: طلب ثانٍ عليها كان ليُثبّت دورةً بمخزن لم يُقرأ بعد
      await cache.put(MANIFEST_URL, new Response(text, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
      installPlan = plan;
      report.manifest = {
        status: 'loaded', buildId: plan.manifest.build.buildId,
        pages: plan.manifest.pages.length, assets: plan.manifest.assets.length,
        core: plan.coreUrls.length, optional: plan.optionalUrls.length
      };
    } catch (error) {
      report.manifest = { status: 'failed', error: String((error && error.message) || error) };
      report.coreFailed = [MANIFEST_URL];
    }

    if (plan) {
      const core = await Promise.allSettled(plan.coreUrls.map((url) => storeShellEntry(cache, url)));
      const optional = await Promise.allSettled(plan.optionalUrls.map((url) => storeShellEntry(cache, url)));
      report.coreFailed = rejectNames(plan.coreUrls, core);
      report.optionalFailed = rejectNames(plan.optionalUrls, optional);
    }
  }

  await writeState({ shell: report });
  return report;
}

self.addEventListener('install', (event) => {
  event.waitUntil(installShell().then((report) => {
    // نواة ناقصة تفعيلٌ مؤجَّل لا نسخة محطومة: العاملة تبقى مسيطرة حتى دورة سليمة
    if (!report.blocked && report.coreFailed.length === 0) return self.skipWaiting();
  }));
});

async function keepStorageAvailable() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch (error) {
    // دوام التخزين تحسين بلا واجهة؛ رفضه لا يوقف الخدمة
  }
}

function isBayanOwned(key) {
  return key.startsWith('bayan-pwa-') || key.startsWith('bayan-core-') ||
    key.startsWith('bayan-content-') || key.startsWith('bayan-state-');
}

// مخازن غيرنا لا تُمسّ. مخزن المحتوى يُستبدل بعد تحقَّق البديل لا قبله، فلا يُهدَّم عمل قائم.
async function pruneReplacedShellCaches() {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => isBayanOwned(key) && key !== CORE_CACHE_NAME &&
      key !== STATE_CACHE_NAME && !key.startsWith('bayan-content-'))
    .map((key) => caches.delete(key)));
}

async function pruneReplacedContentCaches() {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith('bayan-content-') && key !== CONTENT_CACHE_NAME)
    .map((key) => caches.delete(key)));
}

/*
 * دورة بلا قائمة إخفاقٌ عابر لا قدرٌ نهائي: قائمة وصلت متأخرة كانت تُترك والعامل يخدم
 * صفحاته من مخزن فارغ حتى يتغيّر حرف في السكربت. محاولة واحدة عند التنشيط لا حلقة فيها.
 */
let shellRetried = false;

async function activateVersion() {
  await keepStorageAvailable();
  await pruneReplacedShellCaches();
  if (!installPlan && !shellRetried) {
    shellRetried = true;
    await installShell();
  }
  await self.clients.claim();
  // التحضير الثقيل لا يحجز التنشيط: إن أنهى المتصفح العامل في أثنائه تُستأنف الدورة زيارةً تالية
  // بلا خطة لا مسار لمصحف يُحضَّر؛ القراءة عند الطلب تتكفّل إن وصلت القائمة لاحقًا
  if (installPlan) prepareRequiredContent();
}

self.addEventListener('activate', (event) => {
  event.waitUntil(activateVersion());
});

async function readState() {
  try {
    const cache = await caches.open(STATE_CACHE_NAME);
    const record = await cache.match(STATE_RECORD_URL);
    return record ? await record.json() : {};
  } catch (error) {
    return {};
  }
}

async function writeState(patch) {
  const next = Object.assign({}, await readState(), patch, { updatedAt: Date.now() });
  try {
    const cache = await caches.open(STATE_CACHE_NAME);
    await cache.put(STATE_RECORD_URL, new Response(JSON.stringify(next), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }));
  } catch (error) {
    // الحالة استئناف وتشخيص، لا شيء يُعرض منها للمستخدم
  }
  return next;
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// صيغة sha256sum المعروفة: بصمة ثم فراغ ثم مسار. لا تُخترع مرجعية بديلة عند تعذّر القراءة.
function parseChecksumRecord(text) {
  const match = /^ *([0-9a-f]{64})(?= |$)/i.exec(String(text || '').trim());
  return match ? match[1].toLowerCase() : null;
}

// ملفا الدعم صغيران ومخزَّنان مع النواة: قراءتهما من المخزنة بلا طلب شبكة زائد
async function readShellFileText(relativeUrl) {
  const url = new URL(relativeUrl, self.location).href;
  const cached = await caches.match(url);
  if (cached) return await cached.text();

  const response = await fetch(new Request(url, { cache: 'reload' }));
  if (!response.ok) throw new Error(`ملف دعم المصحف غير متاح (${response.status})`);
  return await response.text();
}

function validateDataset(text, metadataText, dataset) {
  const perSurah = new Map();
  const seen = new Set();
  let verses = 0;

  for (const line of text.split('\n')) {
    if (!/^\d+\|\d+\|/.test(line)) continue;
    const first = line.indexOf('|');
    const second = line.indexOf('|', first + 1);
    const surah = Number(line.slice(0, first));
    const ayah = Number(line.slice(first + 1, second));
    const body = line.slice(second + 1);
    if (!Number.isInteger(surah) || !Number.isInteger(ayah) || ayah < 1 || !body.trim()) {
      throw new Error('سطر آية غير صالح');
    }
    const key = `${surah}:${ayah}`;
    if (seen.has(key)) throw new Error(`آية مكرَّرة عند ${key}`);
    seen.add(key);
    perSurah.set(surah, (perSurah.get(surah) || 0) + 1);
    verses += 1;
  }

  if (verses !== dataset.verses) {
    throw new Error(`عدد الآيات ${verses} بدل ${dataset.verses}`);
  }

  const suras = [...metadataText.matchAll(/<sura index="(\d+)" ayas="(\d+)"/g)];
  if (suras.length !== dataset.surahs) throw new Error(`بيانات السور فيها ${suras.length} سورة`);
  if (perSurah.size !== dataset.surahs) throw new Error(`النص يغطي ${perSurah.size} سورة`);

  for (const match of suras) {
    const id = Number(match[1]);
    const expected = Number(match[2]);
    const found = perSurah.get(id) || 0;
    // عدّة آيات مساوية لعددها المنشور ومفاتيح فريدة ضمن ١..n: لا فجوة ولا تكرار
    if (found !== expected) throw new Error(`سورة ${id}: ${found} آية بدل ${expected}`);
  }

  return { surahs: suras.length, verses };
}

async function hasRoomFor(byteLength) {
  try {
    const estimate = await navigator.storage.estimate();
    if (!estimate || !estimate.quota) return true;
    return (estimate.quota - (estimate.usage || 0)) > byteLength + QUOTA_MARGIN_BYTES;
  } catch (error) {
    return true;
  }
}

async function verifiedCopy(dataset) {
  try {
    const cache = await caches.open(CONTENT_CACHE_NAME);
    return await cache.match(dataset.textUrl);
  } catch (error) {
    return undefined;
  }
}

// لا يُعاد تنزيل ما تحقَّق منه، ولا تُمسح نسخة سابقة عند إخفاق لاحقة: الكتابة بعد التحقق فقط.
async function prepareQuranDataset(dataset) {
  const state = await readState();
  const existing = await verifiedCopy(dataset);
  const previous = state.quran || {};

  if (existing) {
    if (previous.status !== 'verified') await writeState({ quran: Object.assign({}, previous, { status: 'verified' }) });
    return { verified: true, reused: true };
  }

  const attempts = (previous.attempts || 0) + 1;
  try {
    const expectedSha = parseChecksumRecord(await readShellFileText(dataset.checksumUrl));
    if (!expectedSha) throw new Error('ملف التحقق لا يحمل بصمة صالحة');

    const response = await fetch(new Request(dataset.textUrl, { cache: 'reload' }));
    if (!response.ok) throw new Error(`استجابة الشبكة ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) throw new Error('تنزيل فارغ');

    const actualSha = await sha256Hex(buffer);
    if (actualSha !== expectedSha) throw new Error(`بصمة غير مطابقة: ${actualSha}`);

    // فك الترميز بشروط صارمة: تنزيل مقطوع عند حدّ حرف عربي يفشل هنا لا في القارئ
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    const counts = validateDataset(text, await readShellFileText(dataset.metadataUrl), dataset);

    if (!(await hasRoomFor(buffer.byteLength))) throw new Error('لا مساحة مخزَّنة تكفي للمصحف');

    const cache = await caches.open(CONTENT_CACHE_NAME);
    await cache.put(dataset.textUrl, new Response(buffer, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }));

    await writeState({ quran: {
      status: 'verified', sha256: actualSha, bytes: buffer.byteLength,
      surahs: counts.surahs, verses: counts.verses, attempts,
      lastError: null, preparedAt: Date.now()
    } });
    await pruneReplacedContentCaches();
    return { verified: true, prepared: true, sha256: actualSha, ...counts };
  } catch (error) {
    await writeState({ quran: Object.assign({}, previous, {
      status: 'failed', attempts, lastError: String((error && error.message) || error), failedAt: Date.now()
    }) });
    return { verified: false, error: String((error && error.message) || error) };
  }
}

let contentPreparation = null;

// وعدٌ جارٍ واحد في أي لحظة: التنشيط وطلب الصفحة يتشاركان التنزيل نفسه بدل نسختين متوازيتين.
// الخطة تُقرأ هنا: لا تحضير لمصحفٍ لا نعرف مساره، وإخفاق القراءة تشخيص لا وعد مرفوض.
function prepareRequiredContent() {
  if (!contentPreparation) {
    contentPreparation = getInstallPlan()
      .then((plan) => (plan.quran
        ? prepareQuranDataset(plan.quran)
        : { verified: false, error: 'القائمة لا تحمل طبقة محتوى' }))
      .catch((error) => ({ verified: false, error: String((error && error.message) || error) }))
      .finally(() => {
        contentPreparation = null;
      });
  }
  return contentPreparation;
}

// الاستجابة المُصنَّعة تُنهِي الخدمة بلا وعد مرفوض: المتصفح يقرأ رمزًا فعليًا بدل ERR_FAILED الغامض
function networkErrorResponse(reason) {
  return new Response(reason, {
    status: 504,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

// تخزين نسخة لا يُبطل الاستجابة: تعذّر الكتابة (حصة أو محتوى غير قابل للتخزين) يُلجم هنا
async function storeQuietly(request, response) {
  try {
    const cache = await caches.open(CORE_CACHE_NAME);
    await cache.put(request, response);
  } catch (error) {
    // المخزّن مكمل للخدمة لا شرط لها
  }
}

async function respondToNavigation(request) {
  let cached;
  try {
    cached = await caches.match(request, { ignoreSearch: true });
  } catch (error) {
    cached = undefined;
  }
  if (cached) return cached;

  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    return networkErrorResponse('لا اتصال، ولا توجد نسخة مخزّنة من هذه الصفحة.');
  }

  if (!response) return networkErrorResponse('استجابة غير صالحة من الشبكة.');

  if (response.ok && response.type === 'basic') {
    await storeQuietly(request, response.clone());
  }
  return response;
}

async function respondToResource(request) {
  let cached;
  try {
    cached = await caches.match(request);
  } catch (error) {
    cached = undefined;
  }
  if (cached) return cached;

  // الخطة قبل الشبكة: بلا تصنيف معروف لا نحتفظ بنسخة قد تكون طبقة محتوى غير مدققة
  const plan = await getInstallPlan().catch(() => null);

  // طبقة المحتوى: النسخة المقبولة الوحيدة متحقَّق منها، والتصفح نفسه يشغّل تحضيرها لا يخزَّن نيابة عنه
  if (isQuranDataset(request, plan)) {
    const preparation = await prepareRequiredContent();
    if (preparation.verified) {
      const verified = await verifiedCopy(plan.quran);
      if (verified) return verified;
    }
  }

  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    return networkErrorResponse('لا اتصال، ولا توجد نسخة مخزّنة من هذا المورد.');
  }

  if (!response) return networkErrorResponse('استجابة غير صالحة من الشبكة.');

  if (plan && response.status === 200 && response.type === 'basic' && !isQuranDataset(request, plan)) {
    await storeQuietly(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  // روابط المصحف قد تحتوي على ?surah و ?ayah؛ ملف الصفحة المخزّن نفسه صالح لها.
  event.respondWith(request.mode === 'navigate'
    ? respondToNavigation(request)
    : respondToResource(request));
});
