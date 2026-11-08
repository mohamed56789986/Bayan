#!/usr/bin/env node
/*
 * منصة البيان — مولّد قائمة الموارد دون اتصال
 * يكتشف الصفحات العامة من الشجر نفسه ثم يتتبع مراجعها زمن التشغيل فقط:
 * لا قائمة يدوية ثانية، ولا ملف يُدرَج لمجرد وجوده على القرص.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(TOOLS_DIR, '..');
const OUT_RELATIVE = 'data/offline-manifest.json';
const SCHEMA = 'bayan-offline-manifest/1';
const IGNORED_DIRS = new Set(['.git', '.vercel', 'node_modules', 'tools', 'scratch', 'dist', '.next']);
const SCANNED_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.webmanifest']);
const FORBIDDEN_REFERENCES = ['refrences.html'];

const argv = process.argv.slice(2);
const ROOT = path.resolve(optionValue('--root') || DEFAULT_ROOT);
const CHECK_ONLY = argv.includes('--check');
const QUIET = argv.includes('--quiet');

function optionValue(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const KINDS = new Map(Object.entries({
  '.html': { type: 'document', tier: 'core', required: true, role: 'page' },
  '.css': { type: 'stylesheet', tier: 'core', required: true, role: 'style' },
  '.js': { type: 'script', tier: 'core', required: true, role: 'script' },
  '.webmanifest': { type: 'manifest', tier: 'core', required: true, role: 'pwa-manifest' },
  '.json': { type: 'data', tier: 'core', required: true, role: 'runtime-data' },
  '.xml': { type: 'data', tier: 'core', required: true, role: 'runtime-data' },
  '.txt': { type: 'dataset', tier: 'content', required: true, role: 'quran-dataset' },
  '.sha256': { type: 'integrity', tier: 'core', required: true, role: 'integrity-artifact' },
  '.woff2': { type: 'font', tier: 'optional', required: false, role: 'font' },
  '.woff': { type: 'font', tier: 'optional', required: false, role: 'font' },
  '.png': { type: 'image', tier: 'optional', required: false, role: 'icon' },
  '.jpg': { type: 'image', tier: 'optional', required: false, role: 'image' },
  '.webp': { type: 'image', tier: 'optional', required: false, role: 'image' },
  '.svg': { type: 'image', tier: 'optional', required: false, role: 'image' },
  '.md': { type: 'document', tier: 'optional', required: false, role: 'linked-document' }
}));

const ROLE_OVERRIDES = new Map(Object.entries({
  'data/quran-metadata.xml': 'quran-metadata',
  'data/quran-uthmani.txt': 'quran-dataset',
  'data/quran-uthmani.sha256': 'quran-integrity',
  'assets/icons/header-logo.webp': 'shared-logo',
  'css/style.css': 'shared-style',
  'manifest.webmanifest': 'pwa-manifest'
}));

/*
 * الشعار في رأس كل صفحة عامة: لا بديل له عند الغياب، فالدور يفرض طبقة النواة
 * ولا يُترك لقرار الامتداد الشكلي (صور = اختياري).
 */
const CORE_ROLES = new Set(['shared-logo']);

const EXTERNAL = /^(https?:|data:|blob:|mailto:|tel:|javascript:|about:|#)/i;
const TAG_PATTERN = /<(a|link|script|img|source|audio|video|use)\b([^>]*)>/gi;
const ATTRIBUTE_PATTERN = /\b(href|src|srcset|rel)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const CSS_URL_PATTERN = /url\(\s*("([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
const CSS_IMPORT_PATTERN = /@import\s+(?:"([^"]*)"|'([^']*)')/g;
const STRING_LITERAL_PATTERN = /(['"`])((?:\.{1,2}\/|\/)?[\w./-]+\.(?:json|txt|xml|md|css|png|webp|jpg|jpeg|svg|woff2?|geojson))\1/gi;

function walk(dir, prefix = '', out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(path.join(dir, entry.name), relative, out);
    } else if (entry.isFile()) {
      out.push(relative);
    }
  }
  return out;
}

/*
 * ما داخل التعليق ليس اعتمادًا زمن تشغيل: مرجع صيانة إلى ملف التراخيص
 * كان سيُدخل ملفًا لا يطلبه أحد من المتصفح.
 */
function stripComments(source, extension) {
  if (extension === '.html' || extension === '.css' || extension === '.js' || extension === '.mjs') {
    return source
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|\n)\s*(\/\/|\*)[^\n]*/g, '$1 ');
  }
  return source;
}

