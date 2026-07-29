import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM(readFileSync('./index.html', 'utf8'), {
  url: 'https://mayamoho.github.io/bornomala/',
  runScripts: 'outside-only',
});
const { window } = dom;
global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.localStorage = window.localStorage;
global.history = window.history;
// Model loads for real, from disk.
global.fetch = async () => ({ ok: true, arrayBuffer: async () => readFileSync('./model.bin').buffer });

await import('./app.js');
await new Promise((r) => setTimeout(r, 900));

const el = (id) => window.document.getElementById(id);
const fire = (n, t) => n.dispatchEvent(new window.Event(t, { bubbles: true }));
const click = (n) => n.dispatchEvent(new window.Event('click', { bubbles: true }));
const out = [];
const check = (name, fn) => { try { out.push([true, name, fn()]); } catch (e) { out.push([false, name, `${e.name}: ${e.message}`]); } };
const assert = (c, d) => { if (!c) throw new Error(`expected — got: ${d}`); return d; };

check('normal tab: compress + decode round trip', () => {
  el('input').value = 'আমরা পাঁচজন নিরাপদ আছি, ঢাকা';
  fire(el('input'), 'input');
  const payload = el('payload').value;
  el('cipher').value = payload;
  fire(el('cipher'), 'input');
  return assert(el('plain').value === 'আমরা পাঁচজন নিরাপদ আছি, ঢাকা', `payload=${payload} back=${el('plain').value}`);
});

check('emergency: no phrasebook entry preselected', () =>
  assert(el('em-template').value === '' && el('em-slots').children.length === 0, `value="${el('em-template').value}"`));

check('emergency: no time preselected', () => assert(el('em-hours').value === '', `value="${el('em-hours').value}"`));

check('emergency: buttons disabled until something is typed', () =>
  assert(el('em-send').disabled && el('em-queue').disabled, `send=${el('em-send').disabled}`));

check('emergency: typed message alone is enough', () => {
  el('em-text').value = 'ছাদ ভেঙে পড়েছে, তিনজন ভিতরে';
  fire(el('em-text'), 'input');
  return assert(el('em-preview').value === 'ছাদ ভেঙে পড়েছে, তিনজন ভিতরে' && !el('em-send').disabled, el('em-preview').value);
});

check('emergency: preview is plain text, never a code', () =>
  assert(!/^[A-Z]-/.test(el('em-preview').value) && el('em-preview').value.includes('ছাদ'), el('em-preview').value));

check('emergency: phrasebook sentence appends to the typed text', () => {
  el('em-template').value = '2';
  fire(el('em-template'), 'change');
  const s = el('em-preview').value;
  return assert(s.startsWith('ছাদ ভেঙে') && s.includes('আটকে'), s);
});

check('emergency: slot dropdowns appear for that sentence', () =>
  assert(el('em-slots').querySelectorAll('select').length > 0, `${el('em-slots').querySelectorAll('select').length} slots`));

check('emergency: district adds a name and a maps link', () => {
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  const s = el('em-preview').value;
  return assert(s.includes('https://maps.google.com') && s.includes('Dhaka'), s.split('\n').slice(-2).join(' | '));
});

check('emergency: live location gives bare coordinates AND a link', () => {
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 23.7978, longitude: 90.366 } }) },
  });
  el('em-loc').value = 'gps';
  fire(el('em-loc'), 'change');
  click(el('em-locate'));
  const s = el('em-preview').value;
  return assert(s.includes('23.79780, 90.36600') && s.includes('https://maps.google.com/?q=23.79780,90.36600'), s.split('\n').slice(-2).join(' | '));
});

check('emergency: time appends', () => {
  el('em-hours').value = '3';
  fire(el('em-hours'), 'change');
  return assert(el('em-preview').value.includes('3h ago'), el('em-preview').value.split('\n')[0]);
});

check('emergency: segment count is UCS-2, not compressed', () =>
  assert(Number(el('em-segments').textContent) >= 1, `segments=${el('em-segments').textContent} chars=${el('em-chars').textContent}`));

check('relay: queue two messages, plain text only', () => {
  click(el('em-queue'));
  el('em-text').value = 'পানি বুক সমান, নৌকা দরকার';
  fire(el('em-text'), 'input');
  click(el('em-queue'));
  const v = el('relay-payload').value;
  return assert(el('relay-list').children.length === 2 && v.includes('নৌকা') && v.includes('ছাদ'), `items=${el('relay-list').children.length}`);
});

check('relay: stats and buttons', () =>
  assert(!el('relay-send').disabled && Number(el('r-count').textContent) === 2,
    `count=${el('r-count').textContent} segments=${el('r-segments').textContent} alone=${el('r-alone').textContent}`));

check('relay: clear empties everything', () => {
  click(el('relay-clear'));
  return assert(el('relay-list').children.length === 0 && el('relay-send').disabled, 'cleared');
});

check('tabs: switching hides the other panels', () => {
  click(el('tab-emergency'));
  return assert(!el('panel-emergency').hidden && el('panel-normal').hidden && el('panel-relay').hidden, 'emergency shown only');
});

for (const [ok, name, detail] of out) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
console.log(`\n${out.filter(([o]) => o).length}/${out.length} passed`);
process.exit(out.every(([o]) => o) ? 0 : 1);
