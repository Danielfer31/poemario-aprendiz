/** Pure helpers for the live drawing board (no DOM, no network). */

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const round4 = (v) => Math.round(v * 10000) / 10000;

/** Pixel position -> point normalised to 0..1 so every screen size draws the same picture. */
export function toNorm(x, y, width, height) {
  return [round4(clamp01(x / width)), round4(clamp01(y / height))];
}

export function fromNorm(point, width, height) {
  return [point[0] * width, point[1] * height];
}

/** Stroke widths are stored as units per 1000px of canvas width. */
export function strokeWidthPx(units, canvasWidth) {
  return (units * canvasWidth) / 1000;
}

function normalizePoints(p) {
  if (Array.isArray(p)) return p;
  // Firebase turns arrays into {0: .., 1: ..} objects.
  if (p && typeof p === "object") return Object.keys(p).sort((a, b) => a - b).map((k) => p[k]);
  return null;
}

/**
 * Keeps the strokes received so far and tracks how much of each is already painted,
 * so the canvas only draws what is new.
 */
export function createStrokeStore() {
  const strokes = new Map(); // id -> { stroke, drawn }
  let dirty = false;

  return {
    upsert(id, stroke) {
      if (!stroke || typeof stroke !== "object") return;
      const p = normalizePoints(stroke.p);
      if (!p) return;
      const entry = strokes.get(id);
      const next = { c: stroke.c, w: stroke.w, p };
      if (entry) {
        if (p.length < entry.drawn) dirty = true;
        entry.stroke = next;
      } else {
        strokes.set(id, { stroke: next, drawn: 0 });
      }
    },
    remove(id) {
      if (strokes.delete(id)) dirty = true;
    },
    clear() {
      if (strokes.size) dirty = true;
      strokes.clear();
      dirty = true;
    },
    /** Strokes with points not painted yet; `from` overlaps one point so lines join up. */
    pending() {
      const out = [];
      for (const [id, e] of strokes) {
        if (e.drawn < e.stroke.p.length) out.push({ id, stroke: e.stroke, from: Math.max(e.drawn - 1, 0) });
      }
      return out;
    },
    markDrawn(id) {
      const e = strokes.get(id);
      if (e) e.drawn = e.stroke.p.length;
    },
    needsFullRedraw: () => dirty,
    resetDrawn() {
      for (const e of strokes.values()) e.drawn = 0;
      dirty = false;
    },
    list: () => [...strokes].map(([id, e]) => ({ id, stroke: e.stroke })),
  };
}
