const METRICOOL_BASE_URL = "https://app.metricool.com/api";

function requireMetricoolConfig() {
  const userToken = process.env.METRICOOL_USER_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  const blogId = process.env.METRICOOL_BLOG_ID;

  if (!userToken || !userId || !blogId) {
    throw new Error(
      "Metricool is not configured. Set METRICOOL_USER_TOKEN, METRICOOL_USER_ID, and METRICOOL_BLOG_ID."
    );
  }

  return { userToken, userId, blogId };
}

function formatNairobiDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

export async function scheduleMetricoolInstagramPost({
  text,
  imageUrl,
  videoUrl,
  scheduledAt,
}: {
  text: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  scheduledAt: Date;
}) {
  const { userToken, userId, blogId } = requireMetricoolConfig();

  if (!text.trim()) {
    throw new Error("Instagram post text is empty.");
  }

  if (!imageUrl && !videoUrl) {
    throw new Error("Instagram publishing requires an image or video URL.");
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Metricool publication time must be in the future.");
  }

  const media = [imageUrl, videoUrl].filter(
    (value): value is string => Boolean(value?.trim())
  );

  const response = await fetch(
    `${METRICOOL_BASE_URL}/v2/scheduler/posts?blogId=${encodeURIComponent(blogId)}&userId=${encodeURIComponent(userId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mc-Auth": userToken,
      },
      body: JSON.stringify({
        publicationDate: {
          dateTime: formatNairobiDateTime(scheduledAt),
          timezone: "Africa/Nairobi",
        },
        text,
        providers: [{ network: "instagram" }],
        autoPublish: true,
        draft: false,
        shortener: false,
        media,
        saveExternalMediaFiles: true,
        instagramData: {
          type: videoUrl ? "REEL" : "POST",
        },
      }),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  let data: unknown = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    const detail =
      typeof data === "string" ? data : JSON.stringify(data || {});
    throw new Error(`Metricool API ${response.status}: ${detail}`);
  }

  const result =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const postId =
    typeof result.id === "string" || typeof result.id === "number"
      ? String(result.id)
      : typeof result.postId === "string" || typeof result.postId === "number"
        ? String(result.postId)
        : null;

  return { postId, response: data };
}
