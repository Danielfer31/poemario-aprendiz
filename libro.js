import { PageFlip } from "./vendor/page-flip.js";
import { validatePoem, normalizePoem } from "./lib/poems.js";
import { createSound } from "./lib/sound.js";
import { isBirthday } from "./lib/birthday.js";
import { startStars } from "./lib/stars.js";
import { el, formatDate, buildArt, buildSky, buildSong, buildKiss } from "./lib/pieces.js";
import { buildPages, pageForHash } from "./lib/book.js";
import { computeSky } from "./lib/sky.js";
import { startGarden, loadBloomed, saveBloomed } from "./lib/garden.js";
import { createFirebaseSync, createMemorySync } from "./lib/sync.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sound = createSound(window.AudioContext || window.webkitAudioContext);
const stars = startStars(document.getElementById("stars"), { reducedMotion });
const bookEl = document.getElementById("book");
const areaEl = document.getElementById("book-area");
const gardenEl = document.getElementById("garden");
const muteBtn = document.getElementById("mute");
const roomsLink = document.querySelector(".to-rooms");

// A phone on its side: the CSS overlay asks her to turn it, and the book stays inert underneath.
const sideways = window.matchMedia("(orientation: landscape) and (max-height: 499px)");
function syncSideways() {
  for (const node of [areaEl, gardenEl, document.getElementById("topbar")]) node.inert = sideways.matches;
}
syncSideways();
sideways.addEventListener?.("change", syncSideways);

let storage = null;
try { storage = window.localStorage; } catch { /* blocked storage: garden will not persist */ }

let manifest = {};
try {
  manifest = (await import("./assets/manifest.js")).default;
} catch (err) {
  console.warn("assets/manifest.js no se pudo leer; uso adornos propios", err);
}

// The book never draws (owner mode lives in the rooms version); it only watches live strokes.
let sync;
try {
  const config = (await import("./firebase-config.js")).default;
  sync = config ? await createFirebaseSync(config) : createMemorySync();
} catch (err) {
  console.warn("Firebase no disponible; el dibujo en vivo queda en modo local", err);
  sync = createMemorySync();
}

let poemas = [];
try {
  poemas = (await import("./poemas/poemas.js")).default;
} catch (err) {
  console.error("No se pudo leer poemas/poemas.js", err);
  const msg = el("p", "load-error", "No pude leer los poemas. Revisa poemas/poemas.js (una coma o una comilla invertida de más).");
  document.body.append(msg);
}

const valid = poemas
  .filter((p) => {
    const r = validatePoem(p);
    if (!r.ok) console.warn(`Poema omitido (${p?.id ?? "sin id"}):`, r.errors);
    else if (r.warnings.length) console.warn(`Poema «${p.id}»:`, r.warnings);
    return r.ok;
  })
  .map(normalizePoem);
const poemById = new Map(valid.map((p) => [p.id, p]));

const birthday = isBirthday(new Date());
let unlocked = birthday;

/* ---------- size: one page, ~2:3, inside the book area ---------- */
/* Fill the area between the top bar and the garden: ~10px side margins, height first.
   Width may not exceed 0.8 of the height (a page, not a poster). */
function pageSize() {
  const r = areaEl.getBoundingClientRect();
  const h = Math.max(380, r.height - 8);
  const w = Math.min(Math.max(240, r.width - 20), h * 0.8);
  return { w: Math.floor(w), h: Math.floor(h) };
}

/* ---------- capacity: how many verse lines fit on a poem page ---------- */
async function fontsReady() {
  if (!document.fonts) return;
  const timeout = new Promise((r) => setTimeout(r, 2500));
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 18px "Cormorant Garamond"'),
        document.fonts.load('italic 300 30px "Cormorant Garamond"'),
        document.fonts.load('300 12px "Jost"'),
      ]).then(() => document.fonts.ready),
      timeout,
    ]);
  } catch { /* measure with whatever font is there */ }
}

function measureHost(size) {
  const host = el("div", "measure-host");
  host.style.setProperty("--page-w", `${size.w}px`);
  host.style.setProperty("--page-h", `${size.h}px`);
  document.body.append(host);
  return host;
}

