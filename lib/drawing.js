import { toNorm, fromNorm, strokeWidthPx, createStrokeStore } from "./strokes.js";

const COLORS = [
  { name: "Marfil", value: "#f4ecdc" },
  { name: "Dorado", value: "#e8b866" },
  { name: "Terracota", value: "#c5683f" },
  { name: "Violeta", value: "#8a6ad6" },
  { name: "Turquesa", value: "#6fb7c9" },
  { name: "Verde", value: "#4f8f6a" },
];
const SIZES = [{ name: "Fino", units: 3 }, { name: "Medio", units: 7 }, { name: "Grueso", units: 14 }];
const ERASER = "erase";
const MAX_POINTS = 5000;
const SEND_EVERY_MS = 40;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Drawing board inside the poem's art frame.
 * Everyone sees the strokes that come from `sync`; only the owner (hash #dibujar, signed in) can draw.
 * Returns setActive(boolean): connects to the live data the first time the room becomes active.
 */
export function attachDrawing(figure, controlsHost, { poemId, sync, owner, notify = () => {} }) {
  const canvas = el("canvas", "draw-canvas");
  canvas.setAttribute("aria-label", "Dibujo en vivo");
  figure.append(canvas);
  const ctx = canvas.getContext("2d");
  const store = createStrokeStore();
  let raf = 0;
  let connected = false;
  let unsubscribe = null;

  /* ---------- rendering ---------- */
  function paint(stroke, from) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.save();
    ctx.globalCompositeOperation = stroke.c === ERASER ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = stroke.c === ERASER ? "#000" : stroke.c;
    ctx.lineWidth = strokeWidthPx(stroke.w, w) * (stroke.c === ERASER ? 2.4 : 1);
    ctx.lineCap = ctx.lineJoin = "round";
    const pts = stroke.p;
    if (pts.length === 1) {
      const [x, y] = fromNorm(pts[0], w, h);
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pts.length > 1) {
      ctx.beginPath();
      const [x0, y0] = fromNorm(pts[from], w, h);
      ctx.moveTo(x0, y0);
      for (let i = from + 1; i < pts.length; i++) {
        const [x, y] = fromNorm(pts[i], w, h);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    raf = 0;
    const rect = canvas.getBoundingClientRect();
    if (store.needsFullRedraw()) {
      ctx.clearRect(0, 0, rect.width, rect.height);
      store.resetDrawn();
    }
    for (const { id, stroke, from } of store.pending()) {
      paint(stroke, from);
      store.markDrawn(id);
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(render); };

  function resize() {
    const rect = figure.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    store.resetDrawn();
    schedule();
  }
  new ResizeObserver(resize).observe(figure);

  /* ---------- live data ---------- */
  function connect() {
    if (connected) return;
    connected = true;
    unsubscribe = sync.subscribe(poemId, {
      added: (id, s) => { store.upsert(id, s); schedule(); },
      changed: (id, s) => { store.upsert(id, s); schedule(); },
      removed: (id) => { store.remove(id); schedule(); },
    });
  }

  /* ---------- owner tools ---------- */
  const tool = { color: COLORS[1].value, units: SIZES[1].units };
  const mine = []; // stroke ids drawn in this session, for undo
  let current = null;
  let timer = 0;

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return toNorm(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  }
  function flush() {
    clearTimeout(timer);
    timer = 0;
    if (current) sync.updateStroke(poemId, current.id, current.stroke);
  }
  function onDown(e) {
    if (!sync.canWrite() || e.button > 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const stroke = { c: tool.color, w: tool.units, p: [point(e)] };
    current = { id: sync.startStroke(poemId, stroke), stroke };
    mine.push(current.id);
  }
  function onMove(e) {
    if (!current) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      if (current.stroke.p.length < MAX_POINTS) current.stroke.p.push(point(ev));
    }
    if (!timer) timer = setTimeout(flush, SEND_EVERY_MS);
  }
  function onUp() {
    if (!current) return;
    flush();
    current = null;
  }

  function enableDrawing(on) {
    canvas.style.touchAction = on ? "none" : "";
    canvas.classList.toggle("is-drawable", on);
    if (on) {
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
    } else {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    }
  }

  function buildToolbar() {
    const bar = el("div", "draw-bar");
    const colors = el("div", "draw-colors");
    const buttons = [];
    const pick = (value, btn) => {
      tool.color = value;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    };
    COLORS.forEach((c, i) => {
      const b = el("button", "swatch");
      b.type = "button";
      b.style.setProperty("--c", c.value);
      b.setAttribute("aria-label", c.name);
      b.setAttribute("aria-pressed", String(i === 1));
      b.addEventListener("click", () => pick(c.value, b));
      buttons.push(b);
      colors.append(b);
    });
    const eraser = el("button", "tool", "Borrador");
    eraser.type = "button";
    eraser.setAttribute("aria-pressed", "false");
    eraser.addEventListener("click", () => pick(ERASER, eraser));
    buttons.push(eraser);

    const sizes = el("div", "draw-sizes");
    SIZES.forEach((s, i) => {
      const b = el("button", "size");
      b.type = "button";
      b.setAttribute("aria-label", `Grosor ${s.name}`);
      b.setAttribute("aria-pressed", String(i === 1));
      b.style.setProperty("--d", `${4 + i * 4}px`);
      b.addEventListener("click", () => {
        tool.units = s.units;
        [...sizes.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
      sizes.append(b);
    });

    const undo = el("button", "tool", "Deshacer");
    undo.type = "button";
    undo.addEventListener("click", () => {
      const id = mine.pop();
      if (id) sync.removeStroke(poemId, id);
    });
    const clear = el("button", "tool danger", "Limpiar");
    clear.type = "button";
    clear.addEventListener("click", () => {
      if (window.confirm("¿Borrar todo el dibujo de este poema?")) {
        mine.length = 0;
        sync.clear(poemId);
      }
    });
    bar.append(colors, eraser, sizes, undo, clear);
    return bar;
  }

  function buildLogin() {
    const form = el("form", "draw-login");
    const email = el("input");
    email.type = "email"; email.placeholder = "Tu correo"; email.autocomplete = "username"; email.required = true;
    const pass = el("input");
    pass.type = "password"; pass.placeholder = "Tu clave"; pass.autocomplete = "current-password"; pass.required = true;
    const go = el("button", "tool", "Entrar a dibujar");
    go.type = "submit";
    const msg = el("p", "draw-msg");
    form.append(email, pass, go, msg);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      try {
        await sync.login(email.value, pass.value);
        pass.value = "";
      } catch {
        msg.textContent = "No pude entrar. Revisa el correo y la clave.";
      }
    });
    return form;
  }

  function renderControls() {
    controlsHost.replaceChildren();
    if (!owner) return enableDrawing(false);
    if (sync.canWrite()) {
      controlsHost.append(buildToolbar());
      enableDrawing(true);
    } else if (sync.login) {
      controlsHost.append(buildLogin());
      enableDrawing(false);
    }
    if (!sync.login) controlsHost.append(el("p", "draw-msg", "Modo de prueba: sin Firebase, solo tú ves este dibujo."));
  }
  renderControls();
  if (owner && sync.onAuth) sync.onAuth(renderControls);

  return function setActive(active) {
    if (active) { connect(); resize(); }
    else if (current) onUp();
  };
}
