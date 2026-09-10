import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { fetchEvent } from "../../src/api/catalog";
import { ApiError } from "../../src/api/client";
import { API_BASE_URL } from "../../src/config";
import { supabase } from "../../src/auth";
import { EventImage } from "../../src/components/EventImage";
import { PriceLabel } from "../../src/components/PriceLabel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import type { CatalogEvent } from "../../src/models/event";
import { colors } from "../../src/theme";
import { formatEventWhen, venueLine } from "../../src/utils/format";

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tripId?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const [event, setEvent] = useState<CatalogEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToTrip, setAddingToTrip] = useState(false);
  const [tripMessage, setTripMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchEvent(id)
      .then((row) => {
        if (!cancelled) setEvent(row);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvent(null);
        setError(err instanceof ApiError ? err.message : "Event is not available.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addToTrip() {
    if (!tripId || !event || addingToTrip) return;
    setAddingToTrip(true);
    setTripMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setTripMessage("Sign in to add this event to your journey.");
        return;
      }
      const response = await fetch(
        `${API_BASE_URL}/api/trip-planner/${encodeURIComponent(tripId)}/items`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: event.id, item_kind: "event" }),
        }
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string; added?: boolean }
        | null;
      if (!response.ok) {
        setTripMessage(body?.error || "Unable to add this event to your journey.");
        return;
      }
      setTripMessage(body?.added === false ? "Already in this journey." : "Added to this journey.");
    } catch {
      setTripMessage("Unable to add this event to your journey.");
    } finally {
      setAddingToTrip(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error || !event) {
    return (
      <ErrorBlock
        message={error || "Event is not available."}
        onRetry={() => {
          setLoading(true);
          fetchEvent(id)
            .then(setEvent)
            .catch((err) =>
              setError(err instanceof ApiError ? err.message : "Event is not available.")
            )
            .finally(() => setLoading(false));
        }}
      />
    );
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
      {event.venue_address ? (
        <Text style={styles.meta}>{event.venue_address}</Text>
      ) : null}
      {event.organizer_name ? (
        <Text style={styles.meta}>Organizer · {event.organizer_name}</Text>
      ) : null}
      {event.description ? (
        <Text style={styles.body}>{event.description}</Text>
      ) : (
        <EmptyBlock title="No description" body="This listing has no description yet." />
      )}
      {tripId ? (
        <>
          <Pressable
            style={[styles.cta, addingToTrip && styles.ctaDisabled]}
            onPress={() => void addToTrip()}
            disabled={addingToTrip}
          >
            <Text style={styles.ctaLabel}>
              {addingToTrip ? "Adding to journey…" : "Add to this journey"}
            </Text>
          </Pressable>
          {tripMessage ? <Text style={styles.tripMessage}>{tripMessage}</Text> : null}
        </>
      ) : null}
      {bookingUrl ? (
        <Pressable
          style={tripId ? styles.secondaryCta : styles.cta}
          onPress={() => void Linking.openURL(bookingUrl)}
          accessibilityRole="link"
        >
          <Text style={styles.ctaLabel}>Open booking source</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, backgroundColor: colors.bg },
  hero: { height: 320, borderRadius: 28, marginBottom: 18 },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    marginBottom: 10,
  },
  meta: { color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  body: { color: colors.text, marginTop: 18, fontSize: 16, lineHeight: 24 },
  cta: {
    marginTop: 28,
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryCta: {
    marginTop: 12,
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.6 },
  ctaLabel: { color: colors.bg, fontWeight: "800", fontSize: 15 },
  tripMessage: { color: colors.textMuted, marginTop: 10, textAlign: "center" },
});
