import { splitStanzas, validatePoem, normalizePoem } from "./lib/poems.js";
import { toEmbedUrl } from "./lib/spotify.js";
import { toAppleEmbedUrl } from "./lib/applemusic.js";
import { computeSky, renderWheel, poeticLine } from "./lib/sky.js";
import { createSound } from "./lib/sound.js";
import { step, clampIndex } from "./lib/nav.js";
import { isBirthday } from "./lib/birthday.js";
import { startStars } from "./lib/stars.js";
import { startDecor } from "./lib/decor.js";
import { attachDrawing } from "./lib/drawing.js";
import { createFirebaseSync, createMemorySync } from "./lib/sync.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sound = createSound(window.AudioContext || window.webkitAudioContext);
const stars = startStars(document.getElementById("stars"), { reducedMotion });
let manifest = {};
try {
  manifest = (await import("./assets/manifest.js")).default;
} catch (err) {
  console.warn("assets/manifest.js no se pudo leer; uso adornos propios", err);
}
startDecor(document.getElementById("decor"), { reducedMotion, manifest });

const stage = document.getElementById("stage");
const dotsEl = document.getElementById("dots");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const muteBtn = document.getElementById("mute");

const birthday = isBirthday(new Date());
let unlocked = birthday;
const songs = new Map(); // room element -> (active: boolean) => void
const drawings = new Map(); // room element -> (active: boolean) => void

// Live drawing: you draw at <site>/#dibujar (signed in); everyone else just watches.
const ownerMode = location.hash === "#dibujar";
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
  const msg = document.createElement("p");
  msg.className = "load-error";
  msg.textContent = "No pude leer los poemas. Revisa poemas/poemas.js (una coma o una comilla invertida de más).";
  document.body.append(msg);
}

/* ---------- helpers ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function hashHue(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

function formatDate(fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
  });
}

/* ---------- room builders ---------- */
function buildCover() {
  const room = el("section", "room cover");
  const inner = el("div", "room-inner");
  inner.append(el("p", "eyebrow", "Para Loraine"));
  const title = el("h1", null, "Poemario de un aprendiz");
  inner.append(title);
  inner.append(el("p", "sub", "Versos para una maestra, una soñadora, una mujer de fuego."));
  if (birthday) inner.append(el("p", "birthday-line", "Hoy es tu día ✦"));
  const enter = el("button", "enter", "Entrar");
  enter.type = "button";
  inner.append(enter);
  room.append(inner);
  return { room, title, enter };
}

function buildArt(poema) {
  const fig = el("figure", "art");
  fig.style.setProperty(
    "--art-bg",
    `linear-gradient(135deg, hsl(${hashHue(poema.id)} 55% 28%), hsl(${(hashHue(poema.id) + 70) % 360} 60% 36%))`,
  );
  if (poema.imagen) {
    const img = new Image();
    img.alt = `Ilustración abstracta inspirada en «${poema.titulo}»`;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    img.src = poema.imagen;
    fig.append(img);
  }
  const wrap = el("div", "art-wrap");
  const controls = el("div", "draw-controls");
  const setActive = attachDrawing(fig, controls, { poemId: poema.id, sync, owner: ownerMode });
  wrap.append(fig, controls);
  return { node: wrap, setActive };
}

function buildSky(fecha) {
  const sky = computeSky(fecha);
  if (!sky) return null;
  const card = el("div", "sky-card");
  if (manifest.marcoCarta) {
    const frame = new Image();
    frame.className = "sky-frame";
    frame.alt = "";
    frame.src = manifest.marcoCarta;
    card.append(frame);
  }
  card.append(el("p", "sky-title", "El cielo ese día"));
  const body = el("div", "sky-body");
  const wheel = el("div", "sky-wheel");
  wheel.innerHTML = renderWheel(sky);
  const chips = el("ul", "sky-chips");
  sky.forEach((p, i) => {
    const li = el("li", "chip");
    li.style.setProperty("--k", i);
    li.append(el("span", "chip-glyph", p.glyph));
    const text = el("span", "chip-text");
    text.append(el("strong", null, p.body), ` ${p.sign}`);
    // The Moon moves ~13° a day and we only know the date, so show its sign only.
    if (p.body !== "Luna") text.append(el("em", null, ` ${Math.floor(p.degree)}°`));
    li.append(text);
    chips.append(li);
  });
  body.append(wheel, chips);
  card.append(body, el("p", "sky-line", poeticLine(sky)));
  return card;
}