function measureCapacity(size) {
  const host = measureHost(size);
  const page = el("div", "page page-paper page-poem");
  const inner = el("div", "page-inner");
  const head = el("header", "poem-head");
  head.append(el("h2", "poem-title", "Título de prueba"), el("p", "poem-date", "11 de noviembre de 2026"));
  const verses = el("div", "verses");
  const stanza = el("p", "stanza");
  stanza.append(el("span", "verse", "Quien enseña como tú"));
  verses.append(stanza);
  inner.append(head, verses);
  page.append(inner);
  host.append(page);
  const lineH = stanza.firstChild.getBoundingClientRect().height || 27;
  const usable = verses.clientHeight; // .verses is the flexible area under the title
  host.remove();
  return Math.max(3, Math.floor(usable / lineH));
}

/* ---------- page builders ---------- */
const live = new Map(); // page index -> Array<(active: boolean) => void>
const guarded = [];      // elements whose taps must not reach StPageFlip

function guard(node) {
  if (!node) return node;
  guarded.push(node);
  return node;
}

function paperPage(kind, extra = "") {
  const page = el("div", `page page-paper page-${kind} ${extra}`.trim());
  page.dataset.density = "soft";
  const inner = el("div", "page-inner");
  page.append(inner);
  return { page, inner };
}

function runningHead(text) {
  return el("p", "running-head", text);
}

let coverTitle = null;

function buildCoverPage() {
  const page = el("div", "page page-cover");
  page.dataset.density = "hard";
  const inner = el("div", "page-inner");
  inner.append(el("p", "eyebrow", "Para Loraine"));
  coverTitle = el("h1", "cover-title", "Poemario de un aprendiz");
  inner.append(guard(coverTitle));
  inner.append(el("p", "sub", "Versos para una maestra, una soñadora, una mujer de fuego."));
  if (birthday) inner.append(el("p", "birthday-line", "Hoy es tu día ✦"));
  inner.append(el("p", "cover-hint", "Arrastra la esquina para abrir"));
  page.append(inner, el("span", "corner-hint", ""));
  return page;
}

function buildBackPage() {
  const page = el("div", "page page-back");
  page.dataset.density = "hard";
  const inner = el("div", "page-inner");
  inner.append(el("p", "back-mark", "✦"), el("p", "back-title", "Poemario de un aprendiz"));
  page.append(inner);
  return page;
}

function buildPoemPage(spec) {
  const poema = poemById.get(spec.poemId);
  const first = !spec.chunkIndex;
  const { page, inner } = paperPage("poem");
  if (first) {
    const head = el("header", "poem-head");
    head.append(el("h2", "poem-title", poema.titulo));
    if (poema.fecha) head.append(el("p", "poem-date", formatDate(poema.fecha)));
    inner.append(head);
  } else {
    inner.append(runningHead(poema.titulo));
  }
  const verses = el("div", "verses");
  for (const lines of spec.chunk) {
    const stanza = el("p", "stanza");
    for (const line of lines) {
      stanza.append(el("span", "verse", line));
    }
    verses.append(stanza);
  }
  inner.append(verses);
  if (spec.cont) page.append(el("span", "cont", "↷"));
  return page;
}

/** A section page: running head, section title, then one centered body. */
function sectionPage(kind, poema, title) {
  const { page, inner } = paperPage(kind, "page-section");
  inner.append(runningHead(poema.titulo), el("h3", "page-label", title));
  const body = el("div", "section-body");
  inner.append(body);
  return { page, body };
}

function addLive(index, fn) {
  live.set(index, [...(live.get(index) ?? []), fn]);
}

function buildSkyPage(spec) {
  const poema = poemById.get(spec.poemId);
  const { page, body } = sectionPage("sky", poema, "El cielo ese día");
  const sky = buildSky(poema.fecha, { manifest });
  if (sky) {
    sky.querySelector(".sky-title")?.remove(); // the page title already says it
    body.append(guard(sky));
  }
  return page;
}

/** "Para ti": the song (tabs + player), then the live drawing, then the kiss button if the poem opts in. */
function buildForYouPage(spec, index) {
  const poema = poemById.get(spec.poemId);
  const { page, body } = sectionPage("for-you", poema, "Para ti");
  const song = buildSong(poema);
  song.node.querySelector(".song-stage")?.setAttribute("data-title", poema.titulo);
  body.append(guard(song.node));
  addLive(index, song.setActive);
  const art = buildArt(poema, { sync, owner: false });
  body.append(guard(art.node));
  addLive(index, art.setActive);
  if (poema.nota) body.append(el("p", "poem-note", poema.nota));
  if (poema.besito) body.append(guard(buildKiss(poema)));
  return page;
}

