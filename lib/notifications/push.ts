type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendExpoPushNotifications(tokens: string[], payload: PushPayload) {
  const validTokens = tokens.filter((token) => /^ExponentPushToken\[.+\]$/.test(token));
  if (!validTokens.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < validTokens.length; i += 100) {
    const chunk = validTokens.slice(i, i + 100);
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((to) => ({ to, title: payload.title, body: payload.body, data: payload.data ?? {}, sound: "default" }))),
      });
      if (!response.ok) {
        failed += chunk.length;
        continue;
      }
      const result = await response.json().catch(() => null) as { data?: Array<{ status?: string }> } | null;
      const receipts = result?.data ?? [];
      sent += receipts.filter((item) => item.status === "ok").length;
      failed += chunk.length - receipts.filter((item) => item.status === "ok").length;
    } catch (error) {
      failed += chunk.length;
      console.error("Expo push notification failed", error);
    }
  }
  return { sent, failed };
}
