// 제트카 AI 상담 챗봇 API — 답변 근거: 제트카 공식 홈페이지 https://www.jetcar.co.kr
// POST /api/chat  { messages:[{role:'user'|'model', text}], page:{url,title,text}, stream:true }
//   stream:true  → text/event-stream  data:{"t":"글자"} … data:{"done":true}   (위젯 기본)
//   stream 없음  → { reply }
// GET  /api/chat?ping=1 → { ok, ready } (위젯 노출 판단) / ?kb=1 → 수집 현황
// 상담 지식베이스(lib/qa.js): 답변마다 질문·답변 저장 → 비슷한 질문에 과거 답변을 참고로 넣음
//   GET  /api/chat?qa=list&token=ADMIN_TOKEN[&unknown=1][&q=검색어]   목록
//   POST /api/chat {admin:ADMIN_TOKEN, action:'edit', id, answer[, question]} / {admin, action:'delete', id}
//   GET  /api/qa-compact → /api/chat?qa=compact  (Vercel Cron 매일 03시 KST, CRON_SECRET)
// 읽는 자료 (1시간 캐시):
//   ① 차량 LIST 엑셀  /excel_cars_new.php  (신차·중고차·화물차 전 차량, 개월별 보증금·렌트비)
//   ② 목록 페이지 /sub0201(신차) /sub0301(중고) /sub0701(화물차) → 차량별 상세 링크 매칭
//   ③ 자주하는질문 /bbs/faq.php?fm_id=1   ④ 서비스 소개 /jetcar/sub0103.php
//   ⑤ 고객이 보고 있는 페이지 본문(위젯이 전송)
// 질문과 관련된 차량만 상세 행으로 넣고(토큰 절약), 나머지는 차종 요약으로 제공
// 환경변수: ANTHROPIC_API_KEY / CLAUDE_MODEL (기본 claude-sonnet-5-5) / CLAUDE_EFFORT (기본 low)
//          BLOB_READ_WRITE_TOKEN (지식베이스) / ADMIN_TOKEN (관리) / CRON_SECRET (합치기)
const zlib = require('zlib');
const QA = require('../lib/qa');

const SITE = 'https://www.jetcar.co.kr';
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

// 자주하는질문: 페이지 전부 돌며 Q/A 쌍으로 수집
async function crawlFaq() {
  const qa = [], seen = new Set();
  for (let pg = 1; pg <= 20; pg++) {
    const html = await getText(`/bbs/faq.php?fm_id=1&page=${pg}`); if (!html) break;
    const t = htmlText(html).replace(/\s+/g, ' ');
    let added = 0;
    for (const m of t.matchAll(/Q\s*([^Q]{4,200}?)\s*열기\s*([\s\S]{2,3000}?)\s*닫기/g)) {
      const q = m[1].trim(); if (seen.has(q)) continue; seen.add(q); added++;
      qa.push({ q, a: m[2].trim() });
    }
    if (!added) break;
  }
  return qa;
}

