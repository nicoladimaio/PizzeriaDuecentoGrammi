export const isAllowedAdminEmail = (
  email: string | null | undefined,
): boolean => {
  if (!email) return false;

  const whitelist = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (whitelist.length === 0) return false;
  return whitelist.includes(email.toLowerCase());
};
