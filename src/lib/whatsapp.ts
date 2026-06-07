type WhatsAppResult = {
  sid: string;
};

export class WhatsAppSendError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "WhatsAppSendError";
    this.code = code;
  }
}

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_WHATSAPP_FROM;

export const sendWhatsAppMessage = async (
  to: string,
  body: string,
): Promise<WhatsAppResult> => {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    throw new Error("Config Twilio WhatsApp mancante.");
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString(
    "base64",
  );

  const payload = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${twilioFromNumber}`,
    Body: body,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  const data = (await response.json()) as {
    sid?: string;
    message?: string;
    code?: number;
  };

  if (!response.ok || !data.sid) {
    throw new WhatsAppSendError(
      data.message ?? "Invio WhatsApp fallito.",
      data.code,
    );
  }

  return { sid: data.sid };
};
