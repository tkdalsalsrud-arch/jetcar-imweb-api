# jetcar-imweb-api
제트카 아임웹(jetcar1000.imweb.me) 상품 2,100여 개를 차량별로 묶어 JSON으로 제공하는 Vercel 서버리스 API.

- `GET /api/cars` — `{updated, total, cars[]}` (30분 엣지 캐시, CORS 허용)
- `GET /api/cars?raw=1` — 원본 상품 목록

cars[] 항목: `b`브랜드 `m`차종 `c`차급 `t`등급·색상·옵션 `f`연료 `s`인승 `d`구동 `y`연식 `img`썸네일 `p`[[개월,월렌트료,상품idx]…] (개월수별 최신 등록 1개) `min`최저가 `idx`최저가 상품 `n`상품수 `mi`최신 상품idx

아임웹 홈/검색/상세 코드위젯이 이 API를 읽는다.

## AI 상담 챗봇 `/api/chat` (위젯: `/chat.js`)
- Claude 단독(Gemini 대체 경로 없음). 답변은 스트리밍(`stream:true` → `text/event-stream`)
- 상담 지식베이스 `lib/qa.js`: 답변마다 질문·답변을 Vercel Blob(비공개)에 저장 → 비슷한 질문이 오면 과거 답변을 프롬프트에 참고로 넣음
  - 금액·차량은 항상 현재 홈페이지 자료 기준, 담당자 수정 답변은 `[담당자 확인]`으로 우선 적용
  - 이어지는 질문("그럼 ~은요?")·거의 같은 질문은 저장 안 함, 전화번호 등은 가려서 저장
  - 목록 `GET /api/chat?qa=list&token=ADMIN_TOKEN[&unknown=1][&q=검색어]`
  - 수정 `POST /api/chat {admin, action:'edit', id, answer}` / 삭제 `{admin, action:'delete', id}`
  - 매일 03시(KST) cron `/api/qa-compact`가 log를 index 하나로 합침
- 환경변수: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`(기본 claude-sonnet-5-5), `CLAUDE_EFFORT`(기본 low), `BLOB_READ_WRITE_TOKEN`(Blob 연결 시 자동), `ADMIN_TOKEN`, `CRON_SECRET`
