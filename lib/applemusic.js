const TYPES = new Set(["album", "song", "playlist"]);
const HOSTS = new Set(["music.apple.com", "embed.music.apple.com"]);

/** Convert an Apple Music link to its official embed URL, or null if not recognised. */
export function toAppleEmbedUrl(link) {
  if (typeof link !== "string" || !link.trim()) return null;
  let url;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // /<storefront>/<type>/<slug>/<id>
  if (parts.length < 3 || !/^[a-z]{2}$/.test(parts[0]) || !TYPES.has(parts[1])) return null;
  if (!parts.slice(2).every((p) => /^[\w.%-]+$/.test(p))) return null;
  const track = url.searchParams.get("i");
  const query = track && /^\d+$/.test(track) ? `?i=${track}` : "";
  return `https://embed.music.apple.com/${parts.join("/")}${query}`;
}
