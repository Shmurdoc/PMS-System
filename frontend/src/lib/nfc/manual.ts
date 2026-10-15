// Manual UID entry — the fallback when no reader is attached (typed by hand
// or from a wedge scanner's keyboard output). Lenient on purpose: issued tag
// numbers aren't hex-only; the store actions reject ids they can't find.

const MAX_TAG_NUMBER = 64;

export function normalizeTagNumber(raw: string): string | null {
  const cleaned = raw.trim();
  if (cleaned.length === 0 || cleaned.length > MAX_TAG_NUMBER) return null;
  return cleaned;
}
