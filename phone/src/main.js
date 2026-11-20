// AïmaneOS Phone: the phone version of Aïmane Benkhadda's 3D portfolio.
// Flow: start screen → 3D terrace table → pick up the phone → phone OS (lock, home, apps).
// The apps show the same AïmaneOS content as the computer version, so both stay in sync.
import { createScene } from "./scene.js";
import { wallpaperSVG } from "./wallpaper.js";
import { ICONS } from "./icons.js";

const T = {
  en: {
    title: "Aïmane Benkhadda · Portfolio 2026",
    sub: "Business Intelligence Analyst",
    language: "Language:",
    intro1: "The phone version of my 3D portfolio.",
    intro2: "Tap START, then pick up the phone.",
    start: "START",
    quick: "In a hurry? Open the quick version (no 3D) →",
    desk: "On a computer? Open the 3D desk →",
    hint: "Tap anywhere to begin",
    pickup: "▶ Pick up the phone",
    down: "↙ Put the phone down",
    unlock: "▲ Swipe up to unlock",
    notifApp: "Messages",
    notif: "Open to data analyst & BI roles · Agadir, Morocco",
    widgetTitle: "About me",
    openTo: "Open to data analyst & BI roles",
    loading: "Starting AïmaneOS…",
    skip: "Skip 3D →",
    home: "Home",
    apps: {
      portfolio: "Portfolio", projects: "Projects", sql: "SQL Console", cv: "My CV", contact: "Contact",
      mines: "Minesweeper", credits: "Credits", github: "GitHub", linkedin: "LinkedIn",
    },
  },
  fr: {
    title: "Aïmane Benkhadda · Portfolio 2026",
    sub: "Analyste BI",
    language: "Langue :",
    intro1: "La version téléphone de mon portfolio 3D.",
    intro2: "Touchez DÉMARRER, puis prenez le téléphone.",
    start: "DÉMARRER",
    quick: "Pressé ? Ouvrir la version rapide, sans 3D →",
    desk: "Sur ordinateur ? Ouvrir le bureau 3D →",
    hint: "Touchez l’écran pour commencer",
    pickup: "▶ Prendre le téléphone",
    down: "↙ Reposer le téléphone",
    unlock: "▲ Glissez vers le haut pour déverrouiller",
    notifApp: "Messages",
    notif: "Disponible pour un poste de data analyst ou d’analyste BI · Agadir, Maroc",
    widgetTitle: "À propos",
    openTo: "Disponible pour un poste data / BI",
    loading: "Démarrage d’AïmaneOS…",
    skip: "Version sans 3D →",
    home: "Accueil",
    apps: {
      portfolio: "Portfolio", projects: "Projets", sql: "Console SQL", cv: "Mon CV", contact: "Contact",
      mines: "Démineur", credits: "Crédits", github: "GitHub", linkedin: "LinkedIn",
    },
  },
};

const LINKS = {
  github: "https://github.com/aymaneben595",
  linkedin: "https://www.linkedin.com/in/a%C3%AFmane-benkhadda-711035392/",
  cv: { en: "../app/files/Aimane_Benkhadda_CV.pdf", fr: "../app/files/Aimane_Benkhadda_CV_FR.pdf" },
};

// What each app opens inside AïmaneOS
const APPS = {
  portfolio: { open: ["portfolio", { page: "home" }] },
  projects: { open: ["portfolio", { page: "projects" }] },
  sql: { open: ["sql"] },
  contact: { open: ["portfolio", { page: "contact" }] },
  mines: { open: ["mines"] },
  credits: { open: ["credits"] },
  cv: { link: () => LINKS.cv[lang] },
  github: { link: () => LINKS.github },
  linkedin: { link: () => LINKS.linkedin },
};
const GRID = ["portfolio", "projects", "sql", "mines", "credits"];
const DOCK = ["contact", "cv", "github", "linkedin"];

