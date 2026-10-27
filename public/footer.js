/* 제트카 사이트 하단(푸터) 디자인 — 아임웹 푸터 텍스트를 읽어 재배치 (내용 수정은 아임웹 디자인모드 푸터에서) */
(function () {
  if (window.__JF) return; window.__JF = 1;
  var LOGO = "https://cdn.imweb.me/thumbnail/20261026/523a442fcced0.jpg";
  var KAKAO = "https://pf.kakao.com/_aQmWd";
  var KICON = "https://cdn.imweb.me/upload/S202511130fc0ff58a5b6b/f1eb0408cff94.png";
  var CSS =
    "#doz_footer .footer-section{background:#0b1a3a!important;padding:0!important}" +
    "#doz_footer .footer-section .inside{max-width:1200px;margin:0 auto;padding:0 24px}" +
    "#doz_footer .custom-text._footer_text{display:none!important}" +
    "#doz_footer .foot-sociallink{display:none}" +
    ".jf{font-family:'Pretendard Variable',Pretendard,-apple-system,'Noto Sans KR',sans-serif;color:#c3cde6;text-align:left;word-break:keep-all;-webkit-font-smoothing:antialiased}" +
    ".jf *{box-sizing:border-box}.jf a{text-decoration:none!important}" +
    ".jf-top{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:40px;padding:52px 0 40px;border-bottom:1px solid rgba(255,255,255,.1)}" +
    ".jf-logo{display:inline-flex;background:#fff;border-radius:14px;padding:8px 14px;box-shadow:0 8px 20px rgba(0,0,0,.2)}" +
    ".jf-logo img{height:38px;width:auto;display:block}" +
    ".jf-brand p{margin:16px 0 0;font-size:14.5px;line-height:1.6;color:#9fb0d6}" +
    ".jf-brand p b{color:#fff;font-weight:800}" +
    ".jf-cta{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}" +
    ".jf-cta a{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:12px;font-size:14px;font-weight:800;transition:transform .15s}" +
    ".jf-cta a:hover{transform:translateY(-2px)}" +
    ".jf-cta .t{background:#1b4fe0;color:#fff!important}" +
    ".jf-cta .k{background:#FEE500;color:#191919!important}.jf-cta .k img{width:20px;height:20px;border-radius:5px}" +
    ".jf-col h4{margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#6b8cff}" +
    ".jf-col h4:not(:first-child){margin-top:22px}" +
    ".jf-col p{margin:0;font-size:14px;line-height:1.65;color:#d6def0}" +
    ".jf-col .big{font-size:26px;font-weight:900;color:#fff;letter-spacing:-.01em;line-height:1.2}" +
    ".jf-col .big a{color:#fff!important}" +
    ".jf-col small{display:block;margin-top:4px;font-size:12.5px;color:#8a9ac0}" +
    ".jf-bot{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:22px 0 8px}" +
    ".jf-bot .nav,.jf-bot .policy_menu,.jf-bot .footer_menu{display:flex!important;flex-wrap:wrap;gap:4px 20px;margin:0!important;padding:0!important;list-style:none}" +
    ".jf-bot li{list-style:none;margin:0!important;padding:0!important;float:none!important}" +
    ".jf-bot a,.jf-bot a span{color:#c3cde6!important;font-size:13.5px!important;font-weight:600!important;padding:0!important}" +
    ".jf-bot a:hover,.jf-bot a:hover span{color:#fff!important}" +
    ".jf-bot li:nth-child(2) a{color:#fff!important;font-weight:800!important}" +
    ".jf-copy{font-size:12.5px;color:#7d8db3}" +
    ".jf-legal{padding:10px 0 40px}" +
    ".jf-legal .footer-company-info{margin:0!important;text-align:left!important}" +
    ".jf-legal p{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0!important;text-align:left!important}" +
    ".jf-legal span{position:relative;font-size:12px!important;color:#7d8db3!important;line-height:1.7}" +
    ".jf-legal span+span::before{content:'';position:absolute;left:-8px;top:50%;width:1px;height:10px;margin-top:-5px;background:rgba(255,255,255,.15)}" +
    "@media(max-width:900px){.jf-top{grid-template-columns:1fr 1fr}.jf-brand{grid-column:1/-1}}" +
    "@media(max-width:600px){#doz_footer .footer-section .inside{padding:0 18px}.jf-top{grid-template-columns:1fr;gap:26px;padding:36px 0 28px}" +
    ".jf-logo img{height:32px}.jf-cta a{flex:1;justify-content:center}.jf-col .big{font-size:22px}" +
    ".jf-bot{flex-direction:column;align-items:flex-start}.jf-legal{padding-bottom:28px}}";

  function txt(e) { return (e.textContent || "").replace(/\s+/g, " ").trim(); }

  function run() {
    var foot = document.querySelector("#doz_footer .foot-custom");
    if (!foot || foot.getAttribute("data-jf")) return;
    foot.setAttribute("data-jf", "1");
    if (!document.getElementById("jf-css")) {
      var st = document.createElement("style"); st.id = "jf-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    /* 아임웹 푸터 텍스트(키 : 값)에서 정보 읽기 */
    var info = {}, name = "";
    [].forEach.call(foot.querySelectorAll(".custom-text-info p"), function (p) {
      var t = txt(p); if (!t) return;
      var m = t.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
      if (m) info[m[1].trim()] = m[2].trim(); else if (!name) name = t;
    });
    var ci = foot.querySelector(".footer-company-info"), email = "";
    if (ci) [].forEach.call(ci.querySelectorAll("span"), function (s) { var m = txt(s).match(/이메일\s*:\s*(.+)$/); if (m) email = m[1]; });
    var tel = info["TEL"] || info["Tel"] || info["연락처"] || "1522-3501";
    var telHref = "tel:" + tel.replace(/[^\d]/g, "");

    var jf = document.createElement("div"); jf.className = "jf";
    jf.innerHTML =
      '<div class="jf-top">' +
        '<div class="jf-brand"><a class="jf-logo" href="/"><img src="' + LOGO + '" alt="제트카 JETCAR"></a>' +
          '<p><b>신용 걱정 없이, 새 차는 제트카로.</b><br>누구나 · 비대면 · 무심사 장기렌트</p>' +
          '<div class="jf-cta"><a class="t" href="' + telHref + '">📞 전화 상담</a><a class="k" href="' + KAKAO + '" target="_blank" rel="noopener"><img src="' + KICON + '" alt="">카카오톡 상담</a></div>' +
        '</div>' +
        '<div class="jf-col">' +
          (info["주소"] ? '<h4>본사</h4><p>' + info["주소"] + '</p>' : '') +
          (info["대전지사"] ? '<h4>대전지사</h4><p>' + info["대전지사"] + '</p>' : '') +
        '</div>' +
        '<div class="jf-col"><h4>고객센터</h4><p class="big"><a href="' + telHref + '">' + tel + '</a></p><small>전화 · 카카오톡으로 상담하세요</small>' +
          (email ? '<h4>이메일</h4><p>' + email + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="jf-bot"></div><div class="jf-legal"></div>';
    var bot = jf.querySelector(".jf-bot"), legal = jf.querySelector(".jf-legal");
    var nav = foot.querySelector("._footer_menu_wrap");   // 이용약관·개인정보처리방침(아임웹 팝업 동작 유지)
    if (nav) bot.appendChild(nav);
    var cp = document.createElement("span"); cp.className = "jf-copy";
    cp.textContent = "© " + new Date().getFullYear() + " " + (name || "(주)제트카") + ". All rights reserved.";
    bot.appendChild(cp);
    if (ci) legal.appendChild(ci);
    foot.appendChild(jf);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  setTimeout(run, 1500);
})();
