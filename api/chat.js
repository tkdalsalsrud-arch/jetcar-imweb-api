// 제트카 AI 상담 챗봇 API — 답변 근거: 제트카 공식 홈페이지 https://www.jetcar.co.kr
// POST /api/chat  { messages:[{role:'user'|'model', text}], page:{url,title,text} }  → { reply }
// GET  /api/chat?ping=1 → { ok, ready } (위젯 노출 판단) / ?kb=1 → 수집 현황
// 읽는 자료 (1시간 캐시):
//   ① 차량 LIST 엑셀  /excel_cars_new.php  (신차·중고차·화물차 전 차량, 개월별 보증금·렌트비)
//   ② 목록 페이지 /sub0201(신차) /sub0301(중고) /sub0701(화물차) → 차량별 상세 링크 매칭
//   ③ 자주하는질문 /bbs/faq.php?fm_id=1   ④ 서비스 소개 /jetcar/sub0103.php
//   ⑤ 고객이 보고 있는 페이지 본문(위젯이 전송)
// 질문과 관련된 차량만 상세 행으로 넣고(토큰 절약), 나머지는 차종 요약으로 제공
// 환경변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택)
const zlib = require('zlib');

const SITE = 'https://www.jetcar.co.kr';
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
const ORIGINS = /^https:\/\/(jetcar1000\.imweb\.me|(www\.)?jetcar\.co\.kr|jetcar-imweb-api\.vercel\.app)$/;
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'ko-KR,ko;q=0.9' };
const BOARDS = { 신차: 'sub0201', 중고차: 'sub0301', 화물차: 'sub0701' };

let KB = { t: 0 };

/* ── 최소 xlsx 리더 (의존성 없이 zip 해제 + 시트 XML 파싱) ── */
function unzip(buf) {
  const files = {}; let e = buf.length - 22;
  while (e > 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString();
    const lnl = buf.readUInt16LE(off + 26), lxl = buf.readUInt16LE(off + 28);
    const data = buf.slice(off + 30 + lnl + lxl, off + 30 + lnl + lxl + csize);
    files[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    p += 46 + nl + xl + cl;
  }
  return files;
}
const xdec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
function readXlsx(buf) {
  const f = unzip(buf);
  const ss = [];
  const sst = (f['xl/sharedStrings.xml'] || '').toString();
  for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(xdec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const sheetName = Object.keys(f).find(k => /^xl\/worksheets\/sheet1\.xml$/.test(k)) || Object.keys(f).find(k => /^xl\/worksheets\/.*\.xml$/.test(k));
  const xml = f[sheetName].toString(); const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = cm[1], body = cm[2] || '';
      const col = ((at.match(/r="([A-Z]+)\d+"/) || [])[1] || '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = (at.match(/t="(\w+)"/) || [])[1];
      let v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => xdec(x[1])).join(''); else if (v != null) v = xdec(v);
      if (col >= 0) row[col] = v == null ? '' : String(v);
    }
    rows.push(row);
  }
  return rows;
}

function htmlText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|dt|dd)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
const won = v => { const n = +String(v).replace(/[^\d]/g, ''); return n ? (Math.round(n / 1000) / 10).toString().replace(/\.0$/, '') + '만' : '-'; };
const getText = u => fetch(SITE + u, { headers: UA }).then(r => r.ok ? r.text() : '').catch(() => '');

async function crawlList(board) {
  const out = []; const seen = new Set();
  for (let pg = 1; pg <= 40; pg++) {
    const html = await getText(`/${board}?page=${pg}`); if (!html) break;
    let added = 0;
    for (const m of html.matchAll(/<a href="https:\/\/www\.jetcar\.co\.kr\/(sub0\d01)\/(\d+)[^"]*" class="bo_tit">([\s\S]*?)<\/a>\s*<span class="bo_cnt">([\s\S]*?)<\/span>/g)) {
      if (seen.has(m[2])) continue; seen.add(m[2]); added++;
      const name = htmlText(m[3]); const cnt = m[4];
      out.push({ url: `${SITE}/${m[1]}/${m[2]}`, name, km: ((cnt.match(/([\d,]+)\s*km/i) || [])[1] || '').replace(/,/g, ''), opt: ((cnt.match(/<!--([\s\S]*?)-->/) || [])[1] || '').trim() });
    }
    if (!added) break;
  }
  return out;
}

