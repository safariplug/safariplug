import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetchEvent } from "../../src/api/catalog";
import { ApiError } from "../../src/api/client";
import { EventImage } from "../../src/components/EventImage";
import { PriceLabel } from "../../src/components/PriceLabel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import { supabase } from "../../src/auth";
import type { CatalogEvent } from "../../src/models/event";
import { API_BASE_URL } from "../../src/config";
import { colors } from "../../src/theme";
import { formatEventWhen, venueLine } from "../../src/utils/format";

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [event, setEvent] = useState<CatalogEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchEvent(id)
      .then((row) => { if (!cancelled) setEvent(row); })
      .catch((err) => {
        if (cancelled) return;
        setEvent(null);
        setError(err instanceof ApiError ? err.message : "Event is not available.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function addToJourney() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push({ pathname: "/auth", params: { next: `/event/${id}` } });
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/trips/from-event`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ eventId: id }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.push({ pathname: "/auth", params: { next: `/event/${id}` } });
        return;
      }
      if (!response.ok) throw new Error(body.error || "Could not add this experience.");
      setMessage(body.added === false ? "Already in your journey." : "Added to your journey.");
      if (body.trip?.id) {
        setTimeout(() => router.replace("/(tabs)/trips"), 350);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add this experience.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error || !event) {
    return <ErrorBlock message={error || "Event is not available."} onRetry={() => {
      setLoading(true);
      fetchEvent(id).then(setEvent).catch((err) => setError(err instanceof ApiError ? err.message : "Event is not available.")).finally(() => setLoading(false));
    }} />;
  }

  const when = formatEventWhen(event.start_at, event.end_at);
  const venue = venueLine(event);
  const bookingUrl = event.booking_url;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <EventImage uri={event.image_url} style={styles.hero} />
      {event.category ? <Text style={styles.kicker}>{event.category}</Text> : null}
      <Text style={styles.title}>{event.title}</Text>
      <PriceLabel price={event.price} currency={event.currency} />
      {when ? <Text style={styles.meta}>{when}</Text> : null}
      {venue ? <Text style={styles.meta}>{venue}</Text> : null}
      {event.venue_address ? <Text style={styles.meta}>{event.venue_address}</Text> : null}
      {event.organizer_name ? <Text style={styles.meta}>Organizer · {event.organizer_name}</Text> : null}
      {event.description ? <Text style={styles.body}>{event.description}</Text> : <EmptyBlock title="No description" body="This listing has no description yet." />}
      <Pressable style={styles.primary} onPress={() => void addToJourney()} disabled={saving} accessibilityRole="button">
        {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryLabel}>＋ Add to My Journey</Text>}
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {bookingUrl ? <Pressable style={styles.cta} onPress={() => void Linking.openURL(bookingUrl)} accessibilityRole="link"><Text style={styles.ctaLabel}>Open booking source</Text></Pressable> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, backgroundColor: colors.bg },
  hero: { height: 320, borderRadius: 28, marginBottom: 18 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", lineHeight: 34, marginBottom: 10 },
  meta: { color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  body: { color: colors.text, marginTop: 18, fontSize: 16, lineHeight: 24 },
  primary: { marginTop: 28, minHeight: 54, borderRadius: 999, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryLabel: { color: colors.bg, fontWeight: "800", fontSize: 15 },
  message: { color: colors.goldSoft, textAlign: "center", marginTop: 10, fontSize: 12, lineHeight: 18 },
  cta: { marginTop: 14, backgroundColor: colors.goldSoft, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  ctaLabel: { color: colors.bg, fontWeight: "800", fontSize: 15 },
});
