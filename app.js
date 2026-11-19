import { splitStanzas, validatePoem, normalizePoem } from "./lib/poems.js";
import { createSound } from "./lib/sound.js";
import { step, clampIndex } from "./lib/nav.js";
import { isBirthday } from "./lib/birthday.js";
import { startStars } from "./lib/stars.js";
import { startDecor } from "./lib/decor.js";
import { el, formatDate, buildArt, buildSky, buildSong, buildKiss } from "./lib/pieces.js";
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
const bookLink = document.querySelector(".to-book");

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
  const art = buildArt(poema, { sync, owner: ownerMode });
  drawings.set(room, art.setActive);
  side.append(art.node);
  const sky = poema.fecha ? buildSky(poema.fecha, { manifest }) : null;
  if (sky) side.append(sky);

  const song = buildSong(poema);
  songs.set(room, song.setActive);
  side.append(song.node);
  if (poema.besito) side.append(buildKiss(poema));

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
  ...valid.map((p, n) => ({ el: buildPoem(p), hidden: false, label: `Poema ${n + 1}: ${p.titulo}`, id: p.id })),
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
  // "Ver como libro" opens the book on the poem she is reading.
  if (bookLink) bookLink.href = current.id ? `libro.html#${encodeURIComponent(current.id)}` : "libro.html";
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

// Deep link: https://…/#sabor-a-ti opens that poem directly (used by the "nuevo recuerdo" email).
const wantedId = decodeURIComponent(location.hash.slice(1));
const wantedIndex = visible().findIndex((r) => r.id === wantedId);
if (wantedIndex > 0) goTo(wantedIndex, { silent: true });