async function buildKB() {
  if (KB.t && Date.now() - KB.t < 60 * 60 * 1000) return KB;
  const [xbuf, faqHtml, svcHtml, ...lists] = await Promise.all([
    fetch(SITE + '/excel_cars_new.php', { headers: UA }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
    getText('/bbs/faq.php?fm_id=1'), getText('/jetcar/sub0103.php'),
    ...Object.values(BOARDS).map(b => crawlList(b).catch(() => []))
  ]);
  // ① 차량 LIST 엑셀 → 차량별 묶기 (차량명 있는 행이 새 차량, 아래 행은 개월별 조건)
  const V = []; let cur = null;
  if (xbuf) {
    const rows = readXlsx(Buffer.from(xbuf)).slice(1);
    for (const r of rows) {
      if (r[2]) { cur = { name: r[2].replace(/\s+/g, ' ').trim(), opt: (r[3] || '').trim(), kind: r[4], color: r[5], fuel: r[6], ym: r[7], km: r[8], T: [] }; V.push(cur); }
      if (cur && r[9]) cur.T.push({ m: +r[9], dep: r[10], rent: +String(r[11]).replace(/[^\d]/g, '') });
    }
  }
  // ② 목록 링크 매칭: 같은 구분 게시판에서 차량명(+주행거리) 일치
  const L = lists.flat();
  for (const v of V) {
    const k = norm(v.name), km = String(v.km).replace(/[^\d]/g, '');
    const board = BOARDS[v.kind];
    const c = L.filter(l => (!board || l.url.includes('/' + board + '/')) && (norm(l.name) === k || norm(l.name).includes(k) || k.includes(norm(l.name))));
    const c2 = c.filter(l => l.km === km);
    v.url = (c2[0] || c[0] || {}).url || (board ? `${SITE}/${board}` : SITE);
    v.min = Math.min(...v.T.map(t => t.rent).filter(Boolean), Infinity);
  }
  // ③④ 자주하는질문 · 서비스 소개 본문
  const cut = (t, from) => { let x = htmlText(t); const a = from ? x.indexOf(from) : -1; if (a >= 0) x = x.slice(a); const z = x.search(/개인정보처리방침 레이어|제트카 고객센터\s*1522|사업자등록번호/); return (z > 0 ? x.slice(0, z) : x).replace(/\s*열기\s*/g, '\n').replace(/\s*닫기\s*/g, '\n').replace(/\n\s*\n+/g, '\n').trim(); };
  const faq = cut(faqHtml, '자주하는질문 목록').slice(0, 16000);
  const svc = cut(svcHtml, '서비스 소개').slice(0, 5000);
  // 차종 요약 (항상 포함)
  const S = {};
  for (const v of V) {
    const model = v.name.replace(/^(the\s*20\d\d|더\s*뉴|디\s*올\s*뉴|올\s*뉴|디\s*올뉴|더뉴|올뉴|뉴)\s*/i, '').split(/\s|\(/)[0];
    const key = v.kind + '|' + model; const s = S[key] || (S[key] = { kind: v.kind, model, n: 0, min: Infinity });
    s.n++; if (v.min < s.min) s.min = v.min;
  }
  const summary = Object.values(S).sort((a, b) => a.kind.localeCompare(b.kind) || a.min - b.min)
    .map(s => `${s.kind} ${s.model} ${s.n}대 월 ${won(s.min)}원~`).join(' / ');
  KB = { t: Date.now(), V, faq, svc, summary, listN: L.length };
  return KB;
}

const vline = v => `- [${v.kind}] ${v.name}${v.opt ? ' (옵션: ' + v.opt.slice(0, 60) + ')' : ''} | ${[v.color, v.fuel, v.ym, v.km].filter(Boolean).join(' · ')} | ${v.T.map(t => `${t.m}개월 보증금${won(String(t.dep).match(/^\d{1,4}$/) ? t.dep * 10000 : t.dep)}·월${won(t.rent)}`).join(', ')} | 링크: ${v.url}`;

// 질문과 관련된 차량만 골라 상세 행으로 (차종·연료·구분 단어 매칭, 없으면 저렴한 순 일부)
function pickVehicles(V, msgs) {
  const q = msgs.filter(m => m.role === 'user').slice(-3).map(m => m.parts[0].text).join(' ');
  const toks = (q.match(/[가-힣A-Za-z0-9]{2,}/g) || []).map(norm).filter(t => !/^(가능|있나요|얼마|어떻게|궁금|문의|추천|저렴|싼차|차량|장기렌트|렌트|월|보증금|개월)/.test(t));
  const fuelMap = { 하이브리드: '하이브리드', 전기: '전기', 전기차: '전기', lpg: 'lpg', 디젤: '경유', 경유: '경유', 가솔린: '휘발유', 휘발유: '휘발유' };
  let hit = V.filter(v => { const n = norm(v.name); return toks.some(t => t.length >= 2 && n.includes(t)); });
  const kinds = ['신차', '중고차', '중고', '화물차', '화물', '트럭'].filter(k => q.includes(k)).map(k => k === '중고' ? '중고차' : (k === '화물' || k === '트럭') ? '화물차' : k);
  const fuels = Object.keys(fuelMap).filter(k => norm(q).includes(k)).map(k => fuelMap[k]);
  if (kinds.length) hit = (hit.length ? hit : V).filter(v => kinds.includes(v.kind));
  if (fuels.length) hit = (hit.length ? hit : V).filter(v => fuels.some(f => norm(v.fuel).includes(f)));
  if (!hit.length) hit = V.slice().sort((a, b) => a.min - b.min).slice(0, 25);
  return hit.sort((a, b) => a.min - b.min).slice(0, 60);
}

const SYSTEM = (kb, vehicles) => `당신은 장기렌트 회사 (주)제트카(JETCAR)의 AI 상담원입니다. 근거 자료는 제트카 공식 홈페이지(https://www.jetcar.co.kr) 내용입니다.
규칙:
1. 아래 [제트카 공식 홈페이지 자료]와 [고객이 보고 있는 페이지]에 있는 내용만 근거로 답합니다. 자료에 없는 조건·금액·정책은 추측하지 말고 "홈페이지에서 확인되지 않는 내용이라 상담사 확인이 필요합니다"라고 말한 뒤 전화(1522-3501)나 카카오톡 상담을 안내합니다.
2. 한국어 존댓말, 짧고 친절하게(보통 3~6줄). 목록이 필요하면 "- "로 시작하는 줄을 씁니다. 강조는 **굵게**.
3. 차량을 안내할 때는 차량명·구분(신차/중고차/화물차)·월 렌트비·보증금을 쓰고 [차량명](링크) 형식으로 홈페이지 링크를 붙입니다. 금액은 자료 그대로 "~부터"로, 최대 5대까지. 차량번호는 알려주지 않습니다.
4. [관련 차량 상세]에 없는 차는 [전체 차종 요약]으로 답하고, 자세한 조건은 해당 목록 페이지(신차 ${SITE}/sub0201, 중고 ${SITE}/sub0301, 화물차 ${SITE}/sub0701)나 상담으로 안내합니다.
5. 심사 승인·출고 일정·최종 금액을 확정해서 약속하지 않습니다. 최종 조건은 상담사가 안내한다고 말합니다.
6. 주민등록번호·카드번호·계좌번호 같은 개인정보는 요청하지도 받지도 않습니다. 고객이 보내면 상담사에게 직접 전달하라고 안내합니다.
7. 제트카와 무관한 질문은 정중히 장기렌트 상담으로 돌립니다.
8. 상담 연결: 전화 1522-3501 / 카카오톡 https://pf.kakao.com/_aQmWd

[제트카 공식 홈페이지 자료 — 실시간]
[전체 차종 요약 — 차량 LIST 기준 ${kb.V.length}대] ${kb.summary}

[관련 차량 상세 — 개월별 보증금·월 렌트비]
${vehicles.map(vline).join('\n')}

[서비스 소개 ${SITE}/jetcar/sub0103.php]
${kb.svc}

[자주하는질문 ${SITE}/bbs/faq.php]
${kb.faq}`;

async function gemini(key, system, contents) {
  let last = '';
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 } })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const t = (((j.candidates || [])[0] || {}).content || {}).parts;
      const txt = (t || []).map(p => p.text || '').join('').trim();
      if (txt) return txt;
      last = 'empty'; continue;
    }
    last = r.status + ' ' + ((j.error && j.error.message) || '');
    if (r.status !== 404 && r.status !== 400) break; // 모델 없음일 때만 다음 모델 시도
  }
  throw new Error(last);
}