async function buildKB() {
  if (KB.t && Date.now() - KB.t < 60 * 60 * 1000) return KB;
  const [xbuf, faqHtml, svcHtml, ...lists] = await Promise.all([
    fetch(SITE + '/excel_cars_new.php', { headers: UA }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
    crawlFaq(), getText('/jetcar/sub0103.php'),
    ...Object.values(BOARDS).map(b => crawlList(b).catch(() => []))
  ]);
  // ① 차량 LIST 엑셀 → 차량별 묶기 (차량명 있는 행이 새 차량, 아래 행은 개월별 조건)
  const V = []; let cur = null;
  if (xbuf) {
    const rows = readXlsx(Buffer.from(xbuf)).slice(1);
    for (const r of rows) {
      if (r[2]) { cur = { name: r[2].replace(/\s+/g, ' ').trim(), opt: (r[3] || '').replace(/\s+/g, ' ').trim(), kind: r[4], color: r[5], fuel: r[6], ym: r[7], km: r[8], T: [] }; V.push(cur); }
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
  const faq = Array.isArray(faqHtml) ? faqHtml : [];
  const svc = cut(svcHtml, '서비스 소개').slice(0, 5000);
  // 차종 요약 (항상 포함)
  const S = {};
  for (const v of V) {
    const model = modelOf(v.name);
    const key = v.kind + '|' + model; const s = S[key] || (S[key] = { kind: v.kind, model, n: 0, min: Infinity });
    s.n++; if (v.min < s.min) s.min = v.min;
  }
  const summary = Object.values(S).sort((a, b) => a.kind.localeCompare(b.kind) || a.min - b.min)
    .map(s => `${s.kind} ${s.model} ${s.n}대 월 ${won(s.min)}원~`).join(' / ');
  KB = { t: Date.now(), V, faq, svc, summary, listN: L.length };
  return KB;
}

const PRE = /^(the|20\d\d(년형)?|더|뉴|디|올|올뉴|더뉴|디올뉴|신형|현대|기아|제네시스|르노|르노코리아|kgm|kg|쉐보레|테슬라|byd|벤츠|bmw|아우디|폭스바겐)$/i;
function modelOf(name) {
  const t = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  while (t.length > 1 && PRE.test(t[0])) t.shift();
  if (t.length > 1 && /^(그랑|트레일|싼타|더블|올뉴)$/.test(t[0])) t.splice(0, 2, t[0] + t[1]);
  return t[0].replace(/^(더뉴|디올뉴|올뉴|뉴)/, '') || t[0];
}
const vline = v => `- [${v.kind}] ${v.name}${v.opt ? ' (옵션: ' + v.opt.slice(0, 60) + ')' : ''} | ${[v.color, v.fuel, v.ym, v.km].filter(Boolean).join(' · ')} | ${v.T.map(t => `${t.m}개월 보증금${won(String(t.dep).match(/^\d{1,4}$/) ? t.dep * 10000 : t.dep)}·월${won(t.rent)}`).join(', ')} | 링크: ${v.url}`;

// 질문과 관련된 차량만 골라 상세 행으로 (차종·연료·구분 단어 매칭, 없으면 저렴한 순 일부)
function pickVehicles(V, msgs) {
  const q = msgs.filter(m => m.role === 'user').slice(-3).map(m => m.parts[0].text).join(' ');
  const toks = (q.match(/[가-힣A-Za-z0-9]{2,}/g) || []).map(norm).filter(t => !/^(가능|있나요|얼마|어떻게|궁금|문의|추천|저렴|싼차|차량|장기렌트|렌트|월|보증금|개월)/.test(t));
  const fuelMap = { 하이브리드: '하이브리드', 전기: '전기', 전기차: '전기', lpg: 'lpg', 디젤: '경유', 경유: '경유', 가솔린: '휘발유', 휘발유: '휘발유' };
  // 질문 단어가 차량명에 많이 들어간 차부터 (예: 'K8 하이브리드' → K8 하이브리드 우선, 없으면 K8 전체)
  const sc = V.map(v => { const n = norm(v.name); return [v, toks.filter(t => n.includes(t)).length, toks.some(t => norm(modelOf(v.name)) === t || (t.length >= 2 && norm(modelOf(v.name)).includes(t)))]; });
  const best = Math.max(0, ...sc.map(x => x[1]));
  const modelHit = sc.filter(x => x[2]);
  let hit = best ? sc.filter(x => x[1] === best).map(x => x[0]) : [];
  if (modelHit.length && !hit.some(v => modelHit.find(x => x[0] === v))) hit = modelHit.map(x => x[0]);
  const kinds = ['신차', '중고차', '중고', '화물차', '화물', '트럭'].filter(k => q.includes(k)).map(k => k === '중고' ? '중고차' : (k === '화물' || k === '트럭') ? '화물차' : k);
  const fuels = Object.keys(fuelMap).filter(k => norm(q).includes(k)).map(k => fuelMap[k]);
  if (kinds.length) hit = (hit.length ? hit : V).filter(v => kinds.includes(v.kind));
  if (fuels.length) hit = (hit.length ? hit : V).filter(v => fuels.some(f => norm(v.fuel).includes(f)));
  if (!hit.length) hit = V.slice().sort((a, b) => a.min - b.min).slice(0, 25);
  return hit.sort((a, b) => a.min - b.min).slice(0, 60);
}

function faqRank(faq, text) {
  const grams = new Set(); const n = norm(text).replace(/[^가-힣a-z0-9]/g, '');
  for (let i = 0; i < n.length - 1; i++) grams.add(n.slice(i, i + 2));      // 2글자 단위 겹침으로 관련도 계산
  return faq.map(x => { const t = norm(x.q) + ' ' + norm(x.q) + ' ' + norm(x.a); let s = 0; grams.forEach(g => { if (t.includes(g)) s++; }); return [x, s]; })
    .sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
// 이번 질문 관련 8개 + 직전 질문들(최대 3개) 관련 각 4개 → 앞서 근거로 쓴 FAQ가 다음 턴에 빠져 '정정'하는 오류 방지
function pickFaq(faq, msgs) {
  const us = msgs.filter(m => m.role === 'user').map(m => m.parts[0].text);
  const out = new Set(faqRank(faq, us[us.length - 1] || '').slice(0, 8));
  us.slice(-4, -1).reverse().forEach(t => faqRank(faq, t).slice(0, 4).forEach(x => out.add(x)));
  return [...out].slice(0, 18);
}

// 프롬프트를 고정부(규칙·차종 요약·서비스 소개·FAQ 제목 — 1시간 동안 동일 → 캐시)와 질문별 부분(관련 차량·FAQ 답변·보는 페이지)으로 나눔
const SYS_STATIC = kb => `당신은 장기렌트 회사 (주)제트카(JETCAR)의 AI 상담원입니다. 근거 자료는 제트카 공식 홈페이지(https://www.jetcar.co.kr) 내용입니다.
규칙:
1. 아래 [제트카 공식 홈페이지 자료]와 [고객이 보고 있는 페이지]에 있는 내용만 근거로 답합니다. 자료에 없는 조건·금액·정책은 추측하지 말고 "홈페이지에서 확인되지 않는 내용이라 상담사 확인이 필요합니다"라고 말한 뒤 전화(1522-3501)나 카카오톡 상담을 안내합니다.
2. 한국어 존댓말, 짧고 친절하게(보통 3~6줄). 목록이 필요하면 "- "로 시작하는 줄을 씁니다. 강조는 **굵게**. 표·제목(#)은 쓰지 않습니다.
3. 차량을 안내할 때는 차량명·구분(신차/중고차/화물차)·월 렌트비·보증금을 쓰고 [차량명](링크) 형식으로 홈페이지 링크를 붙입니다. 금액은 자료 그대로 "~부터"로, 최대 5대까지. 차량번호는 알려주지 않습니다.
4. [관련 차량 상세]에 없는 차는 [전체 차종 요약]으로 답하고, 자세한 조건은 해당 목록 페이지(신차 ${SITE}/sub0201, 중고 ${SITE}/sub0301, 화물차 ${SITE}/sub0701)나 상담으로 안내합니다.
5. 심사 승인·출고 일정·최종 금액을 확정해서 약속하지 않습니다. 최종 조건은 상담사가 안내한다고 말합니다.
6. 주민등록번호·카드번호·계좌번호 같은 개인정보는 요청하지도 받지도 않습니다. 고객이 보내면 상담사에게 직접 전달하라고 안내합니다.
7. 제트카와 무관한 질문은 정중히 장기렌트 상담으로 돌립니다. 이용 중 사고·파손·긴급출동 질문은 제트카 질문이므로 답합니다.
8. 상담 연결: 전화 1522-3501 / 카카오톡 https://pf.kakao.com/_aQmWd
9. 앞선 답변을 스스로 정정하는 것은 자료와 명백히 어긋날 때만 합니다. 이번 자료에 해당 내용이 안 보인다는 이유만으로 정정하지 않습니다.
10. [과거 상담 기록]이 있으면 같은 취지로 일관되게 답합니다. 단, 금액·차량·재고·옵션은 과거 기록을 쓰지 말고 반드시 이번 [관련 차량 상세] 기준으로 답합니다. [담당자 확인] 표시 답변은 정책·절차 설명에서 홈페이지 자료보다 우선합니다. 표시 없는 과거 답변이 이번 자료와 다르면 이번 자료를 따릅니다. 과거 기록이 있다는 사실은 고객에게 말하지 않습니다.

[제트카 공식 홈페이지 자료 — 실시간]
[전체 차종 요약 — 차량 LIST 기준 ${kb.V.length}대] ${kb.summary}

[서비스 소개 ${SITE}/jetcar/sub0103.php]
${kb.svc}

[자주하는질문 전체 목록(제목) — 아래 '관련 높은 항목'에 답이 없으면 제목만 참고하고 상담 안내]
${kb.faq.map(x => '· ' + x.q).join('\n')}`;

const ymd = t => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
const SYS_DYNAMIC = (vehicles, faqs, past) => `[관련 차량 상세 — 개월별 보증금·월 렌트비]
${vehicles.map(vline).join('\n')}

[자주하는질문 ${SITE}/bbs/faq.php?fm_id=1 — 이번 질문과 관련 높은 항목]
${(faqs || []).map(x => 'Q. ' + x.q + '\nA. ' + x.a).join('\n\n')}` + (past && past.length ? `

[과거 상담 기록 — 이번 질문과 비슷했던 질문·답변 (규칙 10)]
${past.map(p => `Q. ${p.q}\nA${p.staff ? '[담당자 확인]' : ''} (${ymd(p.ts)}). ${p.a}`).join('\n\n')}` : '');

/* ── 사고·보험·긴급출동 안내 = 사고담당 카카오톡 챗봇(jetcar-chatbot1)의 고정 안내 카드 ──
   data/accident_kb.json은 scripts/build_accident_kb.mjs로 생성(사고담당 챗봇 내용이 바뀌면 다시 생성·배포)
   대화에 사고 관련 단어가 있을 때만 프롬프트에 넣음(별도 캐시 블록) → 일반 상담은 비용 증가 없음 */
let ACC = null; try { ACC = require('../data/accident_kb.json'); } catch (e) { console.error('accident_kb 없음', String(e)); }
const ACC_RE = /사고|면책|자기 ?부담|할증|보험 ?처리|자차|대물|대인|자손|긴급 ?출동|출동|견인|렉카|레커|방전|배터리|밧데리|시동|타이어|펑크|빵꾸|정비|공업사|카센터|수리|입고|파손|기스|스크래치|긁|흠집|찌그러|문콕|돌빵|유리|경고등|대차|블랙박스|블박|과실|뺑소니|물피|침수|태풍|홍수|도난|도둑|음주|무면허|운전자|운전 ?자격|원데이|1일 ?보험|접수|청구서|전손|폐차|다쳤|부상|부딪|박았|추돌|접촉|충돌|공제조합|1661/;
const isAccident = msgs => !!ACC && msgs.filter(m => m.role === 'user').slice(-4).some(m => ACC_RE.test(m.parts[0].text));
const SYS_ACCIDENT = () => !ACC ? '' : `[사고·보험·긴급출동 안내 — 제트카 사고담당 카카오톡 챗봇의 공식 안내 내용]
사고·파손·보험처리·면책금·긴급출동·정비업체·대차 질문은 아래 내용만 근거로 답합니다. 홈페이지 FAQ와 다르면 이 안내가 우선입니다.
기본 원칙:
${ACC.rules.split('\n').filter(l => !/카카오톡 모바일|마크다운 금지/.test(l)).join('\n')}
- 사고 직후라면 안전 확보 → 렌트카공제조합 1661-7977 접수(ARS 1번 사고, 2번 긴급출동) → 제트카 1522-3501 순서를 먼저 안내합니다.
- 다친 사람이 있으면 119 신고가 가장 먼저입니다.

${ACC.cards.map(c => '■ ' + c.text).join('\n\n')}`;

const SYSTEM = (kb, vehicles, faqs, acc, past) => SYS_STATIC(kb) + (acc ? '\n\n' + SYS_ACCIDENT() : '') + '\n\n' + SYS_DYNAMIC(vehicles, faqs, past);

/* ── Claude (Anthropic Messages API, 스트리밍) ── 고정부에 prompt caching 적용 */
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const FAIL = '지금은 AI 답변이 어려워요. 전화 1522-3501 또는 카카오톡으로 문의해 주세요.';
// Claude 규칙: 첫 메시지는 user, user/assistant 번갈아 → 앞쪽 assistant 제거, 같은 역할 연속은 합침
function toClaude(msgs) {
  const out = [];
  for (const m of msgs) {
    const role = m.role === 'model' ? 'assistant' : 'user', text = m.parts[0].text;
    if (!out.length && role === 'assistant') continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n' + text;
    else out.push({ role, content: text });
  }
  return out;
}
// 요청만 보내고 응답 스트림을 그대로 돌려줌 (첫 응답 전 오류는 여기서 throw)
async function claudeOpen(key, sysStatic, sysDynamic, msgs, sysAcc) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 1500, stream: true,
      output_config: { effort: process.env.CLAUDE_EFFORT || 'low' },   // 내부 생각 최소화(응답 속도·비용)
      system: [
        { type: 'text', text: sysStatic, cache_control: { type: 'ephemeral' } },
        ...(sysAcc ? [{ type: 'text', text: sysAcc, cache_control: { type: 'ephemeral' } }] : []),   // 사고 대화일 때만, 캐시
        { type: 'text', text: sysDynamic }
      ],
      messages: toClaude(msgs)
    })
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(r.status + ' ' + ((j.error && j.error.message) || '')); }
  return r;
}
// Anthropic SSE → 이벤트 객체
async function* sseEvents(body) {
  const dec = new TextDecoder(); let buf = '';
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true }).replace(/\r/g, '');
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
      if (data) { try { yield JSON.parse(data); } catch (e) { /* 무시 */ } }
    }
  }
}

