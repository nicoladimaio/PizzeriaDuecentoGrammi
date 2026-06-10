import crypto from "crypto";

type ProposalDecision = "accept" | "reject";

type CreateTokenInput = {
  code: string;
  decision: ProposalDecision;
  expiresAt: number;
};

type VerifyTokenInput = {
  code: string;
  decision: ProposalDecision;
  token: string;
};

const getSecret = () =>
  process.env.RESERVATION_ACTION_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.SMTP_PASSWORD ||
  "duecentogrammi-dev-secret";

const signPayload = (payload: string): string => {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
};

export const createProposalActionToken = ({
  code,
  decision,
  expiresAt,
}: CreateTokenInput): string => {
  const payload = `${code}|${decision}|${expiresAt}`;
  const signature = signPayload(payload);
  return `${expiresAt}.${signature}`;
};

export const verifyProposalActionToken = ({
  code,
  decision,
  token,
}: VerifyTokenInput): boolean => {
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!expiresAtRaw || !signature || !Number.isFinite(expiresAt)) {
    return false;
  }

  if (Date.now() > expiresAt) {
    return false;
  }

  const payload = `${code}|${decision}|${expiresAt}`;
  const expected = signPayload(payload);
  if (signature.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
