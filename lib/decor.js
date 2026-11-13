/** Decorative "aquarium" layer: fish, bubbles, flowers and floating symbols. Purely visual. */

const SVG_NS = "http://www.w3.org/2000/svg";
const FISH_COLORS = ["#e8b866", "#c5683f", "#8a6ad6", "#f3d9a4", "#6fb7c9"];
const FLOWER_COLORS = ["#c5683f", "#e8b866", "#8a6ad6", "#f4ecdc"];
const SYMBOLS = ["♒", "∞", "✦", "≋", "Ω", "☽", "✧"];

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function svg(markup, className) {
  const wrap = document.createElement("div");
  wrap.className = className;
  wrap.innerHTML = markup;
  return wrap;
}

function fishMarkup(color) {
  return `<svg viewBox="0 0 64 32" xmlns="${SVG_NS}" aria-hidden="true">
    <path d="M44 16 L62 4 L58 16 L62 28 Z" fill="${color}" opacity=".8"/>
    <path d="M6 16 C14 2 38 2 48 16 C38 30 14 30 6 16 Z" fill="${color}"/>
    <path d="M24 8 C28 3 34 3 36 7 C32 8 28 9 24 8 Z" fill="${color}" opacity=".7"/>
    <circle cx="15" cy="13" r="1.7" fill="#0b1030"/>
    <path d="M26 10 C30 16 30 16 26 22" stroke="#0b1030" stroke-opacity=".25" fill="none" stroke-width="1.2"/>
  </svg>`;
}

function flowerMarkup(color, petals = 6) {
  const petalPaths = Array.from({ length: petals }, (_, i) => {
    const angle = (360 / petals) * i;
    return `<ellipse cx="50" cy="22" rx="8" ry="15" fill="${color}" opacity=".88" transform="rotate(${angle} 50 38)"/>`;
  }).join("");
  return `<svg viewBox="0 0 100 160" xmlns="${SVG_NS}" aria-hidden="true">
    <path d="M50 160 C46 120 56 90 50 44" stroke="#4f8f6a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M50 118 C36 112 30 100 32 90 C44 92 50 104 50 118 Z" fill="#4f8f6a" opacity=".85"/>
    <path d="M51 96 C64 92 72 82 70 72 C58 74 52 84 51 96 Z" fill="#4f8f6a" opacity=".85"/>
    ${petalPaths}
    <circle cx="50" cy="38" r="6.5" fill="#f3d9a4"/>
  </svg>`;
}

function artImg(src, className) {
  const wrap = document.createElement("div");
  wrap.className = className;
  const img = new Image();
  img.alt = "";
  img.src = src;
  wrap.append(img);
  return wrap;
}

/** Use hand-made art from assets/manifest.js when listed; otherwise draw procedural shapes. */
export function startDecor(container, { reducedMotion = false, manifest = {} } = {}) {
  container.replaceChildren();
  const frag = document.createDocumentFragment();
  const peces = manifest.peces ?? [];
  const flores = manifest.flores ?? [];
  const simbolos = manifest.simbolos ?? [];

  // Fish: swim across at different depths and speeds, half of them right-to-left.
  const fishCount = 7;
  for (let i = 0; i < fishCount; i++) {
    const size = rand(34, 78);
    const rtl = i % 2 === 1;
    const fish = peces.length ? artImg(pick(peces), "fish") : svg(fishMarkup(pick(FISH_COLORS)), "fish");
    fish.style.width = `${size}px`;
    fish.style.top = `${rand(8, 78)}%`;
    fish.style.setProperty("--dur", `${rand(32, 64)}s`);
    fish.style.setProperty("--delay", `${-rand(0, 60)}s`);
    fish.style.setProperty("--bob", `${rand(10, 26)}px`);
    fish.style.opacity = String(rand(0.22, 0.5).toFixed(2));
    fish.classList.add(rtl ? "swim-left" : "swim-right");
    if (reducedMotion) fish.style.left = `${rand(5, 85)}%`;
    frag.append(fish);
  }

  // Bubbles rising from the bottom.
  for (let i = 0; i < 16; i++) {
    const b = document.createElement("span");
    b.className = "bubble";
    const size = rand(4, 14);
    b.style.width = b.style.height = `${size}px`;
    b.style.left = `${rand(2, 98)}%`;
    b.style.setProperty("--dur", `${rand(14, 30)}s`);
    b.style.setProperty("--delay", `${-rand(0, 30)}s`);
    b.style.setProperty("--drift", `${rand(-24, 24)}px`);
    if (reducedMotion) b.style.bottom = `${rand(5, 90)}%`;
    frag.append(b);
  }

  // Flowers growing along the bottom edge.
  const flowerSlots = [4, 14, 26, 70, 82, 93];
  flowerSlots.forEach((left, i) => {
    const h = rand(90, 150);
    const f = flores.length ? artImg(pick(flores), "flower") : svg(flowerMarkup(pick(FLOWER_COLORS), i % 2 ? 5 : 7), "flower");
    f.style.left = `${left}%`;
    f.style.height = `${h}px`;
    f.style.width = `${h * 0.62}px`;
    f.style.setProperty("--sway", `${rand(5, 9)}s`);
    f.style.setProperty("--delay", `${-rand(0, 6)}s`);
    f.style.setProperty("--grow-delay", `${rand(0.2, 2.4)}s`);
    frag.append(f);
  });

  // Floating symbols.
  for (let i = 0; i < 9; i++) {
    let s;
    if (simbolos.length) {
      s = artImg(pick(simbolos), "symbol");
      s.style.width = `${rand(24, 52)}px`;
    } else {
      s = document.createElement("span");
      s.className = "symbol";
      s.textContent = pick(SYMBOLS) + "︎";
    }
    s.style.left = `${rand(3, 94)}%`;
    s.style.top = `${rand(6, 82)}%`;
    if (!simbolos.length) s.style.fontSize = `${rand(18, 44)}px`;
    s.style.setProperty("--dur", `${rand(14, 28)}s`);
    s.style.setProperty("--delay", `${-rand(0, 20)}s`);
    frag.append(s);
  }

  container.append(frag);
}
