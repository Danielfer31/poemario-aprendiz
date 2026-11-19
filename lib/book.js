import { splitStanzas } from "./poems.js";

/**
 * Split stanzas into pages of at most `capacity` lines. The blank line between
 * stanzas counts as 1, but only between stanzas on the same page. A stanza that
 * does not fit moves whole to the next page; one longer than `capacity` is split by lines.
 */
export function paginate(stanzas, capacity) {
  const cap = Math.max(1, Math.floor(capacity) || 1);
  const pages = [];
  let page = [];
  let used = 0;
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };

  for (const stanza of stanzas) {
    if (stanza.length > cap) {
      flush();
      for (let i = 0; i < stanza.length; i += cap) pages.push([stanza.slice(i, i + cap)]);
      continue;
    }
    const cost = stanza.length + (page.length ? 1 : 0);
    if (used + cost > cap) flush();
    used += stanza.length + (page.length ? 1 : 0);
    page.push(stanza);
  }
  flush();
  return pages;
}

/**
 * Build the ordered page list. Expects already-validated, normalized poems.
 * Per poem: poem page(s), then sky (when `hasSky(poema)`, by default when it has a fecha)
 * and for-you (song + drawing).
 */
export function buildPages(poemas, { capacity, hasSky = (poema) => Boolean(poema.fecha) }) {
  const pages = [{ kind: "cover" }];
  for (const poema of poemas) {
    const chunks = paginate(splitStanzas(poema.texto), capacity);
    if (chunks.length === 0) chunks.push([]);
    chunks.forEach((chunk, i) => {
      pages.push({ kind: "poem", poemId: poema.id, chunk, cont: i < chunks.length - 1 });
    });
    if (hasSky(poema)) pages.push({ kind: "sky", poemId: poema.id });
    pages.push({ kind: "for-you", poemId: poema.id });
  }
  pages.push({ kind: "coming" }, { kind: "surprise" }, { kind: "back" });
  return pages;
}

/** Index of the first poem page matching `#id`, or 0. Never throws. */
export function pageForHash(pages, hash) {
  let id;
  try {
    id = decodeURIComponent(String(hash ?? "").replace(/^#/, ""));
  } catch {
    return 0;
  }
  if (!id) return 0;
  const i = pages.findIndex((p) => p.kind === "poem" && p.poemId === id);
  return i === -1 ? 0 : i;
}