// Inside the phone, AïmaneOS shows one app at a time, full screen, without its desktop.
const OS_PHONE_CSS = `
  .taskbar, .icons, .desktop-sign, .desktop-watermark, .win-title, .win-resize { display: none !important; }
  .desktop { height: 100% !important; background: var(--paper) !important; }
  .win { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important;
         padding: 0 !important; box-shadow: none !important; transform: none !important; }
  .win-body { margin-top: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .win.is-fixed .win-body, .win-body:has(.mines) { justify-content: center; align-items: flex-start; padding-top: 18px !important; }
`;

// ------------------------------------------------------------------ language
function pickLang() {
  try {
    const p = new URLSearchParams(location.search).get("lang");
    if (p === "fr" || p === "en") return p;
  } catch (e) {}
  try {
    const s = localStorage.getItem("aos-lang");
    if (s === "fr" || s === "en") return s;
  } catch (e) {}
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}
let lang = pickLang();
const t = () => T[lang];

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

// ------------------------------------------------------------------ build the phone OS
const wall = `url("data:image/svg+xml,${encodeURIComponent(wallpaperSVG())}")`;
document.documentElement.style.setProperty("--wall", wall);

function appButton(key, inDock) {
  const b = el("button", inDock ? "app dock-app" : "app");
  b.type = "button";
  b.dataset.app = key;
  b.innerHTML = `<span class="app-tile">${ICONS[key]}</span><span class="app-label"></span>`;
  b.addEventListener("click", () => openApp(key));
  return b;
}
GRID.forEach((k) => $("#grid").appendChild(appButton(k)));
DOCK.forEach((k) => $("#dock").appendChild(appButton(k, true)));
$("#notif-icon").innerHTML = ICONS.contact;
$("#widget-icon").innerHTML = ICONS.portfolio;

function applyText() {
  const s = t();
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-t]").forEach((n) => (n.textContent = s[n.dataset.t]));
  document.querySelectorAll(".app").forEach((b) => (b.querySelector(".app-label").textContent = s.apps[b.dataset.app]));
  document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
  $("#sb-lang").textContent = lang.toUpperCase();
  const setHref = (sel, href) => {
    const n = $(sel);
    if (n) n.href = href;
  };
  setHref("#quick", `../os/?lang=${lang}`);
  setHref("#skip", `../os/?lang=${lang}`);
  setHref("#desk", `../?desk=1&lang=${lang}`);
  const now = new Date();
  const loc = lang === "fr" ? "fr-FR" : "en-GB";
  const time = now.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  $("#sb-time").textContent = time;
  $("#lock-time").textContent = time;
  $("#lock-date").textContent = date.charAt(0).toUpperCase() + date.slice(1);
  if (appOpen) $("#app-title").textContent = s.apps[appOpen];
}

function setLang(l) {
  if (l === lang) return;
  lang = l;
  try {
    localStorage.setItem("aos-lang", l);
  } catch (e) {}
  applyText();
  if (scene) scene.setLang(l);
  const f = $("#osframe");
  if (f.contentWindow && f.src) f.contentWindow.postMessage({ type: "aos-set-lang", lang: l }, "*");
}
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
$("#sb-lang").addEventListener("click", () => setLang(lang === "en" ? "fr" : "en"));
$("#top-lang").addEventListener("click", () => setLang(lang === "en" ? "fr" : "en"));
setInterval(applyText, 20000);

// ------------------------------------------------------------------ phone screens
const device = $("#device");
let screen = "lock";
let appOpen = null;

function show(name) {
  screen = name;
  device.dataset.screen = name;
}

function unlock() {
  if (screen !== "lock") return;
  show("home");
  bootOS();
}

function goHome() {
  if (screen === "app") {
    appOpen = null;
    show("home");
  }
}

