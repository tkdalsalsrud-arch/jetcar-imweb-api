// 사고담당 카카오톡 챗봇(jetcar-chatbot1)의 고정 안내 카드를 텍스트로 뽑아 data/accident_kb.json 생성
// 사용: node scripts/build_accident_kb.mjs <jetcar-chatbot1 경로>
// 사고담당 챗봇 내용(면책금·정비업체·긴급출동 등)이 바뀌면 다시 실행 → 커밋·푸시
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const ROOT = path.resolve(process.argv[2] || '../jetcar-chatbot1');
const SK = path.join(ROOT, 'skills');
const SKIP = new Set(['ai', 'router', '_deductible']);
const files = fs.readdirSync(SK).filter(f => f.endsWith('.js')).map(f => f.replace('.js', '')).filter(f => !SKIP.has(f));
// 스킬별 기본 발화(메뉴 카드)
const BASE = { accident: ['사고접수'], faq: ['FAQ'], emergency: ['긴급출동'], repair: ['정비업체'], claim: ['청구'], billing: ['청구'], damage: ['파손'],
  disaster: ['천재도난'], document: ['서류'], insurance: ['보험사'], operator: ['상담연결'], warning: ['경고등'] };

function flat(o, out) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) return o.forEach(x => flat(x, out));
  if (o.simpleText) out.push(o.simpleText.text);
  const card = o.textCard || o.basicCard;
  if (card) { out.push([card.title, card.description].filter(Boolean).join('\n')); btns(card.buttons, out); }
  if (o.listCard) {
    const l = o.listCard; out.push(l.header && l.header.title || '');
    (l.items || []).forEach(i => out.push('- ' + [i.title, i.description].filter(Boolean).join(': ')));
    btns(l.buttons, out);
  }
  if (o.carousel) (o.carousel.items || []).forEach(it => flat({ [o.carousel.type || 'basicCard']: it }, out));
  if (o.template) flat(o.template.outputs, out);
  if (o.outputs) flat(o.outputs, out);
}
function btns(b, out) {
  (b || []).forEach(x => { if (x.phoneNumber) out.push(`(전화 버튼) ${x.label}: ${x.phoneNumber}`); else if (x.webLinkUrl) out.push(`(링크) ${x.label}: ${x.webLinkUrl}`); });
}
const clean = s => s.replace(/[━─]{3,}/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/gu, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const cards = []; const seen = new Set();
for (const name of files) {
  const src = fs.readFileSync(path.join(SK, name + '.js'), 'utf8');
  const codes = new Set(BASE[name] || []);
  for (const m of src.matchAll(/utterance\s*===?\s*'([^']+)'/g)) codes.add(m[1]);
  for (const m of src.matchAll(/'((?:정비|FAQ|사고|긴급|청구|증거|파손|응급|서류|경고등)_[^']+)'\s*:/g)) codes.add(m[1]);
  const mod = (await import(pathToFileURL(path.join(SK, name + '.js')).href)).default;
  for (const code of codes) {
    let body = null;
    const res = { setHeader() {}, status() { return this; }, json(b) { body = b; return this; } };
    try { await mod({ method: 'POST', body: { userRequest: { utterance: code } }, query: {} }, res); } catch (e) { console.error(name, code, e.message); continue; }
    if (!body) continue;
    const out = []; flat(body, out); const text = clean(out.filter(Boolean).join('\n'));
    if (!text || seen.has(text)) continue; seen.add(text);
    cards.push({ skill: name, code, text });
  }
}
const ded = await import(pathToFileURL(path.join(SK, '_deductible.js')).href);
const aiSrc = fs.readFileSync(path.join(SK, 'ai.js'), 'utf8');
const rules = (aiSrc.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/) || [])[1] || '';
const kb = { source: 'github tkdalsalsrud-arch/jetcar-chatbot1', built: new Date().toISOString(), deductible: ded.DEDUCTIBLE_PROMPT,
  rules: rules.replace('${DEDUCTIBLE_PROMPT}', ded.DEDUCTIBLE_PROMPT).split('\n').filter(l => l.startsWith('- ')).join('\n'), cards };
fs.writeFileSync(new URL('../data/accident_kb.json', import.meta.url), JSON.stringify(kb, null, 1));
console.log('cards', cards.length, 'chars', cards.reduce((a, c) => a + c.text.length, 0));
