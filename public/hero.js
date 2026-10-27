/* 제트카 메인 히어로 차량 슬라이드
 * PICK: 원하는 차종명을 순서대로 넣으면 그 차량만 돌아갑니다. 비워두면 POOL에서 매번 랜덤으로 N대 선택.
 * POOL: 제트카 스튜디오 배경 사진이 있는 차종 (번호판 실사 사진 차종은 제외)
 */
(function () {
  var PICK = [];
  var POOL = ["모닝","코나","모델Y","투싼","캐스퍼","E200","K8","그랑콜레오스","씨라이언7","셀토스","토레스","K5","티볼리","돌핀","아반떼","레이","스포티지","아르카나","액티언","EV3","싼타페","쏘렌토","그랜저","쏘나타","트랙스","렉스턴","트레일블레이저","골프","카니발","모델3","베뉴"];
  var N = 6, SEC = 4;
  var API = "https://jetcar-imweb-api.vercel.app/api/cars";

  /* 하단(푸터) 디자인 */
  if(!document.getElementById("jf-js")){var _f=document.createElement("script");_f.id="jf-js";_f.src="https://jetcar-imweb-api.vercel.app/footer.js";document.body.appendChild(_f)}

  /* 메인 모바일 최적화 CSS (위젯 스타일보다 뒤에 오도록 body 끝에 붙임) */
  if (!document.getElementById("jh-home-css")) {
    var lk = document.createElement("link"); lk.id = "jh-home-css"; lk.rel = "stylesheet";
    lk.href = "https://jetcar-imweb-api.vercel.app/home.css"; document.body.appendChild(lk);
  }

  /* '찾는 차가 없나요?' 배너 보강 (문구·버튼·안내 칩) — 마크업은 위젯 #1, 스타일은 home.css */
  (function () {
    var a = document.querySelector(".jc-find .ask");
    if (!a || a.getAttribute("data-ak")) return;
    a.setAttribute("data-ak", "1");
    var box = a.querySelector("div"), b = box && box.querySelector("b"), btn = a.querySelector("a.btn");
    if (!box || !b) return;
    var k = document.createElement("span"); k.className = "ak-k"; k.textContent = "1:1 차량 찾기 · 무료";
    box.insertBefore(k, b);
    b.innerHTML = "찾는 차가 없나요? <em>제트카가 대신 찾아드려요</em>";
    var c = document.createElement("div"); c.className = "ak-c";
    c.innerHTML = "<span>원하는 차종</span><span>월 예산</span><span>계약 기간</span><span>출고 희망일</span>";
    box.appendChild(c);
    var w = document.createElement("div"); w.className = "ak-b";
    var kk = document.createElement("a"); kk.className = "ak-kk"; kk.href = btn ? btn.href : "https://pf.kakao.com/_aQmWd"; kk.target = "_blank";
    kk.innerHTML = '<img src="https://cdn.imweb.me/upload/S202511130fc0ff58a5b6b/f1eb0408cff94.png" alt="">카카오톡으로 문의하기';
    var tel = document.createElement("a"); tel.className = "ak-tel"; tel.href = "tel:1522-3501"; tel.textContent = "📞 전화 1522-3501";
    w.appendChild(kk); w.appendChild(tel);
    if (btn) btn.style.display = "none";
    a.appendChild(w);
  })();

  /* 메인 맨 아래 상담 CTA 재구성 — 스타일은 home.css (.ct) */
  (function () {
    var s = document.querySelector(".jc-cta");
    if (!s || s.getAttribute("data-ct")) return;
    var w = s.querySelector(".wrap"), h = w && w.querySelector("h2"), p = w && w.querySelector("p"), c = w && w.querySelector(".cta");
    if (!h || !p || !c) return;
    s.setAttribute("data-ct", "1");
    var ct = document.createElement("div"); ct.className = "ct";
    var l = document.createElement("div"); l.className = "ct-l";
    l.innerHTML = '<span class="ct-k">무료 상담 · 부담 없이 물어보세요</span>';
    l.appendChild(h); l.appendChild(p);
    var ch = document.createElement("div"); ch.className = "ct-c";
    ch.innerHTML = "<span>누구나</span><span>비대면 계약</span><span>무심사</span><span>전국 탁송</span>";
    l.appendChild(ch);
    c.className = "ct-r";
    var k = c.querySelector(".btn.k"), t = c.querySelector(".btn.w"), o = c.querySelector(".btn.o");
    if (k) { k.innerHTML = '<img src="https://cdn.imweb.me/upload/S202511130fc0ff58a5b6b/f1eb0408cff94.png" alt="">카카오톡 상담'; c.insertBefore(k, c.firstChild); }
    if (t) t.innerHTML = '<span class="ct-ph">📞</span><span><small>전화 상담</small>1522-3501</span>';
    if (o) o.removeAttribute("style");
    ct.appendChild(l); ct.appendChild(c); w.appendChild(ct);
  })();

  /* 히어로 꾸미기: 카톡 아이콘, 강조 문구, 사진 주변 떠 있는 배지 */
  (function () {
    var h = document.querySelector(".jc-hero");
    if (!h || h.getAttribute("data-hd")) return;
    h.setAttribute("data-hd", "1");
    var k = h.querySelector(".cta .btn.k");
    if (k) k.innerHTML = '<img src="https://cdn.imweb.me/upload/S202511130fc0ff58a5b6b/f1eb0408cff94.png" alt="">카카오톡 상담';
    var p = h.querySelector("p");
    if (p) p.innerHTML = p.innerHTML.replace("저신용·신용불량·개인회생도 OK.", "<b>저신용·신용불량·개인회생도 OK.</b>");
    var art = h.querySelector(".art");
    if (art && !art.parentNode.classList.contains("art-w")) {
      var w = document.createElement("div"); w.className = "art-w";
      art.parentNode.insertBefore(w, art); w.appendChild(art);
      w.insertAdjacentHTML("beforeend",
        '<div class="fb a"><i>📝</i><span>비대면 계약<small>휴대폰으로 서명</small></span></div>' +
        '<div class="fb b"><i>🚚</i><span>전국 탁송<small>원하는 곳으로</small></span></div>');
    }
  })();

  var im = document.getElementById("jcHeroImg");
  if (!im || im.getAttribute("data-jh")) return;
  im.setAttribute("data-jh", "1");
  var art = im.parentNode;
  var chip = art.querySelector(".chip");
  function placeChip() {
    if (!chip) return;
    var m = window.matchMedia("(max-width:600px)").matches;
    if (m && chip.parentNode === art) { art.parentNode.insertBefore(chip, art.nextSibling); chip.classList.add("out"); }
    else if (!m && chip.parentNode !== art) { art.appendChild(chip); chip.classList.remove("out"); }
  }
  placeChip(); window.addEventListener("resize", placeChip);
  function show() { im.style.opacity = "1"; }

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function won(v) { return Math.round(v / 10000) + "만원~"; }

  if (!document.getElementById("jh-css")) {
    var st = document.createElement("style"); st.id = "jh-css";
    st.textContent =
      ".jc-hero .art img{transition:opacity .8s ease}" +
      ".jc-hero .art .jh-b{position:absolute;inset:0;opacity:0}" +
      ".jc-hero .art .jh-tag{position:absolute;right:16px;bottom:16px;z-index:2;display:flex;align-items:center;gap:8px;background:rgba(17,24,39,.82);color:#fff!important;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;text-decoration:none;transition:opacity .4s}" +
      ".jc-hero .art .jh-tag:empty{opacity:0}" +
      ".jc-hero .art .jh-tag b{color:#9cc0ff!important;font-weight:800}" +
      ".jc-hero .art .jh-dots{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:2;display:flex;gap:6px}" +
      ".jc-hero .art{touch-action:pan-y}" +
      ".jc-hero .art .jh-dots{padding:6px 4px}.jc-hero .art .jh-dots i{cursor:pointer;width:6px;height:6px;border-radius:50%;background:rgba(17,24,39,.25);transition:.3s}" +
      ".jc-hero .art .jh-dots i.on{width:18px;border-radius:3px;background:#1b4fe0}" +
      ".jc-hero .art .chip{z-index:2}" +
      ".jc-hero .art img{-webkit-user-drag:none;user-select:none}" +
      ".jc-hero .art .jh-nav{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:6px}" +
      ".jc-hero .art .jh-nav .jh-dots{position:static;transform:none}" +
      ".jc-hero .art .jh-arr{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.92);color:#0b1a3a;font-size:17px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.15);transition:transform .15s,background .15s}" +
      ".jc-hero .art .jh-arr:hover{background:#1b4fe0;color:#fff;transform:scale(1.08)}" +
      ".jc-hero .art.jh-drag{cursor:grabbing!important}" +
      "@media(max-width:600px){.jc-hero .art .jh-arr{display:none}.jc-hero .art .jh-nav{top:6px}}" +
      "@media(max-width:600px){.jc-hero .art .jh-tag{right:10px;bottom:10px;font-size:12px;padding:6px 11px}}";
    document.head.appendChild(st);
  }

  fetch(API).then(function (r) { return r.json(); }).then(function (j) {
    var g = {};
    (j.cars || []).forEach(function (x) { if (x.img && (!g[x.m] || x.mi > g[x.m].mi)) g[x.m] = x; });
    var names = PICK.length ? PICK : shuffle(POOL.slice()).slice(0, N);
    var L = names.map(function (m) { return g[m]; }).filter(Boolean);
    if (!L.length) { show(); return; }

    var b = im.cloneNode(); b.removeAttribute("id"); b.className = "jh-b"; b.alt = "";
    art.insertBefore(b, im.nextSibling);
    var tag = document.createElement("a"); tag.className = "jh-tag"; art.appendChild(tag);
    var dots = document.createElement("div"); dots.className = "jh-dots";
    var prev = document.createElement("button"), next = document.createElement("button");
    if (L.length > 1) {
      L.forEach(function () { dots.appendChild(document.createElement("i")); });
      var nav = document.createElement("div"); nav.className = "jh-nav";
      prev.type = next.type = "button"; prev.className = next.className = "jh-arr";
      prev.innerHTML = "&#8249;"; next.innerHTML = "&#8250;"; prev.setAttribute("aria-label", "이전 차량"); next.setAttribute("aria-label", "다음 차량");
      nav.appendChild(prev); nav.appendChild(dots); nav.appendChild(next); art.appendChild(nav);
    }

    var k = -1, front = im, back = b, seq = 0, timer = null;
    function src(x) { return x.img + "?w=900"; }
    function label(x) {
      tag.href = "/allcar/?idx=" + x.idx;
      tag.innerHTML = x.b + " " + x.m + " <b>월 " + won(x.min) + "</b>";
      im.alt = back.alt = x.b + " " + x.m + " 장기렌트";
      /* PC: 화살표 버튼 + 마우스 드래그로 넘기기, 마우스 올리면 자동넘김 일시정지 */
    prev.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); goTo(k - 1); restart(); });
    next.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); goTo(k + 1); restart(); });
    var mx = null;
    art.addEventListener("dragstart", function (e) { e.preventDefault(); });
    art.addEventListener("mousedown", function (e) { if (e.button !== 0 || e.target.closest(".jh-nav,.jh-tag,.chip")) return; mx = e.clientX; });
    window.addEventListener("mousemove", function (e) { if (mx !== null && Math.abs(e.clientX - mx) > 8) art.classList.add("jh-drag"); });
    window.addEventListener("mouseup", function (e) {
      if (mx === null) return; var dx = e.clientX - mx; mx = null; art.classList.remove("jh-drag");
      if (L.length > 1 && Math.abs(dx) > 40) { swiped = true; setTimeout(function () { swiped = false; }, 400); goTo(k + (dx < 0 ? 1 : -1)); restart(); }
    });
    art.addEventListener("mouseenter", function () { if (timer) { clearInterval(timer); timer = null; } });
    art.addEventListener("mouseleave", function () { mx = null; art.classList.remove("jh-drag"); restart(); });
    [].forEach.call(dots.children, function (d, i) { d.className = i === k ? "on" : ""; });
    }
    function goTo(i) {
      k = (i + L.length) % L.length;
      var x = L[k], my = ++seq, pre = new Image();
      label(x);
      pre.onload = function () {
        if (my !== seq) return;                      // 빠르게 넘긴 경우 마지막 것만 표시
        back.src = src(x); back.style.opacity = "1"; front.style.opacity = "0";
        var t = front; front = back; back = t;
      };
      pre.src = src(x);
    }
    function restart() { if (timer) clearInterval(timer); if (L.length > 1) timer = setInterval(function () { goTo(k + 1); }, SEC * 1000); }
    show(); goTo(0); restart();

    /* 손가락으로 좌우 넘기기 + 사진 클릭 시 해당 차량으로 이동 */
    var sx = 0, sy = 0, swiped = false;
    art.style.cursor = "pointer";
    art.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiped = false; }, { passive: true });
    art.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (L.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) { swiped = true; setTimeout(function () { swiped = false; }, 400); goTo(k + (dx < 0 ? 1 : -1)); restart(); }
    }, { passive: true });
    /* PC: 화살표 버튼 + 마우스 드래그로 넘기기, 마우스 올리면 자동넘김 일시정지 */
    prev.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); goTo(k - 1); restart(); });
    next.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); goTo(k + 1); restart(); });
    var mx = null;
    art.addEventListener("dragstart", function (e) { e.preventDefault(); });
    art.addEventListener("mousedown", function (e) { if (e.button !== 0 || e.target.closest(".jh-nav,.jh-tag,.chip")) return; mx = e.clientX; });
    window.addEventListener("mousemove", function (e) { if (mx !== null && Math.abs(e.clientX - mx) > 8) art.classList.add("jh-drag"); });
    window.addEventListener("mouseup", function (e) {
      if (mx === null) return; var dx = e.clientX - mx; mx = null; art.classList.remove("jh-drag");
      if (L.length > 1 && Math.abs(dx) > 40) { swiped = true; setTimeout(function () { swiped = false; }, 400); goTo(k + (dx < 0 ? 1 : -1)); restart(); }
    });
    art.addEventListener("mouseenter", function () { if (timer) { clearInterval(timer); timer = null; } });
    art.addEventListener("mouseleave", function () { mx = null; art.classList.remove("jh-drag"); restart(); });
    [].forEach.call(dots.children, function (d, i) { d.addEventListener("click", function (e) { e.stopPropagation(); goTo(i); restart(); }); });
    art.addEventListener("click", function (e) {
      if (swiped) { swiped = false; e.preventDefault(); return; }
      if (e.target.closest(".jh-tag") || e.target.closest(".chip") || e.target.closest(".jh-nav")) return;
      if (tag.href) location.href = tag.href;
    });
  }).catch(show);
})();
