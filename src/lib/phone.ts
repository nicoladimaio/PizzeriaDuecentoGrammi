export const normalizePhoneE164 = (
  raw: string,
  defaultCountryCode = "+39",
): string | null => {
  const value = raw.trim();
  if (!value) return null;

  const compact = value.replace(/[\s().-]/g, "");

  let normalized = compact;
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  } else if (!normalized.startsWith("+")) {
    normalized = `${defaultCountryCode}${normalized}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return null;
  }

  return normalized;
};
