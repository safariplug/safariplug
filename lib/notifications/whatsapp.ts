function normalizeWhatsAppPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return digits.length >= 8 ? digits : null;
}

export function whatsappBookingLink(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export async function sendWhatsAppMessage(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!normalized || !token || !phoneNumberId) {
    return { sent: false, fallbackUrl: whatsappBookingLink(phone, message) };
  }

  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalized,
      type: "text",
      text: { preview_url: false, body: message },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("WhatsApp notification failed", response.status, detail);
    return { sent: false, fallbackUrl: whatsappBookingLink(phone, message) };
  }

  return { sent: true, fallbackUrl: null };
}
