const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const isTurnstileEnabled = () =>
  Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());

/** Verifica lato server il token prodotto dalla casella Turnstile. */
export const verifyTurnstileToken = async (
  token: string | undefined,
  remoteIp?: string | null,
): Promise<boolean> => {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("Errore verifica Turnstile", error);
    return false;
  }
};