function buildComingPage() {
  const { page, inner } = paperPage("coming", "page-centered");
  inner.append(
    el("p", "date", "Continuará"),
    el("h2", null, "Pronto, más versos"),
    el("p", null, "Este poemario sigue creciendo, sentimiento a sentimiento."),
  );
  return page;
}

let surprisePage = null;

function buildSurprisePage() {
  const { page, inner } = paperPage("surprise", "page-centered");
  const envelope = el("div", "envelope");
  envelope.append(el("span", "envelope-flap"), el("span", "envelope-seal", "✦"));
  const letter = el("div", "letter");
  letter.append(
    el("p", "date", "13 de febrero"),
    el("h2", null, "Feliz cumpleaños, Loraine"),
    el("p", null, "Maestra, soñadora, capaz. Gracias por enseñarme a amar."),
  );
  inner.append(envelope, el("p", "sealed-note", "No abrir antes del 13 de febrero"), letter);
  if (unlocked) page.classList.add("is-open");
  surprisePage = page;
  return page;
}

function buildPage(spec, index) {
  switch (spec.kind) {
    case "cover": return buildCoverPage();
    case "poem": return buildPoemPage(spec);
    case "sky": return buildSkyPage(spec);
    case "for-you": return buildForYouPage(spec, index);
    case "coming": return buildComingPage();
    case "surprise": return buildSurprisePage();
    case "back": return buildBackPage();
    default: return paperPage("blank").page;
  }
}

/** Number each poem's chunks, so only the first one gets the title. */
function numberChunks(pages) {
  let prev = null, n = 0;
  for (const p of pages) {
    if (p.kind !== "poem") { prev = null; continue; }
    n = p.poemId === prev ? n + 1 : 0;
    p.chunkIndex = n;
    prev = p.poemId;
  }
  return pages;
}

/**
 * Long verses wrap, so the line count can lie. For each poem, lower its capacity until
 * none of its pages overflow, so one poem with long lines does not shorten the others.
 */
function fitCapacities(size, start) {
  const host = measureHost(size);
  const caps = new Map();
  try {
    for (const poema of valid) {
      let cap = start;
      for (; cap > 3; cap--) {
        const specs = numberChunks(buildPages([poema], { capacity: cap, hasSky })).filter((p) => p.kind === "poem");
        host.replaceChildren(...specs.map((sp) => buildPoemPage(sp)));
        // .verses clips its own overflow, so ask it (not .page-inner) whether anything spilled.
        const spill = [...host.querySelectorAll(".verses")].some((n) => n.scrollHeight > n.clientHeight + 1);
        if (!spill) break;
      }
      caps.set(poema.id, cap);
    }
  } finally {
    host.remove();
  }
  return caps;
}

/** A sky page only when the date really gives a sky (buildSky would otherwise render nothing). */
const hasSky = (poema) => Boolean(poema.fecha) && computeSky(poema.fecha) !== null;

/** The book: buildPages' frame, with each poem's pages paginated at its own capacity. */
function sequence(caps) {
  const frame = buildPages([], { capacity: 1 }); // cover, coming, surprise, back
  const body = valid.flatMap((poema) =>
    buildPages([poema], { capacity: caps.get(poema.id), hasSky }).filter((p) => p.poemId === poema.id));
  return numberChunks([frame[0], ...body, ...frame.slice(1)]);
}

/**
 * How many px the section body lacks. Not scrollHeight: a centered flex column overflows
 * on both ends, and scrollHeight only sees the bottom half.
 */
function sectionLack(probe) {
  const body = probe.querySelector(".section-body");
  const kids = body ? [...body.children] : [];
  if (!kids.length) return 0;
  const used = kids.at(-1).getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top;
  return Math.ceil(used - body.clientHeight);
}
function overflows(node) {
  return sectionLack(node) > 1 || [node.querySelector(".page-inner"), node.querySelector(".sky-card")]
    .some((n) => n && n.scrollHeight > n.clientHeight + 1);
}
/**
 * The player and the kiss button must never be clipped, so the drawing gives way:
 * narrow its frame (still 16:10) by exactly what the page lacks in height.
 */
