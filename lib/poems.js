/** Split poem text into stanzas of verses. Tolerates CRLF and repeated blank lines. */
export function splitStanzas(text) {
  const stanzas = [];
  let current = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      if (current.length) stanzas.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) stanzas.push(current);
  return stanzas;
}

function isRealDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Validate a poem object. Missing id/titulo/texto are fatal errors.
 * A bad `fecha` is only a warning: the poem still shows, just without date and astros.
 */
export function validatePoem(p) {
  const errors = [];
  const warnings = [];
  if (!p || typeof p !== "object") return { ok: false, errors: ["poem must be an object"], warnings };
  for (const key of ["id", "titulo", "texto"]) {
    if (typeof p[key] !== "string" || p[key].trim() === "") errors.push(`missing ${key}`);
  }
  if (p.fecha != null && !(typeof p.fecha === "string" && isRealDate(p.fecha))) {
    warnings.push("fecha must be a real YYYY-MM-DD date; ignoring it");
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Copy of the poem with a missing or invalid `fecha` replaced by null. */
export function normalizePoem(p) {
  const fecha = typeof p?.fecha === "string" && isRealDate(p.fecha) ? p.fecha : null;
  return { ...p, fecha };
}