// swipe up: unlock on the lock screen, go home from an app
let swipe = null;
device.addEventListener("pointerdown", (e) => (swipe = { y: e.clientY, x: e.clientX, target: e.target }));
device.addEventListener("pointerup", (e) => {
  if (!swipe) return;
  const dy = e.clientY - swipe.y;
  const fromBottom = window.innerHeight - swipe.y < 70;
  const tgt = swipe.target;
  swipe = null;
  if (screen === "lock" && dy < -40 && !tgt.closest("button")) unlock();
  else if (screen === "app" && dy < -40 && fromBottom) goHome();
});
$("#unlock").addEventListener("click", unlock);
$("#homebar").addEventListener("click", goHome);
$("#app-back").addEventListener("click", goHome);

// ------------------------------------------------------------------ AïmaneOS inside the phone
let osReady = false;
let osWaiters = [];
function bootOS() {
  const f = $("#osframe");
  if (f.src) return;
  f.addEventListener("load", () => {
    try {
      const style = f.contentDocument.createElement("style");
      style.textContent = OS_PHONE_CSS;
      f.contentDocument.head.appendChild(style);
    } catch (e) {}
    const check = setInterval(() => {
      let ready = false;
      try {
        ready = !!(f.contentWindow.__aosOpen && f.contentDocument.querySelector(".os .win"));
      } catch (e) {}
      if (ready) {
        clearInterval(check);
        osReady = true;
        osWaiters.forEach((fn) => fn());
        osWaiters = [];
      }
    }, 120);
  });
  f.src = `../os/?lang=${lang}`;
}
function whenOS(fn) {
  if (osReady) fn();
  else osWaiters.push(fn);
}

function openApp(key) {
  const app = APPS[key];
  if (app.link) {
    window.open(app.link(), "_blank", "noopener");
    return;
  }
  appOpen = key;
  $("#app-title").textContent = t().apps[key];
  $("#app-icon").innerHTML = ICONS[key];
  device.classList.toggle("os-loading", !osReady);
  show("app");
  bootOS();
  whenOS(() => {
    device.classList.remove("os-loading");
    const f = $("#osframe");
    try {
      f.contentWindow.__aosOpen(...app.open);
    } catch (e) {}
  });
}

// ------------------------------------------------------------------ 3D scene and flow
let scene = null;
let stage = "intro"; // intro → idle → table → phone
const hint = $("#hint");
const pickup = $("#pickup");

function setStage(s) {
  stage = s;
  document.body.dataset.stage = s;
}

async function pickUpPhone() {
  if (stage === "phone" || stage === "zoom") return;
  setStage("zoom");
  await scene.to("phone", 1500);
  setStage("phone");
  show("lock");
  device.hidden = false;
  requestAnimationFrame(() => device.classList.add("visible"));
  setTimeout(() => scene.pause(), 450);
}

async function putDown() {
  device.classList.remove("visible");
  scene.resume();
  setTimeout(() => (device.hidden = true), 400);
  appOpen = null;
  setStage("zoom");
  await scene.to("table", 1400);
  setStage("table");
}
$("#putdown").addEventListener("click", putDown);
$("#putdown-home").addEventListener("click", putDown);
pickup.addEventListener("click", pickUpPhone);

function startScene() {
  try {
    scene = createScene($("#scene"), {
      onPhoneTap: () => {
        if (stage === "idle" || stage === "table") pickUpPhone();
      },
      onTap: async () => {
        if (stage === "idle") {
          setStage("zoom");
          await scene.to("table", 1400);
          setStage("table");
        } else if (stage === "table") {
          setStage("zoom");
          await scene.to("idle", 1400);
          setStage("idle");
        }
      },
    });
    scene.setLang(lang);
    return true;
  } catch (e) {
    // No WebGL: go straight to the phone OS
    $("#scene").remove();
    return false;
  }
}

$("#start-btn").addEventListener("click", async () => {
  $("#start").classList.add("gone");
  setTimeout(() => $("#start").remove(), 600);
  if (!scene) {
    setStage("phone");
    show("lock");
    device.hidden = false;
    device.classList.add("visible");
    return;
  }
  setStage("zoom");
  await scene.to("idle", 2600);
  setStage("idle");
});

applyText();
if (startScene()) setStage("intro");
