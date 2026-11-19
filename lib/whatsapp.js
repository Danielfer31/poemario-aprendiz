/** Build a wa.me link for a phone number (country code included) and an optional prefilled message. */
export function whatsappLink(phone, message = "") {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
