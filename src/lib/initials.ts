/**
 * Up to two initials for an account badge: "Tendai Moyo" → "TM",
 * "tendai@x.com" → "T". Shown on the brand navy instead of the account
 * photo, whose Google default is a coloured (often green) letter tile that
 * clashes with the theme and reads as a status colour.
 */
export function initialsFor(name: string | null | undefined): string {
  const words = (name ?? '').split('@')[0].trim().split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return '';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return (first + last).toUpperCase();
}
