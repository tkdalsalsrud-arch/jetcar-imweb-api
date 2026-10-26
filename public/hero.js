/* 제트카 메인 히어로 차량 슬라이드
 * PICK: 원하는 차종명을 순서대로 넣으면 그 차량만 돌아갑니다. 비워두면 POOL에서 매번 랜덤으로 N대 선택.
 * POOL: 제트카 스튜디오 배경 사진이 있는 차종 (번호판 실사 사진 차종은 제외)
 */
(function () {
  var PICK = [];
  var POOL = ["모닝","코나","모델Y","투싼","캐스퍼","E200","K8","그랑콜레오스","씨라이언7","셀토스","토레스","K5","티볼리","돌핀","아반떼","레이","스포티지","아르카나","액티언","EV3","싼타페","쏘렌토","그랜저","쏘나타","트랙스","렉스턴","트레일블레이저","골프","카니발","모델3","베뉴"];
  var N = 6, SEC = 4;
  var API = "https://jetcar-imweb-api.vercel.app/api/cars";

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

  var im = document.getElementById("jcHeroImg");
  if (!im || im.getAttribute("data-jh")) return;
  im.setAttribute("data-jh", "1");
  var art = im.parentNode;
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
      ".jc-hero .art .jh-dots i{width:6px;height:6px;border-radius:50%;background:rgba(17,24,39,.25);transition:.3s}" +
      ".jc-hero .art .jh-dots i.on{width:18px;border-radius:3px;background:#1b4fe0}" +
      ".jc-hero .art .chip{z-index:2}" +
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
    if (L.length > 1) { L.forEach(function () { dots.appendChild(document.createElement("i")); }); art.appendChild(dots); }

    var k = 0, front = im, back = b;
    function src(x) { return x.img + "?w=900"; }
    function label(x) {
      tag.href = "/allcar/?idx=" + x.idx;
      tag.innerHTML = x.b + " " + x.m + " <b>월 " + won(x.min) + "</b>";
      im.alt = back.alt = x.b + " " + x.m + " 장기렌트";
      [].forEach.call(dots.children, function (d, i) { d.className = i === k ? "on" : ""; });
    }
    function go() {
      k = (k + 1) % L.length;
      var x = L[k], pre = new Image();
      pre.onload = function () {
        back.src = src(x); back.style.opacity = "1"; front.style.opacity = "0";
        var t = front; front = back; back = t; label(x);
      };
      pre.src = src(x);
    }
    show(); k = -1; go();
    if (L.length > 1) setInterval(go, SEC * 1000);
  }).catch(show);
})();