// 간단 속도 제한 (인스턴스 메모리 기준, IP당 10분 30회)
const HITS = new Map();
function limited(ip) {
  const now = Date.now(), arr = (HITS.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); HITS.set(ip, arr); return arr.length > 30;
}
// 관리자 확인 (ADMIN_TOKEN 미설정이면 관리 기능 꺼짐)
const crypto = require('crypto');
function same(a, b) { a = Buffer.from(String(a || '')); b = Buffer.from(String(b || '')); return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b); }
const isAdmin = t => !!process.env.ADMIN_TOKEN && same(t, process.env.ADMIN_TOKEN);

module.exports = async (req, res) => {
  const o = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ORIGINS.test(o) ? o : 'https://jetcar1000.imweb.me');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const key = process.env.ANTHROPIC_API_KEY;
  const q0 = req.query || {};

  if (req.method === 'GET') {
    // 지식베이스: 하루 1번 합치기 (Vercel Cron → Authorization: Bearer CRON_SECRET)
    if (q0.qa === 'compact') {
      const auth = String(req.headers.authorization || '');
      if (!(process.env.CRON_SECRET && same(auth, 'Bearer ' + process.env.CRON_SECRET)) && !isAdmin(q0.token)) return res.status(401).json({ error: 'auth' });
      try { return res.status(200).json({ ok: true, ...(await QA.compact()) }); }
      catch (e) { console.error('qa compact', String(e)); return res.status(500).json({ error: String(e).slice(0, 200) }); }
    }
    // 지식베이스 목록 (관리자)
    if (q0.qa) {
      if (!isAdmin(q0.token)) return res.status(401).json({ error: 'auth' });
      const items = await QA.all({ unknown: !!q0.unknown, q: q0.q });
      return res.status(200).json({ ...QA.stats(), count: items.length, items: items.slice(0, +q0.limit || 300) });
    }
    if (q0.kb) {
      const k = await buildKB(); const q = String(q0.q || '');
      await QA.ready(3000);
      const vs = pickVehicles(k.V, [{ role: 'user', parts: [{ text: q }] }]);
      const fq = pickFaq(k.faq, [{ role: 'user', parts: [{ text: q }] }]);
      const past = q ? QA.similar(q) : [];
      const sys = SYSTEM(k, vs, fq, false, past);
      return res.status(200).json({ ready: !!key, provider: 'claude', model: CLAUDE_MODEL, vehicles: k.V.length, linked: k.V.filter(v => /\/sub0\d01\/\d+/.test(v.url)).length, listItems: k.listN, faqN: k.faq.length, faqPicked: fq.slice(0, 5).map(x => x.q), svcLen: k.svc.length, picked: vs.length, promptChars: sys.length, summary: k.summary.slice(0, 300), sample: vs.slice(0, 3).map(vline), qa: QA.stats(), qaPicked: past.map(p => ({ q: p.q, score: p.score, staff: p.staff })) });
    }
    return res.status(200).json({ ok: true, ready: !!key, provider: 'claude', qa: QA.stats().on });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'json' }); }

  // 지식베이스 수정·삭제 (관리자)
  if (body.admin != null) {
    if (!isAdmin(body.admin)) return res.status(401).json({ error: 'auth' });
    try {
      if (body.action === 'edit' && body.id && body.answer) return res.status(200).json({ ok: await QA.edit(String(body.id), String(body.answer).slice(0, 3000), body.question ? String(body.question).slice(0, 300) : undefined) });
      if (body.action === 'delete' && body.id) return res.status(200).json({ ok: await QA.remove(String(body.id)) });
      return res.status(400).json({ error: 'action' });
    } catch (e) { return res.status(500).json({ error: String(e).slice(0, 200) }); }
  }

  if (!key) return res.status(503).json({ error: 'NO_KEY', reply: 'AI 상담 준비 중입니다. 전화 1522-3501 또는 카카오톡으로 문의해 주세요.' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return res.status(429).json({ reply: '문의가 많아 잠시 후 다시 시도해 주세요. 급하시면 전화 1522-3501로 연락 주세요.' });

  const stream = !!body.stream;
  let started = false, text = '';
  const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  try {
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const msgs = raw.slice(-12)
      .map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 1200) }] }))
      .filter(m => m.parts[0].text);
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'no message' });
    const lastQ = msgs[msgs.length - 1].parts[0].text;
    const isFirst = raw.filter(m => m.role !== 'model').length === 1;

    const [kb] = await Promise.all([buildKB(), QA.ready(1500)]);
    const vehicles = pickVehicles(kb.V, msgs);
    const faqs = pickFaq(kb.faq, msgs);
    const acc = isAccident(msgs);
    const past = QA.similar(lastQ, 3, 0.5);
    const pg = body.page || {};
    const pageCtx = pg.text ? `\n\n[고객이 보고 있는 페이지] ${String(pg.title || '').slice(0, 200)} (${String(pg.url || '').slice(0, 200)})\n${String(pg.text).slice(0, 5000)}` : '';

    const r = await claudeOpen(key, SYS_STATIC(kb), SYS_DYNAMIC(vehicles, faqs, past) + pageCtx, msgs, acc ? SYS_ACCIDENT() : '');
    if (stream) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      if (res.flushHeaders) res.flushHeaders();
      started = true;
    }
    const info = { provider: 'claude', model: CLAUDE_MODEL, usage: {}, accident: acc, past: past.map(p => ({ id: p.id, score: p.score, staff: p.staff })) };
    for await (const ev of sseEvents(r.body)) {
      if (ev.type === 'message_start' && ev.message) { info.model = ev.message.model || info.model; Object.assign(info.usage, ev.message.usage || {}); }
      else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { text += ev.delta.text; if (stream) send({ t: ev.delta.text }); }
      else if (ev.type === 'message_delta') { info.stop = ev.delta && ev.delta.stop_reason; Object.assign(info.usage, ev.usage || {}); }
      else if (ev.type === 'error') throw new Error('stream ' + ((ev.error && ev.error.message) || ''));
    }
    const reply = text.trim();
    if (!reply) throw new Error('empty ' + info.stop);

    // 답변 끝 → 화면 먼저 마무리, 그다음 지식베이스 저장 (저장 실패해도 고객 화면엔 영향 없음)
    if (stream) send(body.debug ? { done: true, info } : { done: true });
    let saved;
    try { saved = await QA.save({ q: lastQ, a: reply, isFirst, acc, page: pg.url }); } catch (e) { console.error('qa save', String(e)); saved = { saved: false, why: 'error' }; }
    if (stream) return res.end();
    return res.status(200).json(body.debug ? { reply, info, saved } : { reply });
  } catch (e) {
    console.error('chat error', String(e));
    if (started) { send(text ? { error: true } : { error: true, t: FAIL }); return res.end(); }
    return res.status(502).json({ error: 'AI', detail: body.debug ? String(e).slice(0, 300) : undefined, reply: FAIL });
  }
};
