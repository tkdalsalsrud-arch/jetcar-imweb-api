// 제트카 아임웹 상품 → 차량별 그룹 JSON
// GET /api/cars            → { updated, total, cars:[...] }
// GET /api/cars?raw=1      → 원본 상품 목록 (디버그)
const SITE = 'https://jetcar1000.imweb.me';
const LIST = '/ajax/get_shop_list_view.cm?pagesize=500&category=s202511130e1a8e1a84f3f&sort=&menu_url=%2Fallcar%2F&widget_code=w202511145aff69e4b3664&page=';

const BR = ['현대','기아','제네시스','르노','KGM','KG모빌리티','쉐보레','BYD','테슬라','폭스바겐','미니','MINI','벤츠','아우디','BMW','현대자동차','기아자동차','르노자동차','르노코리아','뉴기아'];
const BA = {현대자동차:'현대',기아자동차:'기아',뉴기아:'기아',르노자동차:'르노',르노코리아:'르노',KG모빌리티:'KGM',MINI:'미니'};
const MB = {그랜저:'현대',아반떼:'현대',쏘나타:'현대',코나:'현대',투싼:'현대',싼타페:'현대',캐스퍼:'현대',베뉴:'현대',팰리세이드:'현대',스타리아:'현대',아이오닉5:'현대',포터:'현대',모닝:'기아',레이:'기아',K5:'기아',K7:'기아',K8:'기아',셀토스:'기아',스포티지:'기아',쏘렌토:'기아',카니발:'기아',니로:'기아',EV3:'기아',EV6:'기아',G80:'제네시스',G90:'제네시스',GV70:'제네시스',GV80:'제네시스',아르카나:'르노',그랑콜레오스:'르노',QM6:'르노',XM3:'르노',토레스:'KGM',티볼리:'KGM',액티언:'KGM',렉스턴:'KGM',무쏘:'KGM',트랙스:'쉐보레',트레일블레이저:'쉐보레',스파크:'쉐보레',돌핀:'BYD',씨라이언7:'BYD',아토:'BYD',모델3:'테슬라',모델Y:'테슬라',골프:'폭스바겐',쿠퍼:'미니',E200:'벤츠',E클래스:'벤츠',Q5:'아우디'};
const MA = {디올뉴그랜저:'그랜저',올뉴그랜저:'그랜저',현대캐스퍼:'캐스퍼',뉴캐스퍼:'캐스퍼',더뉴티볼리:'티볼리',뉴티볼리:'티볼리',티볼리중고:'티볼리',올뉴스포티지:'스포티지',올뉴싼타페:'싼타페',올뉴G80:'G80',뉴QM6:'QM6',뉴셀토스:'셀토스','뉴쏘렌토(MQ4)':'쏘렌토','뉴K5(DL3)':'K5',KGM액티언:'액티언',돌phin:'돌핀',아르카na:'아르카나','Q5(3세대)':'Q5','E클래스(5세대)':'E클래스',액티언HEV:'액티언',렉스턴뉴아레나:'렉스턴',트랙스크로스오버:'트랙스',뉴카니발:'카니발','뉴모닝(JA)':'모닝',올뉴코나:'코나','뉴아반떼(CN7)':'아반떼'};
const CLASS = {모닝:'경소형',레이:'경소형',캐스퍼:'경소형',스파크:'경소형',쿠퍼:'경소형',돌핀:'경소형',아반떼:'중대형',쏘나타:'중대형',K5:'중대형',K7:'중대형',K8:'중대형',그랜저:'중대형',G80:'중대형',G90:'중대형',E200:'중대형',E클래스:'중대형',모델3:'중대형',골프:'중대형',카니발:'승합화물',스타리아:'승합화물',포터:'승합화물',무쏘:'승합화물'};
const FUEL = /^(가솔린|디젤|경유|하이브리드|전기|LPG|LPi|LPI)$/i;
const SKIP = /^(2WD|4WD|AWD|RWD|\d+인승|\d+(\.\d+)?만|디올뉴|더뉴|올뉴|디|더|뉴|연식|카|\/|중고)$/;

