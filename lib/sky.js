import * as Astronomy from "../vendor/astronomy.js";

const SIGNS = [
  "Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo",
  "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis",
];
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const BODIES = [
  { name: "Sol", glyph: "☉" },
  { name: "Luna", glyph: "☽" },
  { name: "Mercurio", glyph: "☿", astro: "Mercury" },
  { name: "Venus", glyph: "♀", astro: "Venus" },
  { name: "Marte", glyph: "♂", astro: "Mars" },
  { name: "Júpiter", glyph: "♃", astro: "Jupiter" },
  { name: "Saturno", glyph: "♄", astro: "Saturn" },
];

const norm = (deg) => ((deg % 360) + 360) % 360;

function parseNoonUTC(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

function eclipticLongitude(body, date) {
  if (body.name === "Sol") return Astronomy.SunPosition(date).elon;
  if (body.name === "Luna") return Astronomy.EclipticGeoMoon(date).lon;
  return Astronomy.Ecliptic(Astronomy.GeoVector(body.astro, date, true)).elon;
}

/** Geocentric positions of Sun, Moon and planets at 12:00 UTC of `dateStr` (YYYY-MM-DD), or null. */
export function computeSky(dateStr) {
  const date = parseNoonUTC(dateStr);
  if (!date) return null;
  return BODIES.map((body) => {
    const lon = norm(eclipticLongitude(body, date));
    const signIndex = Math.floor(lon / 30);
    return {
      body: body.name,
      glyph: body.glyph,
      sign: SIGNS[signIndex],
      signGlyph: SIGN_GLYPHS[signIndex],
      // Truncate (never round up) so a body at 29.97° does not read as "30°".
      degree: Math.floor((lon - signIndex * 30) * 10) / 10,
      longitude: lon,
    };
  });
}

/** One-line poetic summary of the Sun and Moon signs, or "" without a sky. */
export function poeticLine(placements) {
  const sun = placements?.find((p) => p.body === "Sol");
  const moon = placements?.find((p) => p.body === "Luna");
  if (!sun || !moon) return "";
  return `Ese día el Sol estaba en ${sun.sign} y la Luna en ${moon.sign}.`;
}

const RADIUS_LEVELS = [66, 55, 44];
const CLOSE_DEGREES = 12;

/** Radius for each body's glyph so bodies that are close in longitude do not overlap. */
export function bodyRadii(placements) {
  const order = placements.map((_, i) => i).sort((a, b) => placements[a].longitude - placements[b].longitude);
  const level = new Array(placements.length).fill(0);
  let prev = null;
  for (const i of order) {
    if (prev !== null) {
      const gap = Math.abs(placements[i].longitude - placements[prev].longitude);
      if (gap < CLOSE_DEGREES) level[i] = (level[prev] + 1) % RADIUS_LEVELS.length;
    }
    prev = i;
  }
  return level.map((l) => RADIUS_LEVELS[l]);
}

const C = 120;
const R_OUT = 112;
const R_SIGN = 78;
const R_CORE = 34;

const f = (n) => n.toFixed(2);
const point = (lon, r) => {
  const t = ((180 + lon) * Math.PI) / 180;
  return [C + r * Math.cos(t), C - r * Math.sin(t)];
};

function wedge(i) {
  const [ox1, oy1] = point(i * 30, R_OUT);
  const [ox2, oy2] = point(i * 30 + 30, R_OUT);
  const [ix2, iy2] = point(i * 30 + 30, R_SIGN);
  const [ix1, iy1] = point(i * 30, R_SIGN);
  return `M${f(ox1)} ${f(oy1)} A${R_OUT} ${R_OUT} 0 0 0 ${f(ox2)} ${f(oy2)} L${f(ix2)} ${f(iy2)} A${R_SIGN} ${R_SIGN} 0 0 1 ${f(ix1)} ${f(iy1)}Z`;
}

/** SVG string of a zodiac wheel (Aries at the left, counter-clockwise). Acuario is highlighted. */
export function renderWheel(placements) {
  const radii = bodyRadii(placements);
  const wedges = SIGNS.map(
    (name, i) => `<path class="sign-wedge${name === "Acuario" ? " is-hers" : ""}" data-sign="${name}" d="${wedge(i)}"/>`,
  ).join("");
  const lines = SIGNS.map((_, i) => {
    const [x1, y1] = point(i * 30, R_SIGN);
    const [x2, y2] = point(i * 30, R_OUT);
    return `<line class="sign-line" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
  }).join("");
  const ticks = Array.from({ length: 72 }, (_, k) => {
    if (k % 6 === 0) return "";
    const [x1, y1] = point(k * 5, R_OUT - 4);
    const [x2, y2] = point(k * 5, R_OUT);
    return `<line class="tick" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
  }).join("");
  const signLabels = SIGN_GLYPHS.map((g, i) => {
    const [x, y] = point(i * 30 + 15, (R_OUT + R_SIGN) / 2);
    return `<text class="sign-glyph${SIGNS[i] === "Acuario" ? " is-hers" : ""}" x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central">${g}&#xFE0E;</text>`;
  }).join("");
  const bodies = placements
    .map((p, i) => {
      const [dx, dy] = point(p.longitude, R_SIGN);
      const [gx, gy] = point(p.longitude, radii[i]);
      const sun = p.body === "Sol" ? " is-sun" : "";
      return (
        `<g class="body${sun}" data-body="${p.body}" style="--k:${i}">` +
        `<title>${p.body} en ${p.sign} ${Math.floor(p.degree)}°</title>` +
        `<line class="stem" x1="${f(dx)}" y1="${f(dy)}" x2="${f(gx)}" y2="${f(gy)}"/>` +
        `<circle class="dot" cx="${f(dx)}" cy="${f(dy)}" r="2.2"/>` +
        `<circle class="halo" cx="${f(gx)}" cy="${f(gy)}" r="9"/>` +
        `<text class="body-glyph" x="${f(gx)}" y="${f(gy)}" text-anchor="middle" dominant-baseline="central">${p.glyph}</text>` +
        `</g>`
      );
    })
    .join("");
  return (
    `<svg viewBox="0 0 240 240" role="img" aria-label="Posición de los astros" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><radialGradient id="halo-grad"><stop offset="0" stop-color="#f3d9a4" stop-opacity=".55"/><stop offset="1" stop-color="#f3d9a4" stop-opacity="0"/></radialGradient></defs>` +
    `${wedges}${ticks}${lines}` +
    `<circle class="ring" cx="${C}" cy="${C}" r="${R_OUT}" fill="none"/>` +
    `<circle class="ring" cx="${C}" cy="${C}" r="${R_SIGN}" fill="none"/>` +
    `<circle class="ring faint" cx="${C}" cy="${C}" r="${R_CORE}" fill="none"/>` +
    `<circle class="ring faint" cx="${C}" cy="${C}" r="${R_CORE - 10}" fill="none"/>` +
    `${signLabels}${bodies}</svg>`
  );
}
