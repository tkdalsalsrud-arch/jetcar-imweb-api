// 상담 질문·답변 지식베이스 (Vercel Blob, 비공개 저장)
// - 답변이 끝날 때마다 qa/log/<시각>-<랜덤>.json 으로 한 건씩 추가 (덮어쓰기 없음 → 동시 저장 충돌 없음)
// - 하루 1번 cron이 log를 qa/index.json 하나로 합치고 log 삭제 (읽기 횟수 절약)
// - 새 질문이 오면 비슷한 과거 질문·답변을 찾아 프롬프트에 참고로 넣음
// - 담당자 수정(edit)·삭제(del)도 log 레코드로 남겨 같은 방식으로 반영
// 환경변수: BLOB_READ_WRITE_TOKEN (Blob 저장소 연결 시 자동 생성). 없으면 이 기능 전체가 꺼짐
const { put, get, list, del } = require('@vercel/blob');

const ON = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const IDX = 'qa/index.json', LOG = 'qa/log/';
const OPT = { access: 'private', contentType: 'application/json', addRandomSuffix: false };
const REFRESH_MS = 15 * 60 * 1000;   // 다른 서버 인스턴스가 저장한 내용은 15분마다 반영
const MAX_ITEMS = 3000;              // 합칠 때 최신 3,000건만 유지

const S = { items: new Map(), logs: new Map(), etag: '', t: 0, idx: [] };
let loading = null;

/* ── 유사도: 단어별 2글자 단위(bigram) 겹침 Dice 계수 ── */
// 같은 뜻 다른 표현 → 하나로 (예: "신용 안 좋아도" = "저신용" = "신용 낮은데")
const SYN = [
  [/저\s*신용\S*|신용\s*(점수|등급)?\s*(이|가)?\s*(낮|안\s*좋|나쁘|불량|없)\S*|신불자?/g, ' 저신용 '],
  [/무\s*보증\S*|보증금\s*(이|가)?\s*(없|0\s*원|영\s*원)\S*/g, ' 무보증 '],
  [/무\s*심사\S*|심사\s*(없|안\s*하|불필요)\S*/g, ' 무심사 '],
  [/얼마나\s*(걸|기다)\S*|기간|며칠|언제\s*(받|나와|출고)\S*/g, ' 기간 '],
  [/월\s*렌트\s*(비|료)|렌트\s*(비|료)|대여\s*료|월\s*납입\S*|월\s*요금|가격|요금|비용|얼마(예요|에요|인가요|죠|나요|야)?/g, ' 가격 '],
  [/전기\s*차|\bev\b/g, ' 전기 '],
  [/접촉\s*사고|사고\s*(가|를)?\s*(났|나서|냈)\S*|박았\S*|부딪\S*/g, ' 사고 '],
  [/중도\s*(해지|반납|해약)\S*|위약금/g, ' 중도해지 '],
  [/만기\s*후?\s*(구매|인수)\S*|인수\S*/g, ' 인수 ']
];
const END = /(인가요|있나요|있을까요|있어요|있습니까|있는지|되나요|될까요|됩니까|되는지|할까요|하나요|해요|싶어요|싶습니다|궁금해요|궁금합니다|알려주세요|알려줘|해주세요|주세요|입니다|이에요|에요|예요|나요|까요|어요|아요|요)$/;
const JOSA = /(으로|에서|에게|까지|부터|은|는|이|가|을|를|도|에|의|로|와|과|랑)$/;
const FILLER = /^(혹시|좀|제트카|그|저|제가|저는|그냥|그리고|근데|장기렌트|렌트|렌트카|장기|차|차량|가능|가능한|가능한가|되|어떻게|어떻|게|있|없|하|해|돼|되나|안|있나|있는|건가|건지)$/;
function grams(s) {
  let t = String(s || '').toLowerCase();
  SYN.forEach(([re, to]) => { t = t.replace(re, to); });
  const g = new Set();
  t.replace(/[^가-힣a-z0-9]/g, ' ').split(/\s+/).forEach(w => {
    if (!w) return;
    w = w.replace(END, ''); if (w.length > 2) w = w.replace(JOSA, '');
    if (!w || FILLER.test(w)) return;
    if (w.length === 1) { g.add(w); return; }
    for (let i = 0; i < w.length - 1; i++) g.add(w.slice(i, i + 2));
    g.add('#' + w);   // 단어 자체도 특징으로 (차종명 구분력 ↑)
  });
  return g;
}
function sim(a, b) {
  if (!a.size || !b.size) return 0;
  let c = 0; a.forEach(x => { if (b.has(x)) c++; });
  let s = 2 * c / (a.size + b.size);
  // 양쪽에 서로 다른 단어가 있으면(예: K8 vs 쏘렌토, 보증금 얼마 vs 보증금 언제) 다른 질문일 가능성 → 감점
  const only = (x, y) => [...x].some(w => w[0] === '#' && !y.has(w));
  if (only(a, b) && only(b, a)) s *= 0.6;
  return s;
}

