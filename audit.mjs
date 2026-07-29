import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync('./index.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://mayamoho.github.io/bornomala/', runScripts: 'outside-only' });
const { window } = dom;
global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.localStorage = window.localStorage;
global.history = window.history;
global.fetch = () => Promise.reject(new Error('NetworkError'));

await import('./app.js');
await new Promise((r) => setTimeout(r, 100));

const el = (id) => window.document.getElementById(id);
const fire = (n, t) => n.dispatchEvent(new window.Event(t, { bubbles: true }));
const click = (n) => n.dispatchEvent(new window.Event('click', { bubbles: true }));
const out = [];
const check = (name, fn) => {
  try { const d = fn(); out.push([true, name, d]); }
  catch (e) { out.push([false, name, `${e.name}: ${e.message}`]); }
};
const assert = (cond, detail) => { if (!cond) throw new Error(`expected: ${detail}`); return detail; };

// --- relay with a note while the model is missing -------------------------
check('relay: queue a frame carrying a note, no model', () => {
  el('note').value = 'ছাদ ভেঙে গেছে';
  fire(el('note'), 'input');
  click(el('crisis-queue'));
  return `relay items=${el('relay-list').children.length} note=${el('relay-note').textContent.slice(0, 60)}`;
});

check('relay: queue a plain frame', () => {
  el('note').value = '';
  fire(el('note'), 'input');
  click(el('crisis-queue'));
  return assert(el('relay-list').children.length >= 1, `items=${el('relay-list').children.length}`);
});

check('relay: plain-text toggle', () => {
  el('relay-plaintext').checked = true;
  fire(el('relay-plaintext'), 'change');
  return assert(el('relay-payload').value.length > 0, el('relay-payload').value.slice(0, 60));
});

check('relay: clear', () => {
  el('relay-plaintext').checked = false;
  fire(el('relay-plaintext'), 'change');
  click(el('relay-clear'));
  return assert(el('relay-list').children.length === 0, 'cleared');
});

// --- decode round trip ----------------------------------------------------
check('decode: coded payload round trips', () => {
  el('note').value = '';
  fire(el('note'), 'input');
  el('crisis-plaintext').checked = false;
  fire(el('crisis-plaintext'), 'change');
  const code = el('crisis-code').textContent;
  el('cipher').value = code;
  fire(el('cipher'), 'input');
  return assert(el('decoded').children.length === 1, `code=${code} decoded=${el('decoded').textContent}`);
});

check('decode: whole received SMS with attribution lines', () => {
  const code = el('crisis-code').textContent;
  el('cipher').value = `${code}\nhttps://maps.google.com/?q=1,2\nSent with Bornomala: https://x/`;
  fire(el('cipher'), 'input');
  return assert(el('decoded').children.length === 1, el('decoded').textContent);
});

check('decode: damaged payload refuses', () => {
  el('cipher').value = 'H-428R-0ZZ';
  fire(el('cipher'), 'input');
  return assert(el('decode-note').textContent.length > 0, el('decode-note').textContent);
});

// --- QR -------------------------------------------------------------------
check('qr: crisis toggle renders', () => {
  el('cipher').value = '';
  fire(el('cipher'), 'input');
  click(el('crisis-qr-toggle'));
  return assert(!el('crisis-qr').hidden && el('crisis-qr').innerHTML.includes('svg'), 'svg rendered');
});

check('qr: hides on second tap', () => {
  click(el('crisis-qr-toggle'));
  return assert(el('crisis-qr').hidden, 'hidden');
});

// --- paper card -----------------------------------------------------------
check('card: tables rendered', () => {
  const n = ['card-base32', 'card-templates', 'card-slots', 'card-districts'].map((id) => el(id).querySelectorAll('tr').length);
  return assert(n.every((x) => x > 1), `rows=${n.join(',')}`);
});

// --- language -------------------------------------------------------------
check('lang: switch to bn rebuilds without duplicating card tables', () => {
  const before = el('card-districts').querySelectorAll('table').length;
  click(el('lang-bn'));
  const after = el('card-districts').querySelectorAll('table').length;
  return assert(before === after, `tables before=${before} after=${after}`);
});

check('lang: form state survives the switch', () => {
  el('note').value = 'পরীক্ষা';
  fire(el('note'), 'input');
  const template = el('template').value;
  click(el('lang-en'));
  return assert(el('note').value === 'পরীক্ষা' && el('template').value === template, `note=${el('note').value} template=${el('template').value}`);
});

// --- location modes -------------------------------------------------------
check('location: switching to none still encodes', () => {
  el('note').value = '';
  fire(el('note'), 'input');
  el('loc-mode').value = 'none';
  fire(el('loc-mode'), 'change');
  return assert(el('crisis-code').textContent !== '—', el('crisis-code').textContent);
});

check('location: gps mode without a fix still encodes', () => {
  el('loc-mode').value = 'gps';
  fire(el('loc-mode'), 'change');
  return assert(el('crisis-code').textContent !== '—', el('crisis-code').textContent);
});

check('location: back to district', () => {
  el('loc-mode').value = 'district';
  fire(el('loc-mode'), 'change');
  return assert(el('crisis-code').textContent !== '—', el('crisis-code').textContent);
});

// --- every template encodes ----------------------------------------------
check('all 32 templates encode with every slot at max', () => {
  const failures = [];
  for (const option of el('template').querySelectorAll('option')) {
    el('template').value = option.value;
    fire(el('template'), 'change');
    for (const sel of el('slots').querySelectorAll('select')) {
      sel.value = String(sel.options.length - 1);
      fire(sel, 'change');
    }
    if (el('crisis-code').textContent === '—') failures.push(option.value);
  }
  return assert(failures.length === 0, `failed templates: ${failures.join(',') || 'none'}`);
});

for (const [ok, name, detail] of out) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
console.log(`\n${out.filter(([ok]) => ok).length}/${out.length} passed`);
