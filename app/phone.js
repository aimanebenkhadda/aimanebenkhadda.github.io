/* Phones are sent to the phone version (/phone/).
 * If someone still opens the 3D desk on a phone (?desk=1), the monitor is too small
 * to use, so after the camera zooms into it the computer screen opens full-screen.
 * Desktop and tablets are untouched. */
(function () {
  "use strict";

  var phoneQuery = window.matchMedia(
    "(max-width: 767px), (pointer: coarse) and (max-height: 520px)"
  );

  // Phones get their own version: a terrace table in Agadir and a phone running AïmaneOS.
  // "?desk=1" keeps the 3D desk on a phone (for people who want the computer version).
  if (phoneQuery.matches && !/[?&]desk=1/.test(location.search)) {
    var l = "en";
    try {
      var p = new URLSearchParams(location.search).get("lang");
      var s = localStorage.getItem("aos-lang");
      l = p === "fr" || p === "en" ? p : s === "fr" || s === "en" ? s
        : (navigator.language || "en").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
    } catch (e) {}
    location.replace("phone/?lang=" + l);
    return;
  }
  var TEXT = {
    en: { open: "▶ Turn on the computer", back: "← Back to the desk" },
    fr: { open: "▶ Allumer l’ordinateur", back: "← Retour au bureau" },
  };

  var overlay, frame, backBtn, openBtn;
  var isOpen = false;
  var openTimer = null;
  var frameLang = null;

  function isPhone() {
    return phoneQuery.matches;
  }
  function lang() {
    return document.documentElement.lang === "fr" ? "fr" : "en";
  }
  function cam() {
    return window.__aosCam;
  }

  function injectStyles() {
    var css =
      "#aos-phone-open{position:fixed;left:50%;bottom:calc(10vh + 24px + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);z-index:9000;display:none;padding:14px 22px;" +
      "font:700 15px/1 'Courier New',monospace;letter-spacing:.5px;color:#fff;background:#000;" +
      "border:3px solid #fff;box-shadow:0 0 0 3px #000;cursor:pointer;white-space:nowrap;" +
      "animation:aosPulse 1.6s ease-in-out infinite;-webkit-tap-highlight-color:transparent}" +
      "#aos-phone-open.show{display:block}" +
      "@keyframes aosPulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.05)}}" +
      "#aos-phone-screen{position:fixed;top:0;right:0;bottom:0;left:0;" +
      "z-index:10000;display:none;flex-direction:column;" +
      "background:#0a0d1f;opacity:0;transition:opacity .45s ease}" +
      "#aos-phone-screen.show{display:flex}" +
      "#aos-phone-screen.visible{opacity:1}" +
      "#aos-phone-bar{flex:0 0 auto;display:flex;align-items:center;" +
      "padding:calc(6px + env(safe-area-inset-top)) 10px 6px;background:#000;border-bottom:2px solid #fff}" +
      "#aos-phone-back{font:700 14px/1 'Courier New',monospace;color:#fff;background:#000;" +
      "border:2px solid #fff;padding:9px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      "#aos-phone-frame{flex:1 1 auto;width:100%;border:0;display:block;background:#0a0d1f}" +
      // The top info bar was 24px wider than a phone screen, which made the
      // whole page zoom out slightly. Keep everything inside the screen width.
      "@media (max-width:767px){html,body{overflow-x:hidden}" +
      ".interface-wrapper{width:calc(100% - 24px)!important}}";
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function build() {
    injectStyles();

    openBtn = document.createElement("button");
    openBtn.id = "aos-phone-open";
    openBtn.type = "button";
    // Keep this tap from also moving the 3D camera.
    openBtn.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });
    openBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (cam()) cam().trigger("enterMonitor");
    });
    document.body.appendChild(openBtn);

    overlay = document.createElement("div");
    overlay.id = "aos-phone-screen";
    var bar = document.createElement("div");
    bar.id = "aos-phone-bar";
    backBtn = document.createElement("button");
    backBtn.id = "aos-phone-back";
    backBtn.type = "button";
    backBtn.addEventListener("click", closeScreen);
    bar.appendChild(backBtn);
    overlay.appendChild(bar);
    frame = document.createElement("iframe");
    frame.id = "aos-phone-frame";
    frame.title = "AïmaneOS";
    overlay.appendChild(frame);
    // Keep taps on the full-screen computer away from the 3D camera.
    overlay.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });
    document.body.appendChild(overlay);
    refreshText();
  }

  function refreshText() {
    var t = TEXT[lang()];
    if (openBtn) openBtn.textContent = t.open;
    if (backBtn) backBtn.textContent = t.back;
  }

  function openScreen() {
    if (isOpen) return;
    isOpen = true;
    openBtn.classList.remove("show");
    var l = lang();
    if (!frame.src) {
      frame.src = "os/?lang=" + l;
      frameLang = l;
    } else if (frameLang !== l && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "aos-set-lang", lang: l }, "*");
      frameLang = l;
    }
    refreshText();
    overlay.classList.add("show");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add("visible");
      });
    });
  }

  function closeScreen() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("visible");
    setTimeout(function () {
      if (!isOpen) overlay.classList.remove("show");
    }, 450);
    if (cam()) cam().trigger("leftMonitor");
  }

  // Messages from the full-screen computer stay out of the 3D scene,
  // except language changes, which keep both in sync.
  window.addEventListener(
    "message",
    function (e) {
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.data && e.data.type === "aos-lang") {
        frameLang = e.data.lang;
        setTimeout(refreshText, 0);
        return;
      }
      e.stopImmediatePropagation();
    },
    true
  );

  // A tap on the small monitor in the 3D room also turns the computer on
  // (instead of zooming the camera back out).
  document.addEventListener(
    "mousedown",
    function (e) {
      var c = cam();
      if (!isPhone() || isOpen || !c) return;
      if (!e.target || e.target.id !== "computer-screen") return;
      e.stopImmediatePropagation();
      if (c.currentKeyframe !== "monitor" && c.targetKeyframe !== "monitor") {
        c.trigger("enterMonitor");
      }
    },
    true
  );

  window.addEventListener("aos-enter-monitor", function () {
    if (!isPhone() || isOpen) return;
    clearTimeout(openTimer);
    // Let the camera zoom into the monitor first, then turn the screen on.
    openTimer = setTimeout(openScreen, 1300);
  });
  window.addEventListener("aos-left-monitor", function () {
    clearTimeout(openTimer);
  });

  // The "Click anywhere to begin" hint, so it can step aside for the button.
  function hintBox() {
    var ps = document.querySelectorAll("#ui p");
    for (var i = 0; i < ps.length; i++) {
      if (/^(Click anywhere to begin|Cliquez n’importe où pour commencer)/.test(ps[i].textContent)) {
        return ps[i].parentElement;
      }
    }
    return null;
  }

  // Show the "turn on" button when the camera rests at the desk.
  setInterval(function () {
    if (!openBtn) return;
    var c = cam();
    var ready =
      isPhone() &&
      !isOpen &&
      c &&
      !c.targetKeyframe &&
      c.currentKeyframe === "desk";
    var hint = isPhone() ? hintBox() : null;
    if (ready) {
      refreshText();
      openBtn.classList.add("show");
      if (hint) hint.style.visibility = "hidden";
    } else {
      openBtn.classList.remove("show");
      if (hint && c && c.currentKeyframe === "idle") hint.style.visibility = "";
    }
    if (isOpen && !isPhone()) closeScreen();
  }, 300);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
