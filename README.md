# jetcar-imweb-api
제트카 아임웹(jetcar1000.imweb.me) 상품 2,100여 개를 차량별로 묶어 JSON으로 제공하는 Vercel 서버리스 API.

- `GET /api/cars` — `{updated, total, cars[]}` (30분 엣지 캐시, CORS 허용)
- `GET /api/cars?raw=1` — 원본 상품 목록

cars[] 항목: `b`브랜드 `m`차종 `c`차급 `t`등급·색상·옵션 `f`연료 `s`인승 `d`구동 `y`연식 `img`썸네일 `p`[[개월,월렌트료,상품idx]…] (개월수별 최신 등록 1개) `min`최저가 `idx`최저가 상품 `n`상품수 `mi`최신 상품idx

아임웹 홈/검색/상세 코드위젯이 이 API를 읽는다.