function normalize(raw) {
  if (!raw) return null;
  const value = String(raw).trim().replace(/\\/g, '/');
  if (!value || EXTERNAL.test(value) || value.includes('${') || value.includes('{{')) return null;
  const target = value.split('#')[0].split('?')[0];
  return target || null;
}

/* مسار المرجع يُحلّ من مجلد الملف الذي يحويه؛ المرجع المطلق من جذر النطاق */
function resolvePath(baseDir, reference) {
  const normalized = normalize(reference);
  if (!normalized) return null;
  const joined = normalized.startsWith('/')
    ? normalized.replace(/^\/+/, '')
    : path.posix.join(baseDir || '.', normalized);
  return path.posix.normalize(joined).replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
}

function kindFor(file) {
  const base = KINDS.get(path.extname(file).toLowerCase());
  if (!base) return null;
  const role = ROLE_OVERRIDES.get(file) || base.role;
  const promoted = CORE_ROLES.has(role) ? { tier: 'core', required: true } : null;
  return { ...base, ...promoted, role };
}

function hashFile(absolute) {
  const buffer = fs.readFileSync(absolute);
  return { sha256: crypto.createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

const allFiles = walk(ROOT);
const fileSet = new Set(allFiles);
const pages = allFiles.filter((file) => file.endsWith('.html')).sort();
const edges = new Map();
const navigationLinks = [];
const brokenLoadRefs = [];
const brokenNavigation = [];

function addEdge(from, to, kind, reference) {
  if (to === 'service-worker.js') return;
  if (!fileSet.has(to)) {
    const record = { from, reference, expected: `/${to}`, kind };
    (kind === 'navigation' ? brokenNavigation : brokenLoadRefs).push(record);
    return;
  }
  // التنقل رابط الصفحة التالية لا اعتماد تحميل: لا يسحب اعتماداتها معه
  if (kind === 'navigation') return;
  if (!edges.has(from)) edges.set(from, new Set());
  edges.get(from).add(to);
}

function referencesInFile(file) {
  const extension = path.extname(file).toLowerCase();
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const source = stripComments(raw, extension);
  const ownDir = path.posix.dirname(file) === '.' ? '' : path.posix.dirname(file);
  const found = [];

  for (const match of source.matchAll(TAG_PATTERN)) {
    const tag = match[1].toLowerCase();
    const attributes = {};
    for (const attribute of match[2].matchAll(ATTRIBUTE_PATTERN)) {
      attributes[attribute[1].toLowerCase()] = attribute[3] ?? attribute[4] ?? '';
    }
    const loads = [];
    if (attributes.srcset) loads.push(...attributes.srcset.split(',').map((part) => part.trim().split(/\s+/)[0]));
    if (attributes.src) loads.push(attributes.src);
    if (attributes.href && tag !== 'a') loads.push(attributes.href);
    for (const candidate of loads) {
      const resolved = resolvePath(ownDir, candidate);
      if (resolved) found.push({ file: resolved, kind: tag, reference: candidate });
    }
    if (tag === 'a' && attributes.href) {
      const resolved = resolvePath(ownDir, attributes.href);
      if (resolved) found.push({ file: resolved, kind: 'navigation', reference: attributes.href });
    }
  }

  if (extension === '.css') {
    for (const match of source.matchAll(CSS_URL_PATTERN)) {
      const value = (match[2] || match[3] || match[4] || '').trim();
      const resolved = resolvePath(ownDir, value);
      if (resolved) found.push({ file: resolved, kind: 'css-url', reference: value });
    }
    for (const match of source.matchAll(CSS_IMPORT_PATTERN)) {
      const value = match[1] || match[2] || '';
      const resolved = resolvePath(ownDir, value);
      if (resolved) found.push({ file: resolved, kind: 'css-import', reference: value });
    }
  }

  if (extension !== '.webmanifest') {
    for (const match of source.matchAll(STRING_LITERAL_PATTERN)) {
      const resolved = resolvePath(ownDir, match[2]);
      if (resolved) found.push({ file: resolved, kind: 'literal', reference: match[2] });
    }
  }

  if (extension === '.webmanifest') {
    try {
      const parsed = JSON.parse(raw);
      for (const icon of parsed.icons || []) {
        const resolved = resolvePath(ownDir, icon.src || '');
        if (resolved) found.push({ file: resolved, kind: 'pwa-icon', reference: icon.src });
      }
    } catch (error) {
      brokenLoadRefs.push({ from: file, reference: file, expected: file, kind: `invalid-webmanifest: ${error.message}` });
    }
  }

  return found;
}

for (const file of allFiles) {
  if (!SCANNED_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
  if (file === 'service-worker.js') continue;
  for (const reference of referencesInFile(file)) {
    addEdge(file, reference.file, reference.kind, reference.reference);
    if (reference.kind === 'navigation') navigationLinks.push({ from: file, to: reference.file, reference: reference.reference });
  }
}

function transitive(start) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const next of edges.get(current) || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

const pageClosure = new Map();
for (const page of pages) pageClosure.set(page, transitive(page));

const assetPages = new Map();
function relate(asset, page) {
  if (!assetPages.has(asset)) assetPages.set(asset, new Set());
  assetPages.get(asset).add(page);
}
for (const [page, closure] of pageClosure) for (const file of closure) relate(file, page);

/* مستندات يربطها المستخدم صراحةً وتوجد فعليًا: تغطية دون اتصال بلا إدراج لكل ملف */
for (const link of navigationLinks) {
  if (link.to.endsWith('.html') || !fileSet.has(link.to)) continue;
  relate(link.to, link.from);
}

const reachable = [...assetPages.keys()].sort();
// مسار مذكور ولا نعرف نوعه: لا يُسقط بصمت، بل يُبلَّغ
const unlistedReachable = reachable.filter((file) => !kindFor(file));
/*
 * القائمة لا تُدرَج داخل مواردها: بصمتها تصبح بصمة نسخة سابقة وحجمها حجمها السابق،
 * فتتغير كل دورة بلا تغيير في المصدر. Service Worker يطلبها من مسار ثابت معلوم له.
 */
const inventorySources = reachable.filter((file) => file !== OUT_RELATIVE);
const assets = inventorySources.map((file) => {
  const kind = kindFor(file);
  if (!kind) return null;
  return {
    url: `/${file}`,
    type: kind.type,
    tier: kind.tier,
    required: kind.required,
    role: kind.role,
    ...hashFile(path.join(ROOT, file)),
    pages: [...assetPages.get(file)].sort()
  };
}).filter(Boolean);

/*
 * ملف البصمة جوار النص لا تصله أي صفحة: الذي يقرأه Service Worker قبل التخزين،
 * فيُكتشف بقرنه باسم ملف المصحف لا بإدراجه في يدوية ثانية.
 */
const dataset = assets.find((asset) => asset.role === 'quran-dataset');
if (dataset) {
  const paired = `${dataset.url.slice(1).replace(/\.txt$/i, '')}.sha256`;
  if (fileSet.has(paired) && !assets.some((asset) => asset.url === `/${paired}`)) {
    const kind = kindFor(paired);
    assets.push({
      url: `/${paired}`,
      type: kind.type,
      tier: kind.tier,
      required: kind.required,
      role: kind.role,
      ...hashFile(path.join(ROOT, paired)),
      pages: dataset.pages.slice()
    });
    assets.sort((a, b) => a.url.localeCompare(b.url));
  }
}

const quranText = assets.find((asset) => asset.role === 'quran-dataset');
const quranMetadata = assets.find((asset) => asset.role === 'quran-metadata');
const quranChecksum = assets.find((asset) => asset.role === 'quran-integrity');

/* عدد السور والآيات مستقًى من بيانات السور نفسها، لا رقم يدسي في المولّد */
let expectations = null;
if (quranMetadata) {
  const xml = fs.readFileSync(path.join(ROOT, quranMetadata.url.slice(1)), 'utf8');
  const suras = [...xml.matchAll(/<sura index="(\d+)" ayas="(\d+)"/g)];
  expectations = { surahs: suras.length, verses: suras.reduce((total, match) => total + Number(match[2]), 0) };
}

const manifest = {
  schema: SCHEMA,
  scope: '/',
  entry: '/index.html',
  // لا طابع زمني: نفس المصدر يعطي نفس الملفات بايت ببايت، وبصمة البناء وحدها تُعرّف الدورة
  build: { buildId: '', generator: 'tools/build-offline-manifest.mjs' },
  pages: pages.map((page) => ({
    url: `/${page}`,
    required: true,
    dependsOn: [...(pageClosure.get(page) || [])].filter((file) => file !== page).sort().map((file) => `/${file}`)
  })),
  assets,
  content: expectations && quranText ? {
    url: quranText.url,
    checksumUrl: quranChecksum ? quranChecksum.url : null,
    metadataUrl: quranMetadata ? quranMetadata.url : null,
    downloadRequests: 1,
    surahs: expectations.surahs,
    verses: expectations.verses
  } : null
};

manifest.build.buildId = crypto.createHash('sha256')
  .update(JSON.stringify({ pages: manifest.pages, assets: manifest.assets, content: manifest.content }))
  .digest('hex').slice(0, 16);

/* ------------------------------------------------------------------ validation */
const errors = [];
const warnings = [];

for (const file of unlistedReachable) warnings.push(`مرجع قائم بلا نوع معروف، لم يُدرَج: /${file}`);
// المقارنة بالقائمة النهائية: الأصل المقترن لا يتيم لمجرد أن لا صفحة تشير إليه
const listedFiles = new Set(assets.map((asset) => asset.url.slice(1)));
const buildOwnFiles = new Set([OUT_RELATIVE, 'service-worker.js']);
for (const orphan of allFiles.filter((file) => !listedFiles.has(file) && !file.endsWith('.html') &&
  !['.gitignore', '_headers', 'vercel.json'].includes(file) && !buildOwnFiles.has(file))) {
  // القائمة يقرأها Service Worker من مسار ثابت، وService Worker يُسجَّل برمجيًا ولا يخزّن نفسه
  if (orphan.startsWith('.')) continue;
  warnings.push(`ملف على القرص لا تصله أي صفحة عامة: /${orphan}`);
}

for (const broken of brokenLoadRefs) {
  errors.push(`مرجع تحميل لا ملف له: ${broken.from} → ${broken.reference} (توقّع ${broken.expected}) [${broken.kind}]`);
}
const seenNavigation = new Set();
for (const broken of brokenNavigation) {
  const key = `${broken.from}|${broken.reference}`;
  if (seenNavigation.has(key)) continue;
  seenNavigation.add(key);
  warnings.push(`رابط تنقّل لا هدف له: ${broken.from} → ${broken.reference}`);
}

for (const page of pages) {
  const text = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const forbidden of FORBIDDEN_REFERENCES) {
    if (text.includes(forbidden)) errors.push(`مرجع لمسار محذوف ${forbidden} داخل ${page}`);
  }
}

const assetByURL = new Map(assets.map((asset) => [asset.url, asset]));

for (const asset of assets.filter((entry) => entry.tier === 'core' && entry.required)) {
  if (!fs.existsSync(path.join(ROOT, asset.url.slice(1)))) errors.push(`ملف إنتاج مطلوب مفقود: ${asset.url}`);
}
// في وضع الفحص نُفحص مخرَجًا بُنيَ فعلًا: قائمة بلا ملف عليها تعني تثبيتًا بلا خطة
if (CHECK_ONLY && !fs.existsSync(path.join(ROOT, OUT_RELATIVE))) errors.push(`ملف إنتاج مطلوب مفقود: /${OUT_RELATIVE}`);

for (const page of manifest.pages) {
  for (const dependency of page.dependsOn) {
    if (!fileSet.has(dependency.slice(1))) errors.push(`اعتماد صفحة إلى ملف مفقود: ${page.url} → ${dependency}`);
    if (!assetByURL.has(dependency)) errors.push(`اعتماد صفحة غير ممثّل بأصل في القائمة: ${page.url} → ${dependency}`);
  }
  if (!assets.some((asset) => asset.url === page.url)) errors.push(`صفحة عامة غير مغطاة في القائمة: ${page.url}`);
}
if (assetByURL.has(`/${OUT_RELATIVE}`)) errors.push(`القائمة تُدرج نفسها داخل مواردها: /${OUT_RELATIVE}`);

const textCount = assets.filter((asset) => asset.role === 'quran-dataset').length;
if (textCount !== 1) errors.push(`المصحف يجب أن يمثَّل بأصل واحد، والعدد ${textCount}`);
if (!quranMetadata) errors.push('quran-metadata.xml غير ممثّل رغم أنه اعتماد زمن تشغيل للقارئ');
if (!quranChecksum) errors.push('quran-uthmani.sha256 غير ممثّل وهو مرجعية السلامة');
if (assets.some((asset) => /\/(surah|sura)[-_]?\d+\.json$/i.test(asset.url) || /\/quran\/\d+\.(json|txt)$/i.test(asset.url))) {
  errors.push('القائمة تفتح تقسيم المصحف إلى ملفات سور: ممنوع في هذه المعمارية');
}

if (quranText && quranChecksum) {
  const recorded = fs.readFileSync(path.join(ROOT, quranChecksum.url.slice(1)), 'utf8').trim();
  const match = /^ *([0-9a-f]{64})(?= |$)/i.exec(recorded);
  if (!match) errors.push(`ملف البصمة لا يحمل قيمة صالحة: ${quranChecksum.url}`);
  else if (match[1].toLowerCase() !== quranText.sha256) {
    errors.push(`بصمة ${quranText.url} (= ${quranText.sha256}) لا تطابق ${quranChecksum.url} (= ${match[1]})`);
  }
}

const logo = assets.find((asset) => asset.role === 'shared-logo');
if (!logo) errors.push('الشعار المشترك header-logo.webp غير ممثّل');
else if (logo.tier !== 'core' || !logo.required) errors.push(`الشعار المشترك في طبقة ${logo.tier}/غير مطلوب وهو رأس كل صفحة`);
const fonts = assets.filter((asset) => asset.type === 'font');
if (!fonts.length) errors.push('لا خطّ في القائمة: الطباعة تتكسر دون اتصال');
for (const needed of ['cairo-arabic-600', 'cairo-arabic-400', 'amiri-arabic-700']) {
  if (!fonts.some((asset) => asset.url.includes(needed))) errors.push(`خط ${needed} مستخدم في الأنماط وغير ممثّل`);
}

/*
 * الخط يبقى اختياريًا فقط إذا كان السند النظامي موثوقًا: كل سلسلة خط تنتهي
 * بعارف عام. لا تُدرَج الخطوط في النواة بدل التحقق من هذا الشرط.
 */
const GENERIC_FONT_FAMILIES = /(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|math|emoji)\s*$/i;
const styleEntry = assetByURL.get('/css/style.css');
if (styleEntry) {
  const css = fs.readFileSync(path.join(ROOT, styleEntry.url.slice(1)), 'utf8');
  const chains = new Map();
  for (const match of css.matchAll(/(--font-[\w-]+)\s*:\s*([^;}]+)[;]/g)) chains.set(match[1], match[2].trim());
  for (const [name, value] of chains) {
    const resolved = value.replace(/var\((--font-[\w-]+)\)/g, (whole, inner) => chains.get(inner) || whole);
    if (!GENERIC_FONT_FAMILIES.test(resolved)) errors.push(`سلسلة الخط ${name} لا تنتهي بعارف عام: ${value}`);
  }
}

for (const asset of assets) {
  if (/^\/(tools|scratch|node_modules)\//.test(asset.url) || /\.(test|spec)\.js$/.test(asset.url) || asset.url.endsWith('.map')) {
    errors.push(`ملف تطويري تسرّب إلى القائمة: ${asset.url}`);
  }
  if (!asset.pages.length) errors.push(`أصل بلا صفحة مرجعة إليه: ${asset.url}`);
}

const totals = {
  pages: manifest.pages.length,
  assets: assets.length,
  coreRequired: assets.filter((a) => a.tier === 'core' && a.required).length,
  coreOptional: assets.filter((a) => a.tier === 'core' && !a.required).length,
  optional: assets.filter((a) => a.tier === 'optional').length,
  content: assets.filter((a) => a.tier === 'content').length,
  bytes: assets.reduce((total, asset) => total + asset.bytes, 0)
};

// بناء أحمر لا يخلّف قائمة يثبّتها Service Worker: لا يُكتب مخرج مع عيب تحقّق
const written = !CHECK_ONLY && errors.length === 0;
if (written) fs.writeFileSync(path.join(ROOT, OUT_RELATIVE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
if (!QUIET) report(manifest, totals, errors, warnings, allFiles.length, written);

process.exitCode = errors.length ? 1 : 0;

function report(data, count, problemList, warningList, filesScanned, didWrite) {
  const line = (text) => process.stdout.write(`${text}\n`);
  const outcome = CHECK_ONLY ? 'checked' : didWrite ? 'written' : 'NOT WRITTEN';
  line(`build ${data.build.buildId}  schema ${data.schema}  ${outcome} ${OUT_RELATIVE}  (${filesScanned} files on disk)`);
  line(`pages ${count.pages}  assets ${count.assets}  tierA-required ${count.coreRequired}  tierA-optional ${count.coreOptional}  tierC ${count.optional}  tierB ${count.content}  ${(count.bytes / 1048576).toFixed(2)} MB`);
  if (data.content) {
    line(`quran ${data.content.url} = 1 asset / ${data.content.downloadRequests} download, ${data.content.surahs} surahs, ${data.content.verses} verses (derived from ${data.content.metadataUrl})`);
  }
  for (const tier of ['core', 'content', 'optional']) {
    const list = data.assets.filter((asset) => asset.tier === tier);
    line(`\n[${tier}] ${list.length}`);
    for (const asset of list) {
      line(`  ${asset.url}  ${asset.role}  ${asset.required ? 'REQUIRED' : 'optional'}  ${asset.bytes} B  ${asset.pages.length} page(s)`);
    }
  }
  for (const message of warningList) line(`\nWARN  ${message}`);
  for (const message of problemList) line(`\nERROR ${message}`);
  if (problemList.length) line(`\n${problemList.length} build error(s)`);
}