/* ── 저장 대상 판별·개인정보 가리기 ── */
const FOLLOW = /^(그럼|그러면|그렇다면|그거|그건|그게|이거|이건|저거|저건|위에|위의|아까|방금|그 ?차|이 ?차|네|넵|예|아뇨|아니요|아니|감사|고마|ㅇㅋ|ok|오케이)|그 ?차량|이 ?차량|위 ?차량|말씀하신|추천해주신/i;
const UNKNOWN = /확인되지 않|확인이 필요합니다|상담사 확인이 필요/;
function mask(s) {
  return String(s)
    .replace(/\d{6}\s*-?\s*[1-4]\d{6}/g, '[주민번호]')
    .replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[카드번호]')
    .replace(/01[016789][\s-]?\d{3,4}[\s-]?\d{4}/g, '[휴대폰]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[이메일]')
    .replace(/\d{2,6}-\d{2,6}-\d{2,8}/g, m => /^1[56]\d\d-/.test(m) ? m : '[번호]');
}
// 앞 대화 없이도 뜻이 통하는 질문만 저장 (예: "그럼 보증금은요?" 같은 이어지는 질문은 제외)
function savable(q, isFirst) {
  const t = String(q || '').trim();
  if (t.length < 6 || t.length > 300) return false;
  if (!isFirst && FOLLOW.test(t)) return false;
  return true;
}