function parse(p) {
  let n = p.name.replace(/\[전국\]/g, ' ').replace(/\([^)]*$/, ' ').replace(/\([^)]*\/[^)]*\)/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  let period = null, m;
  if ((m = n.match(/(\d+)\s*개월/))) period = +m[1];
  else if ((m = n.match(/(\d+)\s*년\s*렌트/))) period = +m[1] * 12;
  n = n.replace(/\d+\s*개월|\d+\s*년\s*렌트/g, ' ');
  let year = null;
  if ((m = n.match(/(?:^|\s)(20\d\d)(연식|년형|년식)?(?=\s|$)/))) { year = +m[1]; n = n.replace(/(^|\s)20\d\d(연식|년형|년식)?(?=\s|$)/g, ' '); }
  n = n.replace(/장기렌터카|장기렌트카|장기렌트|무심사렌트카|렌트카|렌터카/g, ' ').replace(/\s+/g, ' ').trim();
  let toks = n.split(' ').filter(Boolean);
  let brand = null;
  if (BR.includes(toks[0])) { brand = BA[toks[0]] || toks[0]; toks = toks.slice(1); }
  toks = toks.filter(t => !SKIP.test(t) || /^(2WD|4WD|AWD|RWD|\d+인승)$/.test(t));
  const mi = toks.findIndex(t => !FUEL.test(t) && !/^(2WD|4WD|AWD|RWD|\d+인승|쥐색|흰색|검정|검은색|회색|은색)$/.test(t));
  let model = mi >= 0 ? toks[mi] : '?';
  const rest = toks.filter((t, i) => i !== mi);
  model = MA[model] || model;
  if (!brand) brand = MB[model] || '기타';
  let fuel = (rest.find(t => FUEL.test(t)) || '').toUpperCase().replace('LPI', 'LPG').replace('경유', '디젤');
  if (fuel === '가솔린'.toUpperCase()) fuel = '가솔린';
  const seats = (rest.find(t => /^\d+인승$/.test(t)) || '').replace('인승', '') || null;
  const drive = rest.find(t => /^(2WD|4WD|AWD|RWD)$/.test(t)) || null;
  // 등급·색상·시트옵션은 전부 trim 에 남긴다 (옵션 다르면 다른 차량으로 표시)
  const trim = rest.filter(t => !FUEL.test(t) && !/^\d+인승$/.test(t) && !/^(2WD|4WD|AWD|RWD)$/.test(t)).join(' ');
  return { brand, model, trim, fuel: fuel || null, seats, drive, year, period, price: p.price, idx: p.idx, img: p.image_url, name: p.name };
}

async function fetchAll() {
  const all = [];
  for (let page = 1; page <= 8; page++) {
    const r = await fetch(SITE + LIST + page, { headers: {
      'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'ko-KR,ko;q=0.9', 'referer': SITE + '/allcar',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('imweb ' + r.status + ' non-json: ' + txt.slice(0, 200).replace(/\s+/g, ' ')); }
    const html = j.html || '';
    const re = /data-product-properties=['"]([^'"]+)['"]/g; let m, cnt = 0;
    while ((m = re.exec(html))) {
      const s = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      try { all.push(JSON.parse(s)); cnt++; } catch (e) {}
    }
    if (cnt < 500) break;
  }
  return all;
}

function group(all) {
  const g = {};
  for (const p of all) {
    const r = parse(p);
    if (r.model === '?' || r.brand === '기타' || !r.price) continue;
    const key = [r.model, r.trim.toLowerCase(), r.year].join('|');
    const e = g[key] || (g[key] = { b: r.brand, m: r.model, c: CLASS[r.model] || 'SUV', t: r.trim, f: r.fuel, s: r.seats, d: r.drive, y: r.year, img: r.img.replace(/\?w=\d+$/, ''), P: {}, n: 0, mi: 0 });
    e.n++; if (!e.f && r.fuel) e.f = r.fuel;
    if (r.idx > e.mi) { e.mi = r.idx; e.img = r.img.replace(/\?w=\d+$/, ''); }
    const k = r.period || 0;
    if (!e.P[k] || r.idx > e.P[k][1]) e.P[k] = [r.price, r.idx]; // 개월수별 최신 등록 1개
  }
  return Object.values(g).map(e => {
    const p = Object.keys(e.P).map(Number).sort((a, b) => a - b).map(k => [k, e.P[k][0], e.P[k][1]]);
    const withP = p.filter(x => x[0] > 0);
    const best = (withP.length ? withP : p).reduce((a, c) => c[1] < a[1] ? c : a);
    return { b: e.b, m: e.m, c: e.c, t: e.t, f: e.f, s: e.s, d: e.d, y: e.y, img: e.img, p, min: best[1], idx: best[2], n: e.n, mi: e.mi };
  }).sort((a, b) => b.mi - a.mi);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  try {
    const all = await fetchAll();
    if (req.query && req.query.raw) return res.status(200).json({ total: all.length, products: all });
    const cars = group(all);
    res.status(200).json({ updated: new Date().toISOString(), total: all.length, cars });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store'); // 오류는 엣지 캐시 금지
    res.status(502).json({ error: String(e) });
  }
};
module.exports.fetchAll = fetchAll;
module.exports.group = group;
