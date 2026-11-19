/**
 * Interactive garden strip: fish that react to taps, flowers that open and shed petals.
 * Pure helpers (fishResponse, loadBloomed, saveBloomed) are testable in Node;
 * startGarden is the DOM layer.
 */
import { FISH_COLORS, FLOWER_COLORS, fishMarkup, flowerMarkup, artImg, svg, rand, pick } from "./decor.js";

const STORAGE_KEY = "poemario:jardin";

export function fishResponse(fish, tap, { near = 60, far = 160 } = {}) {
  const d = Math.hypot(fish.x - tap.x, fish.y - tap.y);
  if (d <= near) return "flee";
  if (d <= far) return "approach";
  return "ignore";
}

export function loadBloomed(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter((id) => typeof id === "string"))];
  } catch {
    return [];
  }
}

export function saveBloomed(storage, ids) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* blocked storage: the garden just will not persist */
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sign = (v, fallback = 1) => (v > 0 ? 1 : v < 0 ? -1 : fallback);

export function startGarden(container, { manifest = {}, reducedMotion = false, sound, bloomed = [] } = {}) {
  container.replaceChildren();
  container.classList.add("garden");
  if (reducedMotion) container.classList.add("garden-reduced");
  const peces = manifest.peces ?? [];
  const flores = manifest.flores ?? [];

  const fishLayer = document.createElement("div");
  fishLayer.className = "garden-layer garden-fish-layer";
  const flowerLayer = document.createElement("div");
  flowerLayer.className = "garden-layer garden-flower-layer";
  const fxLayer = document.createElement("div");
  fxLayer.className = "garden-layer garden-fx-layer";
  container.append(fishLayer, flowerLayer, fxLayer);

  const size = () => ({ w: container.clientWidth || 375, h: container.clientHeight || 150 });
  const swimBand = () => Math.max(30, size().h * 0.72); // fish stay above the flower line

  function cleanup(el, ms) {
    const done = () => el.remove();
    el.addEventListener("animationend", done, { once: true });
    setTimeout(done, ms + 400); // safety net if animationend never fires
  }

  // ---------- fish ----------
  const fishes = [];
  const fishCount = 6;
  for (let i = 0; i < fishCount; i++) {
    const w = rand(40, 64);
    const el = peces.length ? artImg(pick(peces), "garden-fish") : svg(fishMarkup(pick(FISH_COLORS)), "garden-fish");
    el.style.width = `${w}px`;
    el.style.opacity = rand(0.72, 0.95).toFixed(2);
    const { w: W } = size();
    const f = {
      el, w, h: w / 2,
      x: rand(0, Math.max(1, W - w)),
      y: rand(4, Math.max(5, swimBand() - w / 2)),
      yTarget: 0,
      dir: i % 2 ? -1 : 1,
      speed: rand(16, 36),
      boost: 1,
      phase: rand(0, 6.28),
      bobFreq: rand(0.8, 1.6),
      seek: null,
      headLeft: !peces.length,
    };
    f.yTarget = f.y;
    fishes.push(f);
    fishLayer.append(el);
  }

  function render(f, t = 0) {
    const bob = reducedMotion ? 0 : Math.sin(t * f.bobFreq + f.phase) * 3;
    f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${(f.y + bob).toFixed(1)}px)`;
    f.el.classList.toggle("flip", f.headLeft ? f.dir > 0 : f.dir < 0); // art faces right; procedural SVG faces left
  }

  const center = (f) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 });

  function bubbleTrail(f) {
    const c = center(f);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const b = document.createElement("span");
      b.className = "garden-bubble";
      const s = rand(4, 10);
      b.style.width = b.style.height = `${s}px`;
      b.style.left = `${c.x - f.dir * rand(0, 18) + rand(-4, 4)}px`;
      b.style.top = `${c.y + rand(-6, 6)}px`;
      b.style.setProperty("--rise", `${rand(30, 70)}px`);
      b.style.setProperty("--drift", `${rand(-10, 10)}px`);
      b.style.animationDelay = `${i * 70}ms`;
      fxLayer.append(b);
      cleanup(b, 1400 + i * 70);
    }
  }

  function flee(f, tap) {
    const c = center(f);
    f.seek = null;
    f.dir = sign(c.x - tap.x, Math.random() < 0.5 ? -1 : 1);
    f.yTarget = clamp(f.y + sign(c.y - tap.y) * rand(14, 40), 4, Math.max(5, swimBand() - f.h));
    if (reducedMotion) {
      const { w: W } = size();
      f.x = clamp(f.x + f.dir * rand(70, 120), 0, Math.max(0, W - f.w));
      f.y = f.yTarget;
      render(f);
    } else {
      f.boost = 4.5;
    }
    bubbleTrail(f);
  }

  function approach(f, tap) {
    f.yTarget = clamp(tap.y - f.h / 2, 4, Math.max(5, swimBand() - f.h));
    if (reducedMotion) {
      const { w: W } = size();
      const cx = center(f).x;
      f.dir = sign(tap.x - cx, f.dir);
      f.x = clamp(f.x + (tap.x - cx) * 0.6, 0, Math.max(0, W - f.w));
      f.y = f.yTarget;
      render(f);
    } else {
      f.seek = { tx: tap.x, until: performance.now() + 2600 };
    }
  }

  container.addEventListener("pointerdown", (e) => {
    const r = container.getBoundingClientRect();
    const tap = { x: e.clientX - r.left, y: e.clientY - r.top };
    for (const f of fishes) {
      const res = fishResponse(center(f), tap);
      if (res === "flee") flee(f, tap);
      else if (res === "approach") approach(f, tap);
    }
  });

  // ---------- flowers ----------
  const shown = new Set();
  let flowerIndex = 0;

  function petalBurst(originEl, count = 6 + Math.floor(Math.random() * 5)) {
    const c = container.getBoundingClientRect();
    const r = originEl.getBoundingClientRect();
    const ox = r.left - c.left + r.width / 2;
    const oy = r.top - c.top + r.height * 0.25;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "garden-petal";
      p.style.left = `${ox + rand(-8, 8)}px`;
      p.style.top = `${oy + rand(-6, 6)}px`;
      p.style.background = pick(FLOWER_COLORS);
      p.style.setProperty("--dx", `${rand(-46, 46)}px`);
      p.style.setProperty("--dy", `${rand(40, Math.max(60, c.height - oy))}px`);
      p.style.setProperty("--rot", `${rand(-200, 200)}deg`);
      p.style.setProperty("--fall", `${rand(1.4, 2.4)}s`);
      p.style.animationDelay = `${(i * 0.06).toFixed(2)}s`;
      fxLayer.append(p);
      cleanup(p, 2800 + i * 60);
    }
  }

  function openFlower(el) {
    el.classList.remove("open");
    void el.offsetWidth; // restart the animation on repeated taps
    el.classList.add("open");
    petalBurst(el);
  }

  function addFlower(id, { animate }) {
    const i = flowerIndex++;
    const h = 62 + ((i * 29) % 34); // 62-95px, fits a ~150px strip
    const slot = 5 + ((i * 37 + (i % 2) * 11) % 86); // spread out, deterministic
    const el = flores.length
      ? artImg(pick(flores), "garden-flower")
      : svg(flowerMarkup(FLOWER_COLORS[i % FLOWER_COLORS.length], i % 2 ? 5 : 7), "garden-flower");
    el.dataset.poem = id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", "Flor");
    el.style.left = `${slot}%`;
    el.style.height = `${h}px`;
    el.style.width = `${h * 0.62}px`;
    el.style.setProperty("--sway", `${rand(5, 9).toFixed(1)}s`);
    el.style.setProperty("--delay", `${-rand(0, 6).toFixed(1)}s`);
    if (animate) el.classList.add("is-new");
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); // a flower tap should not scare the fish
      openFlower(el);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFlower(el);
      }
    });
    flowerLayer.append(el);
    return el;
  }

  for (const id of bloomed) {
    if (shown.has(id)) continue;
    shown.add(id);
    addFlower(id, { animate: false });
  }

  // ---------- swim loop ----------
  fishes.forEach((f) => render(f));
  if (!reducedMotion) {
    let last = performance.now();
    const tick = (now) => {
      if (!container.isConnected) return; // page left: stop quietly
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w: W } = size();
      const t = now / 1000;
      for (const f of fishes) {
        if (f.seek) {
          const dx = f.seek.tx - (f.x + f.w / 2);
          if (now > f.seek.until || Math.abs(dx) < 10) f.seek = null;
          else {
            f.dir = sign(dx, f.dir);
            f.boost = Math.max(f.boost, 2.2);
          }
        }
        f.x += f.dir * f.speed * f.boost * dt;
        if (f.x < 0) { f.x = 0; f.dir = 1; }
        else if (f.x > W - f.w) { f.x = Math.max(0, W - f.w); f.dir = -1; }
        f.boost += (1 - f.boost) * Math.min(1, dt * 1.4);
        f.y += (f.yTarget - f.y) * Math.min(1, dt * 2.2);
        if (!f.seek && Math.abs(f.yTarget - f.y) < 1.5 && Math.random() < dt * 0.15) {
          f.yTarget = rand(4, Math.max(5, swimBand() - f.h)); // slowly wander between depths
        }
        render(f, t);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return {
    scatter() {
      const { w: W } = size();
      for (const f of fishes) {
        f.seek = null;
        f.dir = Math.random() < 0.5 ? -1 : 1;
        f.yTarget = rand(4, Math.max(5, swimBand() - f.h));
        if (reducedMotion) {
          f.x = rand(0, Math.max(1, W - f.w));
          f.y = f.yTarget;
          render(f);
        } else {
          f.boost = 4;
        }
      }
    },
    bloom(poemId) {
      if (shown.has(poemId)) return false;
      shown.add(poemId);
      const el = addFlower(poemId, { animate: true });
      sound?.chime?.();
      setTimeout(() => petalBurst(el, 6), reducedMotion ? 0 : 900);
      return true;
    },
  };
}