function shrinkArt(node, probe, host) {
  const art = probe.querySelector(".art-wrap");
  if (!art) return;
  const lack = sectionLack(probe);
  if (lack <= 0) return;
  const width = Math.max(140, Math.floor(art.getBoundingClientRect().width - lack * 1.6) - 2);
  const target = node.querySelector(".art-wrap");
  target.style.width = `${width}px`;
  target.style.marginInline = "auto";
  host.replaceChildren(node.cloneNode(true));
}

/**
 * Section pages (sky, para ti, ...) cannot reflow to another page, so check every one
 * offscreen: if one spills, compact it with .is-tight and let the drawing give way.
 */
function fitSections(size, nodes) {
  const host = measureHost(size);
  try {
    for (const node of nodes) {
      if (!node.classList.contains("page-paper") || node.classList.contains("page-poem")) continue;
      let probe = node.cloneNode(true);
      host.replaceChildren(probe);
      if (!overflows(probe)) continue;
      node.classList.add("is-tight");
      probe = node.cloneNode(true);
      host.replaceChildren(probe);
      shrinkArt(node, probe, host);
      probe = host.firstChild;
      if (overflows(probe)) console.warn(`La página ${node.dataset.page} (${node.className}) no cabe completa`);
    }
  } finally {
    host.remove();
  }
}

/* ---------- live content and clones ---------- */
const originals = new Set();

function setLive(index, active) {
  for (const fn of live.get(index) ?? []) fn(active);
}
function allOff() {
  for (const index of live.keys()) setLive(index, false);
}

/**
 * StPageFlip clones the soft page it turns forward (cloneNode(true)). Clones must
 * never hold a live iframe, and a cloned canvas is blank, so copy its pixels.
 */
function tameClone(node) {
  node.querySelectorAll("iframe").forEach((f) => f.remove());
  const source = pageEls[Number(node.dataset.page)];
  if (!source) return;
  const from = source.querySelectorAll("canvas");
  node.querySelectorAll("canvas").forEach((c, i) => {
    const src = from[i];
    if (!src || !src.width || !src.height) return;
    try { c.getContext("2d").drawImage(src, 0, 0); } catch { /* ignore */ }
  });
}

/* ---------- build ---------- */
// Opened sideways: the book is sized for upright reading, so build it once she turns the phone.
if (sideways.matches) {
  await new Promise((resolve) => {
    const upright = () => { if (!sideways.matches) { sideways.removeEventListener("change", upright); resolve(); } };
    sideways.addEventListener("change", upright);
  });
}
await fontsReady();
const size = pageSize();
bookEl.style.width = `${size.w}px`;
bookEl.style.height = `${size.h}px`;
document.documentElement.style.setProperty("--page-w", `${size.w}px`);
document.documentElement.style.setProperty("--page-h", `${size.h}px`);

const specs = sequence(fitCapacities(size, measureCapacity(size)));
const pageEls = specs.map((spec, i) => {
  const node = buildPage(spec, i);
  node.dataset.page = String(i);
  if (spec.kind !== "cover" && spec.kind !== "back") {
    node.append(el("span", "folio", String(i)));
  }
  originals.add(node);
  return node;
});
const surpriseIndex = specs.findIndex((p) => p.kind === "surprise");
fitSections(size, pageEls);

for (const node of guarded) {
  for (const type of ["pointerdown", "mousedown", "touchstart"]) {
    node.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
}

// The garden must be in the DOM and sized before it starts.
let bloomed = loadBloomed(storage);
let userActed = false;
// No sound before the first gesture (browsers block audio, and a deep link may bloom on load).
const gardenSound = { chime: () => { if (userActed) sound.chime(); } };
const garden = startGarden(gardenEl, { manifest, reducedMotion, sound: gardenSound, bloomed });
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => { userActed = true; }, { once: true, capture: true });
}

const flip = new PageFlip(bookEl, {
  width: size.w,
  height: size.h,
  size: "stretch",
  minWidth: size.w,
  maxWidth: size.w,
  minHeight: size.h,
  maxHeight: size.h,
  usePortrait: true,
  showCover: true,
  mobileScrollSupport: false,
  disableFlipByClick: true,
  showPageCorners: true,
  flippingTime: reducedMotion ? 350 : 800,
  maxShadowOpacity: 0.5,
});
flip.loadFromHTML(pageEls);