const PLAYER_KEY = "poemario:player";
function savedPlayer() {
  try { return localStorage.getItem(PLAYER_KEY); } catch { return null; }
}
function savePlayer(name) {
  try { localStorage.setItem(PLAYER_KEY, name); } catch { /* private mode: ignore */ }
}

/** Song area: Spotify and/or Apple Music. Only the active room has a live iframe, so songs stop when you leave. */
function buildSong(poema, room) {
  const song = el("div", "song");
  const sources = [];
  const spotify = toEmbedUrl(poema.spotify);
  if (poema.spotify && !spotify) console.warn(`Link de Spotify no reconocido en «${poema.id}»; usa el link completo de open.spotify.com`);
  if (spotify) sources.push({ name: "Spotify", url: spotify, height: 152, allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" });
  const apple = toAppleEmbedUrl(poema.appleMusic);
  if (poema.appleMusic && !apple) console.warn(`Link de Apple Music no reconocido en «${poema.id}»; usa el link completo de music.apple.com`);
  if (apple) {
    sources.push({
      name: "Apple Music", url: apple, height: 175,
      allow: "autoplay *; encrypted-media *; fullscreen *; clipboard-write",
      sandbox: "allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation",
    });
  }

  if (!sources.length) {
    song.append(el("p", "song-pending", "La canción de este poema llega pronto."));
    return song;
  }

  let current = Math.max(0, sources.findIndex((s) => s.name === savedPlayer()));
  let live = false;
  const tabs = el("div", "song-tabs");
  const stage = el("div", "song-stage");

  const render = () => {
    stage.replaceChildren();
    if (!live) return;
    const s = sources[current];
    const frame = document.createElement("iframe");
    frame.title = `${s.name}: canción de «${poema.titulo}»`;
    frame.allow = s.allow;
    if (s.sandbox) frame.setAttribute("sandbox", s.sandbox);
    frame.style.height = `${s.height}px`;
    frame.src = s.url;
    stage.append(frame);
  };
  const paintTabs = () =>
    [...tabs.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === current)));

  if (sources.length > 1) {
    sources.forEach((s, i) => {
      const b = el("button", "song-tab", s.name);
      b.type = "button";
      b.addEventListener("click", () => {
        if (i === current) return;
        current = i;
        savePlayer(s.name);
        paintTabs();
        render();
      });
      tabs.append(b);
    });
    paintTabs();
    song.append(tabs);
  }
  song.append(stage);
  songs.set(room, (active) => {
    if (active === live) return;
    live = active;
    render();
  });
  return song;
}

function buildPoem(poema) {
  const room = el("section", "room poem");
  const grid = el("div", "room-inner poem-grid");

  const textCol = el("div", "poem-text");
  textCol.append(el("h2", "poem-title", poema.titulo));
  if (poema.fecha) textCol.append(el("p", "poem-date", formatDate(poema.fecha)));
  let i = 0;
  for (const stanzaLines of splitStanzas(poema.texto)) {
    const stanza = el("p", "stanza");
    for (const line of stanzaLines) {
      const verse = el("span", "verse", line);
      verse.style.setProperty("--i", i++);
      stanza.append(verse);
    }
    textCol.append(stanza);
  }
  if (poema.nota) textCol.append(el("p", "poem-note", poema.nota));

  const side = el("div", "poem-side");
  const art = buildArt(poema);
  drawings.set(room, art.setActive);
  side.append(art.node);
  const sky = poema.fecha ? buildSky(poema.fecha) : null;
  if (sky) side.append(sky);

  side.append(buildSong(poema, room));

  grid.append(textCol, side);
  room.append(grid);
  return room;
}