// 간단 속도 제한 (인스턴스 메모리 기준, IP당 10분 30회)
const HITS = new Map();
function limited(ip) {
  const now = Date.now(), arr = (HITS.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); HITS.set(ip, arr); return arr.length > 30;
}

module.exports = async (req, res) => {
  const o = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ORIGINS.test(o) ? o : 'https://jetcar1000.imweb.me');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const key = process.env.GEMINI_API_KEY;
  if (req.method === 'GET') {
    if (req.query && req.query.kb) {
      const k = await buildKB(); const q = String(req.query.q || '');
      const vs = pickVehicles(k.V, [{ role: 'user', parts: [{ text: q }] }]);
      const sys = SYSTEM(k, vs);
      return res.status(200).json({ ready: !!key, vehicles: k.V.length, linked: k.V.filter(v => /\/sub0\d01\/\d+/.test(v.url)).length, listItems: k.listN, faqLen: k.faq.length, svcLen: k.svc.length, picked: vs.length, promptChars: sys.length, summary: k.summary.slice(0, 300), sample: vs.slice(0, 3).map(vline) });
    }
    return res.status(200).json({ ok: true, ready: !!key });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!key) return res.status(503).json({ error: 'NO_KEY', reply: 'AI 상담 준비 중입니다. 전화 1522-3501 또는 카카오톡으로 문의해 주세요.' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return res.status(429).json({ reply: '문의가 많아 잠시 후 다시 시도해 주세요. 급하시면 전화 1522-3501로 연락 주세요.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
      .map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 1200) }] }))
      .filter(m => m.parts[0].text);
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'no message' });
    const kb = await buildKB();
    const vehicles = pickVehicles(kb.V, msgs);
    const pg = body.page || {};
    const pageCtx = pg.text ? `\n\n[고객이 보고 있는 페이지] ${String(pg.title || '').slice(0, 200)} (${String(pg.url || '').slice(0, 200)})\n${String(pg.text).slice(0, 5000)}` : '';
    const reply = await gemini(key, SYSTEM(kb, vehicles) + pageCtx, msgs);
    res.status(200).json({ reply });
  } catch (e) {
    console.error('chat error', String(e));
    res.status(502).json({ error: 'AI', reply: '지금은 AI 답변이 어려워요. 전화 1522-3501 또는 카카오톡으로 문의해 주세요.' });
  }
};
