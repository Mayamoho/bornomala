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

check('emergency: send link disabled until something is typed', () =>
  assert(el('em-send').getAttribute('aria-disabled') === 'true' && el('em-queue').disabled,
    `aria-disabled=${el('em-send').getAttribute('aria-disabled')}`));

check('emergency: typed text alone is NOT enough, where and when required', () => {
  el('em-text').value = 'ছাদ ভেঙে পড়েছে, তিনজন ভিতরে';
  fire(el('em-text'), 'input');
  return assert(el('em-send').getAttribute('aria-disabled') === 'true' && el('em-note').textContent.includes('where you are'), el('em-note').textContent);
});

check('emergency: a ready sentence is now required too', () => {
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  el('em-hours').value = '3';
  fire(el('em-hours'), 'change');
  return assert(el('em-send').getAttribute('aria-disabled') === 'true' && el('em-note').textContent.includes('ready sentence'), el('em-note').textContent);
});

check('emergency: ready once where, when and a recipient are answered', () => {
  el('em-to').value = '01712345678';
  fire(el('em-to'), 'input');
  el('em-template').value = '2';
  fire(el('em-template'), 'change');
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  el('em-hours').value = '3';
  fire(el('em-hours'), 'change');
  return assert(el('em-send').getAttribute('aria-disabled') === 'false' && el('em-preview').textContent.includes('ছাদ'), el('em-preview').textContent.split('\n')[0]);
});

check('emergency: gps chosen without a fix blocks sending', () => {
  el('em-loc').value = 'gps';
  fire(el('em-loc'), 'change');
  const blocked = el('em-send').getAttribute('aria-disabled') === 'true';
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
  return assert(el('relay-list').children.length === 0 && el('relay-send').getAttribute('aria-disabled') === 'true', 'cleared');
});

check('tabs: switching hides the other panels', () => {
  click(el('tab-emergency'));
  return assert(!el('panel-emergency').hidden && el('panel-normal').hidden && el('panel-relay').hidden, 'emergency shown only');
});


/* ── what actually leaves the phone, and what comes back ── */

check('send: the send control is a real sms: link', () => {
  el('em-text').value = 'ছাদ ভেঙে পড়েছে';
  fire(el('em-text'), 'input');
  el('em-template').value = '2';
  fire(el('em-template'), 'change');
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  el('em-hours').value = '1';
  fire(el('em-hours'), 'change');
  const href = el('em-send').getAttribute('href') ?? '';
  return assert(href.startsWith('sms:01712345678?body=') && decodeURIComponent(href).includes('ছাদ ভেঙে পড়েছে'), href.slice(0, 50));
});

check('hotlines: the short-code body carries no link and fits one or two segments', () => {
  const href = document.querySelectorAll('.hotline-sms')[0].getAttribute('href') ?? '';
  const body = decodeURIComponent(href.split('body=')[1] ?? '');
  const segments = Math.ceil([...body].length / 67);
  return assert(!body.includes('http') && segments <= 2 && body.includes('ছাদ'),
    `chars=${[...body].length} segments=${segments} hasLink=${body.includes('http')}`);
});

check('hotlines: the personal send still carries the full report and its link', () => {
  const body = decodeURIComponent((el('em-send').getAttribute('href') ?? '').split('body=')[1] ?? '');
  return assert(body.includes('maps.google.com') && body.includes('Bornomala'), body.slice(-40));
});

check('send: every hotline row is a live sms: link', () => {
  const links = [...document.querySelectorAll('.hotline-sms')];
  const first = links[0].getAttribute('href') ?? '';
  const enabled = links.every((l) => l.getAttribute('aria-disabled') === 'false');
  return assert(links.length === 9 && enabled && first.startsWith('sms:999?body='), `${links.length} links, first=${first.slice(0, 24)}`);
});

check('send: a typed recipient goes into the sms: link', () => {
  el('em-to').value = '01712-345678';
  fire(el('em-to'), 'input');
  const href = el('em-send').getAttribute('href') ?? '';
  return assert(href.startsWith('sms:01712345678?body='), href.slice(0, 40));
});

check('send: clearing the recipient turns the send control off', () => {
  el('em-to').value = '';
  fire(el('em-to'), 'input');
  return assert(el('em-send').getAttribute('aria-disabled') === 'true' && !el('em-send').getAttribute('href')
    && el('em-note').textContent.includes('phone number'), el('em-note').textContent);
});

check('send: a half-typed number is refused, and says so', () => {
  el('em-to').value = '0171234';
  fire(el('em-to'), 'input');
  const off = el('em-send').getAttribute('aria-disabled') === 'true';
  const warned = el('em-note').textContent.includes('Check the number');
  el('em-to').value = '';
  fire(el('em-to'), 'input');
  return assert(off && warned, el('em-note').textContent);
});

check('send: +8801 international form is accepted', () => {
  el('em-to').value = '+8801712345678';
  fire(el('em-to'), 'input');
  const href = el('em-send').getAttribute('href') ?? '';
  el('em-to').value = '';
  fire(el('em-to'), 'input');
  return assert(href.startsWith('sms:+8801712345678?body='), href.slice(0, 40));
});