function buildComing() {
  const room = el("section", "room surprise coming");
  const inner = el("div", "room-inner");
  inner.append(
    el("p", "date", "Continuará"),
    el("h2", null, "Pronto, más versos"),
    el("p", null, "Este poemario sigue creciendo, sentimiento a sentimiento."),
  );
  room.append(inner);
  return room;
}

function buildSurprise() {
  const room = el("section", "room surprise");
  const inner = el("div", "room-inner");
  inner.append(
    el("p", "date", "13 de febrero"),
    el("h2", null, "Feliz cumpleaños, Loraine"),
    el("p", null, "Maestra, soñadora, capaz. Gracias por enseñarme a amar."),
  );
  room.append(inner);
  return room;
}

/* ---------- assemble ---------- */
const valid = poemas
  .filter((p) => {
    const r = validatePoem(p);
    if (!r.ok) console.warn(`Poema omitido (${p?.id ?? "sin id"}):`, r.errors);
    else if (r.warnings.length) console.warn(`Poema «${p.id}»:`, r.warnings);
    return r.ok;
  })
  .map(normalizePoem);

const cover = buildCover();
const rooms = [
  { el: cover.room, hidden: false, label: "Portada" },
  ...valid.map((p, n) => ({ el: buildPoem(p), hidden: false, label: `Poema ${n + 1}: ${p.titulo}` })),
  { el: buildComing(), hidden: false, label: "Próximamente" },
  { el: buildSurprise(), hidden: true, surprise: true, label: "Sorpresa de cumpleaños" },
];
for (const r of rooms) stage.append(r.el);

const visible = () => rooms.filter((r) => !r.hidden || unlocked);
let index = 0;

function renderDots() {
  dotsEl.replaceChildren();
  visible().forEach((r, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", r.label);
    if (i === index) b.setAttribute("aria-current", "true");
    b.addEventListener("click", () => goTo(i));
    li.append(b);
    dotsEl.append(li);
  });
  const list = visible();
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === list.length - 1;
}

function goTo(i, { silent = false } = {}) {
  const list = visible();
  index = clampIndex(i, list.length);
  rooms.forEach((r) => {
    r.el.classList.remove("active");
    songs.get(r.el)?.(false);
    drawings.get(r.el)?.(false);
  });
  const current = list[index];
  current.el.classList.add("active");
  songs.get(current.el)?.(true);
  drawings.get(current.el)?.(true);
  current.el.scrollTop = 0;
  if (current.surprise) stars.burst();
  if (!silent) sound.tick();
  renderDots();
}

function move(dir) {
  const target = step(index, dir, visible().length);
  if (target !== index) goTo(target);
}

/* ---------- interactions ---------- */
cover.enter.addEventListener("click", () => {
  sound.chime();
  goTo(1, { silent: true });
});

let taps = 0, tapTimer = 0;
cover.title.addEventListener("click", () => {
  taps += 1;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => (taps = 0), 2500);
  if (taps >= 5) {
    taps = 0;
    unlocked = true;
    sound.chime();
    goTo(visible().length - 1, { silent: true });
  }
});

prevBtn.addEventListener("click", () => move(-1));
nextBtn.addEventListener("click", () => move(1));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") move(1);
  if (e.key === "ArrowLeft") move(-1);
});

muteBtn.addEventListener("click", () => {
  const muted = sound.toggleMute();
  muteBtn.setAttribute("aria-pressed", String(muted));
  muteBtn.setAttribute("aria-label", muted ? "Activar sonidos" : "Silenciar sonidos");
});

let touchX = 0, touchY = 0;
stage.addEventListener("touchstart", (e) => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
}, { passive: true });

goTo(0, { silent: true });
