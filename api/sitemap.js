// 전체 상품 사이트맵 — 아임웹 자동 사이트맵은 상품 1,000개까지만 담으므로 전량(2,100+)을 별도 제공
// robots.txt 의 Sitemap: 줄로 참조 (구글은 타 호스트 사이트맵을 robots.txt 경유로 수용)
const { fetchAll } = require('./cars');
const SITE = 'https://jetcar1000.imweb.me';
const PAGES = [['/jetcar', '1.0', 'daily'], ['/allcar', '0.9', 'daily'], ['/9', '0.8', 'daily'], ['/3', '0.8', 'daily'], ['/4', '0.8', 'daily'],
  ['/5', '0.8', 'daily'], ['/6', '0.8', 'daily'], ['/7', '0.8', 'daily'], ['/8', '0.8', 'daily'], ['/contact', '0.5', 'monthly']];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  try {
    const all = await fetchAll();
    const today = new Date().toISOString().slice(0, 10);
    const maxIdx = Math.max(...all.map(p => p.idx));
    const urls = PAGES.map(([u, pr, cf]) => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`);
    for (const p of all.sort((a, b) => b.idx - a.idx)) {
      const recent = maxIdx - p.idx < 400; // 최근 등록 20차종(400개)은 우선순위 높게
      urls.push(`<url><loc>${SITE}/shop_view/${p.idx}</loc><changefreq>${recent ? 'weekly' : 'monthly'}</changefreq><priority>${recent ? '0.7' : '0.4'}</priority>` +
        (p.image_url ? `<image:image><image:loc>${esc(p.image_url.replace(/\?w=\d+$/, ''))}</image:loc><image:title>${esc(p.name)}</image:title></image:image>` : '') + `</url>`);
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(xml);
  } catch (e) {
    res.status(502).send('error: ' + String(e));
  }
};
