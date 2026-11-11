// 제트카 홈페이지 AI 상담 챗봇 API
// POST /api/chat  { messages:[{role:'user'|'model', text}], page:{url,title,text} }  → { reply }
// GET  /api/chat?ping=1  → { ok, ready }  (위젯 노출 여부 판단용)
// 답변 근거 = 제트카 홈페이지 실시간 데이터: 차량 목록(/api/cars와 동일), 자주묻는질문(/contact), 상세 하단 공통 안내, 고객이 보고 있는 페이지 본문
// 환경변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택)
const { fetchAll, group } = require('./cars');

const SITE = 'https://jetcar1000.imweb.me';
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
const ORIGINS = /^https:\/\/(jetcar1000\.imweb\.me|(www\.)?jetcar\.co\.kr|jetcar-imweb-api\.vercel\.app)$/;

// 상세페이지 하단 공통 영역(모든 차량 상세에 들어가는 안내) — 홈페이지 문구 그대로
const COMMON = `
[제트카 장기렌트 공통 안내 — 차량 상세페이지 하단]
- 슬로건: 신용 걱정 없이, 새 차는 제트카로 / 누구나 · 비대면 · 무심사 / 원하는 곳까지 차량을 탁송해 드립니다.
- 제트카가 쉬운 이유: ① 신용조회 없이 계약(신용점수·연체·개인회생 이력과 무관) ② 비대면 계약(카카오톡·전화 상담으로 방문 없이 진행) ③ 다음날 배차(오후 3시 이전 결제 시 다음날 정오까지 배차) ④ 12~60개월 계약(차량별로 원하는 기간 선택)
- 진행 절차: 1) 카카오톡 상담 또는 전화로 신청, 원하는 차량 재고 문의 2) 심사 서류 준비: 면허증, 운전경력증명서, 주민등록등본 3) 심사 승인 후 안내된 절차에 따라 내용 확인·동의 4) 진행 중 문의는 신속 답변 5) 오후 3시 이전 결제 완료 시 다음날 정오까지 담당 직원이 직접 배차, 배송지에서 차량 확인·계약서 작성 후 바로 운행
- 유의사항: 이용기간 12~60개월(차량마다 다름) / 중도 해지 시 해지위약금 30% / 필수서류 누락·절차 미이행 시 계약 취소 또는 추가 절차 발생 가능
- 상담: 전화 1522-3501, 카카오톡 채널 https://pf.kakao.com/_aQmWd
`;

let KB = { t: 0, text: '', carsN: 0 };

function htmlText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const man = v => (Math.round(v / 1000) / 10).toString().replace(/\.0$/, '') + '만원';

async function buildKB() {
  if (KB.text && Date.now() - KB.t < 30 * 60 * 1000) return KB;
  const UA = { 'user-agent': 'Mozilla/5.0 (JETCAR-AI-Chat)', 'accept-language': 'ko-KR' };
  const [cars, faqHtml] = await Promise.all([
    fetchAll().then(group).catch(() => []),
    fetch(SITE + '/contact', { headers: UA }).then(r => r.text()).catch(() => '')
  ]);
  let faq = htmlText(faqHtml);
  const a = faq.indexOf('제트카 장기렌터카 FAQ'); if (a >= 0) faq = faq.slice(a);
  const z = faq.search(/상호\s*[:：]|사업자등록번호|통신판매업/); if (z > 0) faq = faq.slice(0, z);
  faq = faq.replace(/▼/g, '').slice(0, 14000);
  const lines = cars.map(c => {
    const terms = c.p.filter(x => x[0] > 0).map(x => `${x[0]}개월 ${man(x[1])}`).join(', ');
    return `- ${c.b} ${c.m}${c.t ? ' ' + c.t : ''} | ${[c.f, c.y && c.y + '년식', c.s && c.s + '인승', c.d].filter(Boolean).join(' · ')} | 월 ${man(c.min)}~${terms ? ' (' + terms + ')' : ''} | 링크: /allcar/?idx=${c.idx}`;
  });
  KB = {
    t: Date.now(), carsN: cars.length,
    text: `[현재 홈페이지 등록 차량 ${cars.length}종 — 홈페이지 표시 월 대여료, 보증금·재고는 상담 시 확인]\n${lines.join('\n')}\n\n[자주묻는질문 페이지 ${SITE}/contact]\n${faq}\n${COMMON}`
  };
  return KB;
}

const SYSTEM = kb => `당신은 장기렌트 회사 (주)제트카(JETCAR) 홈페이지의 AI 상담원입니다.
규칙:
1. 아래 [제트카 홈페이지 자료]와 [고객이 보고 있는 페이지]에 있는 내용만 근거로 답합니다. 자료에 없는 조건·금액·정책은 추측하지 말고 "홈페이지에서 확인되지 않는 내용이라 상담사 확인이 필요합니다"라고 말한 뒤 전화(1522-3501)나 카카오톡 상담을 안내합니다.
2. 한국어 존댓말, 짧고 친절하게(보통 3~6줄). 목록이 필요하면 "- "로 시작하는 줄을 씁니다. 강조는 **굵게**.
3. 차량을 추천·안내할 때는 차량명과 월 대여료를 쓰고 링크를 [차량명](/allcar/?idx=번호) 형식으로 붙입니다. 금액은 자료의 표시가 그대로, "~부터"임을 밝힙니다. 최대 5대까지.
4. 심사 승인·출고 일정·최종 금액을 확정해서 약속하지 않습니다. 최종 조건은 상담사가 안내한다고 말합니다.
5. 주민등록번호·카드번호·계좌번호 같은 개인정보는 요청하지도 받지도 않습니다. 고객이 보내면 지우고 상담사에게 직접 전달하라고 안내합니다.
6. 제트카와 무관한 질문(다른 회사 비교 비방, 일반 잡담, 코딩 등)은 정중히 장기렌트 상담으로 돌립니다.
7. 상담 연결이 필요하면: 전화 1522-3501 / 카카오톡 https://pf.kakao.com/_aQmWd

[제트카 홈페이지 자료 — 실시간]
${kb}`;

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
    if (req.query && req.query.kb) { const k = await buildKB(); return res.status(200).json({ ready: !!key, carsN: k.carsN, len: k.text.length, faq: k.text.includes('자주묻는질문') && k.text.length > 3000, sample: k.text.slice(0, 300) }); }
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
    const pg = body.page || {};
    const pageCtx = pg.text ? `\n\n[고객이 보고 있는 페이지] ${String(pg.title || '').slice(0, 200)} (${String(pg.url || '').slice(0, 200)})\n${String(pg.text).slice(0, 5000)}` : '';
    const reply = await gemini(key, SYSTEM(kb.text) + pageCtx, msgs);
    res.status(200).json({ reply });
  } catch (e) {
    console.error('chat error', String(e));
    res.status(502).json({ error: 'AI', reply: '지금은 AI 답변이 어려워요. 전화 1522-3501 또는 카카오톡으로 문의해 주세요.' });
  }
};
