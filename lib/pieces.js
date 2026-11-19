import { toEmbedUrl } from "./spotify.js";
import { toAppleEmbedUrl } from "./applemusic.js";
import { computeSky, renderWheel, poeticLine } from "./sky.js";
import { attachDrawing } from "./drawing.js";
import { whatsappLink } from "./whatsapp.js";

export function el(tag, className, text) {
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

export function formatDate(fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
  });
}

export function buildArt(poema, { sync, owner }) {
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
  const setActive = attachDrawing(fig, controls, { poemId: poema.id, sync, owner });
  wrap.append(fig, controls);
  return { node: wrap, setActive };
}

export function buildSky(fecha, { manifest }) {
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
export function buildSong(poema) {
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
    return { node: song, setActive() {} };
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
  const setActive = (active) => {
    if (active === live) return;
    live = active;
    render();
  };
  return { node: song, setActive };
}

const WHATSAPP_PHONE = "573003473884";

/** «Manda un besito»: opens WhatsApp with a prefilled message to Daniel. */
export function buildKiss(poema) {
  const href = whatsappLink(WHATSAPP_PHONE, `Te mando un besito 💋 (desde «${poema.titulo}»)`);
  const a = el("a", "kiss-btn", "Manda un besito 💋");
  a.href = href ?? "#";
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}