check('send: a missing recipient never disables the hotlines', () => {
  const links = [...document.querySelectorAll('.hotline-sms')];
  return assert(links.every((l) => l.getAttribute('aria-disabled') === 'false'),
    `em-to="${el('em-to').value}" hotlines live=${links.filter((l) => l.getAttribute('aria-disabled') === 'false').length}`);
});

check('send: relay takes its own recipient', () => {
  el('em-to').value = '';
  fire(el('em-to'), 'input');
  click(el('em-queue'));
  el('relay-to').value = '+8801812345678';
  fire(el('relay-to'), 'input');
  const href = el('relay-send').getAttribute('href') ?? '';
  click(el('relay-clear'));
  // Queueing empties the compose box by design; put it back or every later
  // check runs against a message that is missing its typed line.
  el('em-text').value = 'ছাদ ভেঙে পড়েছে';
  fire(el('em-text'), 'input');
  return assert(href.startsWith('sms:+8801812345678?body='), href.slice(0, 40));
});

check('qr: tapping with fields missing explains what is missing', () => {
  const text = el('em-text').value;
  el('em-text').value = '';
  fire(el('em-text'), 'input');
  click(el('em-qr-toggle'));
  const explained = el('em-note').textContent.includes('Still needed');
  el('em-text').value = text;
  fire(el('em-text'), 'input');
  return assert(explained && el('em-qr').hidden, el('em-note').textContent);
});

check('qr: a long Bangla message with a map link still encodes', () => {
  el('em-loc').value = 'gps';
  fire(el('em-loc'), 'change');
  click(el('em-qr-toggle'));
  const ok = !el('em-qr').hidden && el('em-qr').innerHTML.includes('<svg');
  click(el('em-qr-toggle'));
  el('em-loc').value = 'district';
  fire(el('em-loc'), 'change');
  return assert(ok, `bytes=${new TextEncoder().encode(el('em-preview').textContent).length}`);
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

check('send: a personal contact number goes into the compose sms: link', () => {
  el('input').value = 'আমরা নিরাপদ আছি';
  fire(el('input'), 'input');
  el('to').value = '01712-345678';
  fire(el('to'), 'input');
  const href = el('send').getAttribute('href') ?? '';
  return assert(href.startsWith('sms:01712345678?body='), href.slice(0, 40));
});

check('send: compose refuses to send with no recipient', () => {
  el('to').value = '';
  fire(el('to'), 'input');
  return assert(el('send').getAttribute('aria-disabled') === 'true' && !el('send').getAttribute('href')
    && el('compose-note').textContent.includes('phone number'), el('compose-note').textContent);
});

check('send: compose copy still works without a recipient', () =>
  assert(!el('copy').disabled && el('payload').value !== '', `payload="${el('payload').value.slice(0, 12)}"`));

check('send: relay refuses to send with no recipient', () => {
  el('relay-to').value = '';
  fire(el('relay-to'), 'input');
  click(el('em-queue'));
  const off = el('relay-send').getAttribute('aria-disabled') === 'true';
  const warned = el('relay-note').textContent.includes('phone number');
  click(el('relay-clear'));
  el('em-text').value = 'ছাদ ভেঙে পড়েছে';
  fire(el('em-text'), 'input');
  return assert(off && warned, el('relay-note').textContent);
});

check('required: all three recipient fields are marked required', () => {
  const ids = ['to', 'em-to', 'relay-to'];
  const marked = ids.filter((id) => el(id).required && el(id).getAttribute('aria-required') === 'true');
  return assert(marked.length === 3, marked.join(', '));
});

check('attribution: every personal send names the app', () => {
  el('input').value = 'আমরা নিরাপদ আছি';
  fire(el('input'), 'input');
  for (const id of ['to', 'em-to', 'relay-to']) {
    el(id).value = '01712345678';
    fire(el(id), 'input');
  }
  const compose = decodeURIComponent(el('send').getAttribute('href') ?? '');
  const emergency = decodeURIComponent(el('em-send').getAttribute('href') ?? '');
  click(el('em-queue'));
  const relayBody = decodeURIComponent(el('relay-send').getAttribute('href') ?? '');
  click(el('relay-clear'));
  const carries = (s) => s.includes('Bornomala') || s.includes('বর্ণমালা');
  return assert([compose, emergency, relayBody].every(carries),
    [compose, emergency, relayBody].map((s) => s.split('—').pop()?.slice(0, 24)).join(' | '));
});

check('attribution: a hotline body drops it, to stay inside one segment', () => {
  el('em-text').value = 'ছাদ ভেঙে পড়েছে';
  fire(el('em-text'), 'input');
  const body = decodeURIComponent((document.querySelectorAll('.hotline-sms')[0].getAttribute('href') ?? '').split('body=')[1] ?? '');
  return assert(!body.includes('Bornomala') && !body.includes('বর্ণমালা') && body.length > 0,
    `chars=${[...body].length}`);
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