/* ── 불러오기 ── */
const readJson = async (path, etag) => {
  const r = await get(path, { access: 'private', useCache: false, ifNoneMatch: etag || undefined });
  if (!r) return { missing: true };
  if (r.statusCode === 304) return { same: true };
  return { data: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag };
};
async function listLogs() {
  const out = []; let cursor;
  do { const r = await list({ prefix: LOG, limit: 1000, cursor }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out.sort((a, b) => a.pathname.localeCompare(b.pathname));
}
function put1(it) { it.g = grams(it.q); S.items.set(it.id, it); }
function apply(rec) {
  if (!rec) return;
  if (rec.type === 'add' && rec.item) put1(rec.item);
  else if (rec.type === 'edit' && S.items.has(rec.id)) { const it = S.items.get(rec.id); if (rec.q) it.q = rec.q; if (rec.a != null) it.a = rec.a; it.staff = true; it.unk = false; it.et = rec.ts; put1(it); }
  else if (rec.type === 'del') S.items.delete(rec.id);
}
function rebuild() {
  S.items = new Map(); S.idx.forEach(it => put1({ ...it }));
  [...S.logs.keys()].sort().forEach(k => apply(S.logs.get(k)));
}
async function refresh(force) {
  if (!ON()) return;
  if (!force && Date.now() - S.t < REFRESH_MS) return;
  if (loading) return loading;
  loading = (async () => {
    const ix = await readJson(IDX, force ? '' : S.etag);
    let changed = false;
    if (ix.data) { S.idx = ix.data.items || []; S.etag = ix.etag; changed = true; }
    else if (ix.missing && S.etag) { S.idx = []; S.etag = ''; changed = true; }
    const blobs = await listLogs();
    const live = new Set(blobs.map(b => b.pathname));
    for (const k of [...S.logs.keys()]) if (!live.has(k)) { S.logs.delete(k); changed = true; }
    const need = blobs.filter(b => !S.logs.has(b.pathname));
    for (let i = 0; i < need.length; i += 25) {
      const part = await Promise.all(need.slice(i, i + 25).map(b => readJson(b.pathname).then(r => [b.pathname, r.data]).catch(() => [b.pathname, null])));
      part.forEach(([k, v]) => { if (v) { S.logs.set(k, v); changed = true; } });
    }
    if (changed) rebuild();
    S.t = Date.now();
  })().catch(e => { console.error('qa load', String(e)); S.t = Date.now() - REFRESH_MS + 60000; })
    .finally(() => { loading = null; });
  return loading;
}
// 요청을 오래 붙잡지 않도록 최대 ms만 기다림 (처음 뜬 서버는 백그라운드로 계속 불러옴)
async function ready(ms) {
  if (!ON()) return;
  const p = refresh(false);
  if (p) await Promise.race([p, new Promise(r => setTimeout(r, ms || 1500))]);
}

/* ── 검색 ── */
// 담당자 확인 답변은 점수 가산. '확인 안 됨' 답변은 담당자가 고치기 전엔 참고하지 않음
function similar(q, n = 3, min = 0.5) {
  const g = grams(q); const out = [];
  S.items.forEach(it => {
    if (it.unk && !it.staff) return;
    const s = sim(g, it.g) + (it.staff ? 0.05 : 0);
    if (s >= min) out.push([it, s]);
  });
  return out.sort((a, b) => b[1] - a[1]).slice(0, n).map(([it, s]) => ({ id: it.id, q: it.q, a: it.a, ts: it.ts, staff: !!it.staff, score: Math.round(s * 100) / 100 }));
}

/* ── 저장 ── */
const rid = () => Math.random().toString(36).slice(2, 8);
const logPath = () => `${LOG}${Date.now()}-${rid()}.json`;
async function writeLog(rec) { const p = logPath(); await put(p, JSON.stringify(rec), OPT); S.logs.set(p, rec); apply(rec); }

// 거의 같은 질문(0.85 이상)이 이미 있으면 새로 저장하지 않음
async function save({ q, a, isFirst, acc, page }) {
  if (!ON() || !savable(q, isFirst) || !a) return { saved: false, why: 'skip' };
  const mq = mask(q).trim(), ma = mask(a).trim();
  const top = similar(mq, 1, 0.85)[0] || [...S.items.values()].find(it => it.unk && sim(grams(mq), it.g) >= 0.85);
  if (top) return { saved: false, why: 'dup', id: top.id };
  const item = { id: Date.now().toString(36) + rid(), q: mq, a: ma.slice(0, 3000), ts: Date.now(), unk: UNKNOWN.test(ma), acc: !!acc, page: page ? String(page).slice(0, 200) : undefined };
  await writeLog({ type: 'add', item });
  return { saved: true, id: item.id, unk: item.unk };
}
async function edit(id, a, q) { await refresh(true); if (!S.items.has(id)) return false; await writeLog({ type: 'edit', id, a, q, ts: Date.now() }); return true; }
async function remove(id) { await refresh(true); if (!S.items.has(id)) return false; await writeLog({ type: 'del', id, ts: Date.now() }); return true; }

// 전체 목록 (관리용)
async function all(opts = {}) {
  await refresh(true);
  let arr = [...S.items.values()].map(({ g, ...it }) => it).sort((a, b) => b.ts - a.ts);
  if (opts.unknown) arr = arr.filter(it => it.unk && !it.staff);
  if (opts.q) { const g = grams(opts.q); arr = arr.map(it => [it, sim(g, grams(it.q))]).filter(x => x[1] >= 0.3).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
  return arr;
}

// log → index 하나로 합치기 (cron 하루 1번)
async function compact() {
  await refresh(true);
  const merged = [...S.logs.keys()];
  const items = [...S.items.values()].map(({ g, ...it }) => it).sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
  await put(IDX, JSON.stringify({ t: Date.now(), items }), { ...OPT, allowOverwrite: true });
  for (let i = 0; i < merged.length; i += 100) await del(merged.slice(i, i + 100));
  S.t = 0; await refresh(true);
  return { items: items.length, mergedLogs: merged.length };
}

const stats = () => ({ on: ON(), items: S.items.size, logs: S.logs.size, loadedAt: S.t || null });

module.exports = { ready, similar, save, edit, remove, all, compact, stats, mask, savable, grams, sim };
