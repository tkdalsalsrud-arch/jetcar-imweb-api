/* 제트카 AI 상담 챗봇 위젯 — 우측 하단 (카카오톡 상담 버튼 위)
   API: https://jetcar-imweb-api.vercel.app/api/chat  (GEMINI_API_KEY 설정 시에만 버튼 노출, ?aichat=1 로 미리보기) */
(function () {
  if (window.__JCHAT) return; window.__JCHAT = 1;
  if (/\/admin/.test(location.pathname)) return;
  var API = "https://jetcar-imweb-api.vercel.app/api/chat";
  var KAKAO = "https://pf.kakao.com/_aQmWd", TEL = "tel:15223501";
  var KEY = "__jc_chat";
  var PREVIEW = /[?&]aichat=1/.test(location.search);

  var CSS =
    ".jch-btn{position:fixed;right:28px;bottom:128px;z-index:2147483000;display:flex;align-items:center;gap:8px;height:56px;padding:0 20px 0 8px;border:0;border-radius:999px;background:#1b4fe0;color:#fff;font:800 15px/1 'Pretendard Variable',Pretendard,-apple-system,'Noto Sans KR',sans-serif;box-shadow:0 12px 28px rgba(27,79,224,.38);cursor:pointer;transition:transform .15s}" +
    ".jch-btn:hover{transform:translateY(-2px)}" +
    ".jch-btn i{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fff;color:#1b4fe0;font-style:normal;font-size:13px;font-weight:900;letter-spacing:-.02em}" +
    ".jch-btn .dot{position:absolute;right:6px;top:6px;width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 2px #1b4fe0}" +
    ".jch-p{position:fixed;right:28px;bottom:128px;z-index:2147483001;width:380px;height:min(600px,calc(100vh - 160px));display:none;flex-direction:column;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.28);font-family:'Pretendard Variable',Pretendard,-apple-system,'Noto Sans KR',sans-serif;color:#111827;word-break:keep-all}" +
    ".jch-p.on{display:flex}.jch-p *{box-sizing:border-box}" +
    ".jch-h{display:flex;align-items:center;gap:10px;padding:14px 14px 14px 16px;background:#0b1a3a;color:#fff}" +
    ".jch-h .av{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#1b4fe0;font-weight:900;font-size:13px}" +
    ".jch-h b{display:block;font-size:15px}.jch-h small{display:block;font-size:11.5px;color:#9fb0d6;margin-top:2px}" +
    ".jch-h .x{margin-left:auto;width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:18px;cursor:pointer}" +
    ".jch-b{flex:1;overflow-y:auto;padding:14px;background:#f5f7fc;display:flex;flex-direction:column;gap:10px}" +
    ".jch-m{max-width:86%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.6;white-space:pre-wrap}" +
    ".jch-m.u{align-self:flex-end;background:#1b4fe0;color:#fff;border-bottom-right-radius:4px}" +
    ".jch-m.a{align-self:flex-start;background:#fff;border:1px solid #e3e8f4;border-bottom-left-radius:4px}" +
    ".jch-m.a a{color:#1b4fe0;font-weight:700;text-decoration:underline}" +
    ".jch-m.t{color:#6b7280}.jch-m.t span{animation:jchB 1.2s infinite}.jch-m.t span:nth-child(2){animation-delay:.2s}.jch-m.t span:nth-child(3){animation-delay:.4s}" +
    "@keyframes jchB{0%,80%,100%{opacity:.25}40%{opacity:1}}" +
    ".jch-q{display:flex;flex-wrap:wrap;gap:6px}.jch-q button{border:1px solid #cdd9ff;background:#fff;color:#1b4fe0;border-radius:999px;padding:7px 11px;font:700 12.5px/1.2 inherit;cursor:pointer}" +
    ".jch-f{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}" +
    ".jch-f textarea{flex:1;resize:none;height:44px;max-height:110px;padding:11px 12px;border:1px solid #d6dbe8;border-radius:12px;font:14px/1.4 inherit;outline:none}" +
    ".jch-f textarea:focus{border-color:#1b4fe0}" +
    ".jch-f button{flex:none;width:52px;border:0;border-radius:12px;background:#1b4fe0;color:#fff;font:800 14px inherit;cursor:pointer}.jch-f button:disabled{opacity:.5}" +
    ".jch-n{padding:6px 12px 9px;background:#fff;font-size:11px;color:#8a90a0;text-align:center}.jch-n a{color:#1b4fe0;font-weight:700}" +
    "@media(max-width:600px){.jch-btn{right:14px;bottom:96px;height:50px;padding:0 16px 0 6px;font-size:14px}.jch-btn i{width:38px;height:38px}" +
    ".jch-p{right:0;bottom:0;width:100%;height:100%;max-height:100dvh;border-radius:0}}";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, function (m, t, u) {
      var ext = /^https?:/.test(u) && u.indexOf(location.host) < 0;
      return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
    });
    s = s.replace(/(^|[\s(])(https:\/\/pf\.kakao\.com\/_aQmWd)/g, '$1<a href="$2" target="_blank" rel="noopener">카카오톡 상담</a>');
    s = s.replace(/1522-3501/g, '<a href="' + TEL + '">1522-3501</a>');
    return s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }
  function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function save(h) { try { sessionStorage.setItem(KEY, JSON.stringify(h.slice(-20))); } catch (e) {} }
  function pageCtx() {
    var el = document.querySelector("#prod_detail_body") || document.querySelector("#doz_body") || document.body;
    var t = (el.innerText || "").replace(/\n\s*\n+/g, "\n").slice(0, 5000);
    var nm = document.querySelector(".jd-panel h1, .jd-panel .nm, #prod_goods_form .view_tit");
    return { url: location.pathname + location.search, title: (nm && nm.textContent.trim()) || document.title.slice(0, 80), text: t };
  }

  function build() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var btn = document.createElement("button"); btn.className = "jch-btn"; btn.type = "button";
    btn.innerHTML = '<i>AI</i>AI 상담<span class="dot"></span>'; btn.setAttribute("aria-label", "AI 상담 열기");
    var p = document.createElement("div"); p.className = "jch-p"; p.setAttribute("role", "dialog");
    p.innerHTML = '<div class="jch-h"><span class="av">AI</span><div><b>제트카 AI 상담</b><small>홈페이지 정보를 바탕으로 바로 답해 드려요</small></div><button class="x" type="button" aria-label="닫기">×</button></div>' +
      '<div class="jch-b"></div>' +
      '<div class="jch-f"><textarea placeholder="궁금한 점을 입력하세요" rows="1"></textarea><button type="button">전송</button></div>' +
      '<div class="jch-n">AI 답변은 참고용이며 최종 조건은 상담사가 안내해요 · <a href="' + TEL + '">1522-3501</a> · <a href="' + KAKAO + '" target="_blank" rel="noopener">카카오톡</a></div>';
    document.body.appendChild(btn); document.body.appendChild(p);
    var box = p.querySelector(".jch-b"), ta = p.querySelector("textarea"), send = p.querySelector(".jch-f button");
    var hist = load(), busy = false;

    function add(role, text) {
      var d = document.createElement("div"); d.className = "jch-m " + (role === "user" ? "u" : "a");
      d.innerHTML = role === "user" ? esc(text) : md(text); box.appendChild(d); box.scrollTop = box.scrollHeight; return d;
    }
    function greet() {
      add("model", "안녕하세요, **제트카 AI 상담**입니다.\n차량·대여료·이용 조건·계약 절차 등 궁금한 점을 물어보세요.");
      var q = document.createElement("div"); q.className = "jch-q";
      ["신용이 안 좋아도 가능한가요?", "보증금은 얼마인가요?", "지금 제일 저렴한 차는?", "계약 절차가 궁금해요"].forEach(function (t) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = t;
        b.onclick = function () { q.remove(); ask(t); }; q.appendChild(b);
      });
      box.appendChild(q);
    }
    function render() { box.innerHTML = ""; if (!hist.length) greet(); hist.forEach(function (m) { add(m.role, m.text); }); }
    function ask(text) {
      text = (text || "").trim(); if (!text || busy) return;
      var q = box.querySelector(".jch-q"); if (q) q.remove();
      hist.push({ role: "user", text: text }); save(hist); add("user", text);
      busy = true; send.disabled = true;
      var t = document.createElement("div"); t.className = "jch-m a t"; t.innerHTML = "답변을 준비하고 있어요<span>.</span><span>.</span><span>.</span>"; box.appendChild(t); box.scrollTop = box.scrollHeight;
      fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: hist, page: pageCtx() }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { var r = j.reply || "지금은 답변이 어려워요. 전화 1522-3501 또는 카카오톡으로 문의해 주세요."; t.remove(); hist.push({ role: "model", text: r }); save(hist); add("model", r); })
        .catch(function () { t.remove(); add("model", "연결이 원활하지 않아요. 전화 1522-3501 또는 카카오톡으로 문의해 주세요."); })
        .then(function () { busy = false; send.disabled = false; ta.focus(); });
    }
    btn.onclick = function () { p.classList.add("on"); btn.style.display = "none"; if (!box.childNodes.length) render(); setTimeout(function () { ta.focus(); }, 50); };
    p.querySelector(".x").onclick = function () { p.classList.remove("on"); btn.style.display = ""; };
    send.onclick = function () { var v = ta.value; ta.value = ""; ask(v); };
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send.onclick(); } });
    if (PREVIEW) btn.onclick();
  }

  function start() {
    fetch(API + "?ping=1").then(function (r) { return r.json(); }).then(function (j) { if (j.ready || PREVIEW) build(); }).catch(function () { if (PREVIEW) build(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
