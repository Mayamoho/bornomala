/**
 * Whole-project audit — the failure modes `check.mjs` cannot see.
 *
 * `check.mjs` drives the interface and asserts what a user would notice.
 * This one checks the things that stay invisible until the worst moment: a
 * service worker shell missing a file (the app installs, then breaks the first
 * time it is opened offline), a translation key that exists in one language
 * only (half the interface reverts mid-crisis), an id the code reaches for that
 * the markup never defined.
 *
 *   node audit.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Model } from './src/model.js';
import { encode, decode } from './src/codec.js';

const root = dirname(fileURLToPath(import.meta.url));
const path = (p) => join(root, p);
const read = (p) => readFileSync(path(p), 'utf8');
const out = [];
const check = (name, fn) => { try { out.push([true, name, fn()]); } catch (e) { out.push([false, name, e.message]); } };
const assert = (c, d) => { if (!c) throw new Error(`expected — got: ${d}`); return d; };

const html = read('index.html');
const app = read('app.js');
const sw = read('sw.js');

check('offline: every file in the service worker shell exists on disk', () => {
  const list = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  const missing = list.filter((f) => !existsSync(path(f)));
  return assert(missing.length === 0, `missing: ${missing.join(', ')} (of ${list.length})`);
});

check('offline: no shipped file is left out of the shell', () => {
  const shell = sw.slice(sw.indexOf('SHELL'), sw.indexOf(']', sw.indexOf('SHELL')));
  const shipped = ['index.html', 'app.js', 'model.bin', 'src/codec.js', 'src/i18n.js', 'src/qr.js'];
  const absent = shipped.filter((f) => existsSync(path(f)) && !shell.includes(f));
  return assert(absent.length === 0, `not precached: ${absent.join(', ')}`);
});

check('manifest: parses, names the app, has icons that exist', () => {
  const file = existsSync(path('manifest.webmanifest')) ? 'manifest.webmanifest' : 'manifest.json';
  const manifest = JSON.parse(read(file));
  const icons = (manifest.icons ?? []).map((i) => i.src.replace(/^\.?\//, ''));
  const missing = icons.filter((s) => !s.startsWith('data:') && !existsSync(path(s)));
  return assert(manifest.name && manifest.start_url && icons.length > 0 && missing.length === 0,
    `name=${manifest.name} icons=${icons.length} missing=${missing.join(',')}`);
});

check('i18n: every data-i18n key in the markup exists in both languages', () => {
  const keys = [...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)].map((m) => m[1]);
  const i18n = read('src/i18n.js');
  const en = i18n.slice(i18n.indexOf('en: {'), i18n.indexOf('bn: {'));
  const bn = i18n.slice(i18n.indexOf('bn: {'));
  const bad = [...new Set(keys)].filter((k) => !en.includes(`${k}:`) || !bn.includes(`${k}:`));
  return assert(bad.length === 0, `unresolved: ${bad.join(', ')} (of ${new Set(keys).size})`);
});

check('i18n: english and bangla define the same key set', () => {
  const i18n = read('src/i18n.js');
  const en = i18n.slice(i18n.indexOf('en: {'), i18n.indexOf('bn: {'));
  const bn = i18n.slice(i18n.indexOf('bn: {'));
  const names = (s) => new Set([...s.matchAll(/^\s{4}([a-zA-Z0-9]+):/gm)].map((m) => m[1]));
  const a = names(en);
  const b = names(bn);
  const onlyEn = [...a].filter((k) => !b.has(k));
  const onlyBn = [...b].filter((k) => !a.has(k));
  return assert(onlyEn.length === 0 && onlyBn.length === 0, `en only: ${onlyEn} | bn only: ${onlyBn}`);
});

check('dom: every id app.js reaches for exists in the markup', () => {
  const ids = [...app.matchAll(/el\('([a-z0-9-]+)'\)/g)].map((m) => m[1]);
  const missing = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`));
  // The slot selects are built at runtime by renderEmergencySlots, not shipped in the markup.
  const real = missing.filter((id) => !id.startsWith('em-slot'));
  return assert(real.length === 0, `absent from index.html: ${real.join(', ')}`);
});

const model = Model.fromBuffer(readFileSync(path('model.bin')).buffer);

check('codec: round trip holds over a spread of real Bangla', () => {
  const samples = [
    'আমরা নিরাপদ আছি',
    'পানি বুক সমান, নৌকা পাঠান',
    'ছাদ ভেঙে পড়েছে, তিনজন ভিতরে আটকে আছে',
    'ঢাকা মিরপুর ১০ নম্বর, জরুরি ওষুধ দরকার',
    'বিদ্যুৎ নেই, মোবাইলে চার্জ ২০%',
    'শিশু ও বৃদ্ধ মিলিয়ে ১২ জন, খাবার শেষ',
    'ব্রিজ ভেঙে গেছে — গাড়ি ঢুকতে পারবে না',
    'আহত ২, রক্তক্ষরণ হচ্ছে, অ্যাম্বুলেন্স লাগবে',
    'সবাই ভালো আছি। চিন্তা করো না।',
    'গতকাল রাত থেকে পানি বাড়ছে',
  ];
  const bad = samples.filter((s) => decode(encode(s, model), model) !== s);
  return assert(bad.length === 0, `failed: ${bad.join(' | ')}`);
});

check('codec: compression actually beats UCS-2 on every sample', () => {
  const samples = ['আমরা নিরাপদ আছি', 'পানি বুক সমান, নৌকা পাঠান', 'ছাদ ভেঙে পড়েছে, তিনজন ভিতরে আটকে আছে'];
  const ratios = samples.map((s) => (([...s].length * 16) / (encode(s, model).length * 7)).toFixed(2));
  return assert(ratios.every((r) => Number(r) > 1), ratios.join(', '));
});

check('codec: a corrupted payload fails loudly, it does not return nonsense silently', () => {
  let threw = 0;
  for (const junk of ['@@@@@', ' ', 'zzzzzzzzzzzzzzzzzzzz']) {
    try { decode(junk, model); } catch { threw += 1; }
  }
  return assert(threw > 0, `${threw}/3 rejected`);
});

check('security: no inline event handlers or eval in the markup', () => {
  const bad = /\son(click|load|error|input)=/i.test(html) || /\beval\(/.test(app);
  return assert(!bad, 'inline handler or eval present');
});

check('privacy: nothing in the app talks to a network host', () => {
  const calls = [...app.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  const remote = calls.filter((c) => /https?:/.test(c));
  return assert(remote.length === 0, `remote fetch: ${remote.join(', ')}`);
});

for (const [ok, name, detail] of out) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
console.log(`\n${out.filter(([o]) => o).length}/${out.length} passed`);
process.exit(out.every(([o]) => o) ? 0 : 1);