new MutationObserver((records) => {
  for (const r of records) {
    for (const n of r.addedNodes) {
      if (n.nodeType === 1 && n.classList.contains("stf__item") && !originals.has(n)) tameClone(n);
    }
  }
}).observe(bookEl, { childList: true, subtree: true });

let current = -1;

function arrive(index, { initial = false } = {}) {
  if (index === current) { setLive(index, true); return; }
  current = index;
  allOff();
  setLive(index, true);
  const spec = specs[index];
  if (roomsLink) roomsLink.href = spec?.poemId ? `index.html#${encodeURIComponent(spec.poemId)}` : "index.html";
  if (!initial) sound.tick();
  if (spec?.kind === "poem" && garden.bloom(spec.poemId)) {
    bloomed = [...bloomed, spec.poemId];
    saveBloomed(storage, bloomed);
  }
  if (spec?.kind === "surprise" && unlocked) stars.burst();
}

/* ---------- rotation: the book is built for one size, so rebuild when it changes ---------- */
const PLACE_KEY = "poemario:libro-lugar";
const placeOf = (spec) => spec && { kind: spec.kind, poemId: spec.poemId ?? null, chunkIndex: spec.chunkIndex ?? 0 };

/** The page that best matches a saved place (same poem and kind; same chunk, or its last one). */
function pageForPlace(place) {
  if (!place) return -1;
  const same = specs.map((p, i) => [p, i]).filter(([p]) => p.kind === place.kind && (p.poemId ?? null) === place.poemId);
  if (!same.length) return -1;
  const exact = same.find(([p]) => (p.chunkIndex ?? 0) === place.chunkIndex);
  return (exact ?? same.at(-1))[1];
}

function takeSavedPlace() {
  try {
    const raw = sessionStorage.getItem(PLACE_KEY);
    sessionStorage.removeItem(PLACE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const isPortrait = () => window.innerHeight >= window.innerWidth;
const builtFor = { portrait: isPortrait(), width: window.innerWidth };

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (sideways.matches) return; // wait until she turns it back
    const changed = isPortrait() !== builtFor.portrait || Math.abs(window.innerWidth - builtFor.width) > 40;
    if (!changed) return;
    const spec = specs[flip.getCurrentPageIndex()];
    try { sessionStorage.setItem(PLACE_KEY, JSON.stringify(placeOf(spec))); } catch { /* the hash still finds the poem */ }
    history.replaceState(null, "", spec?.poemId ? `#${encodeURIComponent(spec.poemId)}` : location.pathname);
    location.reload();
  }, 250);
});

const saved = pageForPlace(takeSavedPlace());
const start = saved >= 0 ? saved : pageForHash(specs, location.hash);
if (start > 0) flip.turnToPage(start);
arrive(flip.getCurrentPageIndex(), { initial: true });

flip.on("changeState", (e) => {
  if (e.data === "read") {
    setLive(flip.getCurrentPageIndex(), true);
    return;
  }
  if (e.data === "fold_corner") return; // a corner peek (desktop hover) must not stop a playing song
  allOff(); // a finger is folding the page, or it is turning: nothing live while paper moves
  if (e.data === "flipping") garden.scatter();
});
flip.on("flip", (e) => arrive(e.data));
/* ---------- interactions ---------- */
let taps = 0, tapTimer = 0;
coverTitle?.addEventListener("click", () => {
  taps += 1;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => (taps = 0), 2500);
  if (taps < 5) return;
  taps = 0;
  unlocked = true;
  surprisePage?.classList.add("is-open");
  sound.chime();
  if (surpriseIndex >= 0) flip.flip(surpriseIndex);
});

window.addEventListener("hashchange", () => {
  const i = pageForHash(specs, location.hash);
  if (i !== flip.getCurrentPageIndex()) flip.turnToPage(i);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") flip.flipNext();
  if (e.key === "ArrowLeft") flip.flipPrev();
});

muteBtn.addEventListener("click", () => {
  const muted = sound.toggleMute();
  muteBtn.setAttribute("aria-pressed", String(muted));
  muteBtn.setAttribute("aria-label", muted ? "Activar sonidos" : "Silenciar sonidos");
});
