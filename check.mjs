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

check('emergency: typed text alone is NOT enough, where and when required', () => {
  el('em-text').value = 'ছাদ ভেঙে পড়েছে, তিনজন ভিতরে';
  fire(el('em-text'), 'input');
  return assert(el('em-send').disabled && el('em-note').textContent.includes('where'), el('em-note').textContent);
});

check('emergency: a ready sentence is now required too', () => {
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  el('em-hours').value = '3';
  fire(el('em-hours'), 'change');
  return assert(el('em-send').disabled && el('em-note').textContent.includes('ready sentence'), el('em-note').textContent);
});

check('emergency: ready once where and when are answered', () => {
  el('em-template').value = '2';
  fire(el('em-template'), 'change');
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  el('em-hours').value = '3';
  fire(el('em-hours'), 'change');
  return assert(!el('em-send').disabled && el('em-preview').textContent.includes('ছাদ'), el('em-preview').textContent.split('\n')[0]);
});

check('emergency: gps chosen without a fix blocks sending', () => {
  el('em-loc').value = 'gps';
  fire(el('em-loc'), 'change');
  const blocked = el('em-send').disabled;
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  return assert(blocked, `blocked=${blocked}`);
});

check('emergency: quick icon buttons render with blanks, no {0}', () => {
  const labels = [...el('em-quick').querySelectorAll('button')].map((b) => b.textContent);
  return assert(labels.length === 6 && !labels.join(' ').includes('{0}'), labels[0]);
});

check('emergency: dropdown options carry no {n} placeholders', () => {
  const bad = [...el('em-template').querySelectorAll('option')].filter((o) => /\{\d\}/.test(o.textContent));
  return assert(bad.length === 0, `options with placeholders: ${bad.length}`);
});

check('emergency: options are grouped', () =>
  assert(el('em-template').querySelectorAll('optgroup').length === 4,
    `${el('em-template').querySelectorAll('optgroup').length} groups`));

check('emergency: preview is plain text, never a code', () =>
  assert(!/^[A-Z]-/.test(el('em-preview').textContent) && el('em-preview').textContent.includes('ছাদ'), el('em-preview').textContent));

check('emergency: phrasebook sentence appends to the typed text', () => {
  el('em-template').value = '2';
  fire(el('em-template'), 'change');
  const s = el('em-preview').textContent;
  return assert(s.startsWith('ছাদ ভেঙে') && s.includes('trapped'), s);
});

check('emergency: quick button selects its sentence and stays selected', () => {
  const button = [...el('em-quick').querySelectorAll('button')][2];
  click(button);
  return assert(el('em-template').value === '2' && button.getAttribute('aria-pressed') === 'true',
    `value="${el('em-template').value}" pressed=${button.getAttribute('aria-pressed')}`);
});

check('emergency: slot dropdowns appear for that sentence', () =>
  assert(el('em-slots').querySelectorAll('select').length > 0, `${el('em-slots').querySelectorAll('select').length} slots`));

check('emergency: district adds a name and a maps link', () => {
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  const s = el('em-preview').textContent;
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
  const s = el('em-preview').textContent;
  return assert(s.includes('23.79780, 90.36600') && s.includes('https://maps.google.com/?q=23.79780,90.36600'), s.split('\n').slice(-2).join(' | '));
});

check('emergency: time appears in the message', () =>
  assert(el('em-preview').textContent.includes('3h ago'), el('em-preview').textContent.split('\n')[0]));

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


/* ── what actually leaves the phone, and what comes back ── */

check('send: sms: URI carries the whole emergency message', () => {
  el('em-text').value = 'ছাদ ভেঙে পড়েছে';
  fire(el('em-text'), 'input');
  el('em-template').value = '2';
  fire(el('em-template'), 'change');
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  el('em-hours').value = '1';
  fire(el('em-hours'), 'change');

  let href = '';
  window.__openUri = (uri) => { href = uri; };
  click(el('em-send'));
  const body = decodeURIComponent(href.replace('sms:?body=', ''));
  return assert(href.startsWith('sms:?body=') && body.includes('ছাদ ভেঙে পড়েছে') && body.includes('maps.google.com'), body.split('\n').join(' | '));
});

check('send: hotline SMS targets the short code', () => {
  let href = '';
  window.__openUri = (uri) => { href = uri; };
  const smsButton = [...el('hotlines').querySelectorAll('button')][0];
  click(smsButton);
  return assert(href.startsWith('sms:999?body='), href.slice(0, 60));
});

check('hotlines: nine verified numbers, each with a call link', () => {
  const items = el('hotlines').querySelectorAll('li');
  const numbers = [...el('hotlines').querySelectorAll('a')].map((a) => a.getAttribute('href'));
  const wanted = ['tel:999', 'tel:1090', 'tel:102', 'tel:16263', 'tel:333', 'tel:109', 'tel:1098', 'tel:16430', 'tel:106'];
  return assert(items.length === 9 && wanted.every((n) => numbers.includes(n)), numbers.join(' '));
});

check('qr: emergency toggle renders an svg', () => {
  click(el('em-qr-toggle'));
  return assert(!el('em-qr').hidden && el('em-qr').innerHTML.includes('<svg'), `label="${el('em-qr-toggle').textContent}"`);
});

check('qr: second tap hides it', () => {
  click(el('em-qr-toggle'));
  return assert(el('em-qr').hidden && el('em-qr-toggle').textContent === 'Show QR', el('em-qr-toggle').textContent);
});

check('lang: bn switches the interface and the message', () => {
  click(el('lang-bn'));
  const tab = el('tab-emergency').textContent.trim();
  const preview = el('em-preview').textContent;
  return assert(tab.includes('জরুরি') && preview.includes('আটকে'), `tab="${tab}" preview="${preview.split('\n')[0]}"`);
});

check('lang: the typed message and choices survive the switch', () =>
  assert(el('em-text').value === 'ছাদ ভেঙে পড়েছে' && el('em-hours').value === '1' && el('em-loc').value === 'district',
    `text="${el('em-text').value}" hours=${el('em-hours').value} loc=${el('em-loc').value}`));

check('lang: back to english', () => {
  click(el('lang-en'));
  return assert(el('tab-emergency').textContent.includes('Emergency'), el('tab-emergency').textContent.trim());
});

check('receive: a coded payload pasted back decodes to the original', () => {
  el('input').value = 'পানি বুক সমান, নৌকা পাঠান';
  fire(el('input'), 'input');
  const payload = el('payload').value;
  el('cipher').value = payload;
  fire(el('cipher'), 'input');
  return assert(el('plain').value === 'পানি বুক সমান, নৌকা পাঠান', `${payload} -> ${el('plain').value}`);
});

for (const [ok, name, detail] of out) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
console.log(`\n${out.filter(([o]) => o).length}/${out.length} passed`);
process.exit(out.every(([o]) => o) ? 0 : 1);
