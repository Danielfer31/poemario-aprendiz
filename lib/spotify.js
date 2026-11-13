const TYPES = new Set(["track", "album", "playlist", "episode", "show", "artist"]);
const ID = /^[A-Za-z0-9]+$/;

function embed(type, id) {
  return TYPES.has(type) && ID.test(id) ? `https://open.spotify.com/embed/${type}/${id}?theme=0` : null;
}

/** Convert a Spotify link or URI to its official embed URL, or null if not recognised. */
export function toEmbedUrl(link) {
  if (typeof link !== "string" || !link.trim()) return null;
  const s = link.trim();
  const uri = /^spotify:([a-z]+):([A-Za-z0-9]+)$/.exec(s);
  if (uri) return embed(uri[1], uri[2]);
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.hostname !== "open.spotify.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift();
  if (parts[0] === "embed") parts.shift();
  return embed(parts[0], parts[1]);
}
