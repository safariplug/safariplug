import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { fetchDestinations, fetchEvents } from "../../src/api/catalog";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { EventCard } from "../../src/components/EventCard";
import { HeroSection } from "../../src/components/HeroSection";
import { StoryCta } from "../../src/components/StoryCta";
import { ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import { TRAVEL_CATEGORIES } from "../../src/discover/categories";
import { destinationCover } from "../../src/discover/dedupe";
import type { CatalogDestination, CatalogEvent } from "../../src/models/event";
import { colors } from "../../src/theme";

export default function DestinationScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [destination, setDestination] = useState<CatalogDestination | null>(null);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [places, feed] = await Promise.all([
        fetchDestinations(),
        fetchEvents({ page: 1, when: "valid", limit: 20 }),
      ]);
      const match = places.find((row) => row.slug === slug) || null;
      setDestination(match);
      const local = match
        ? feed.events.filter((event) => event.city?.name === match.name)
        : [];
      setEvents(local.length ? local : match ? [] : feed.events);
      if (!match) setError("That destination is not in the catalog.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load destination.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const hero = useMemo(
    () => (destination ? destinationCover(destination.name, events) : null),
    [destination, events]
  );

  if (loading) return <LoadingBlock />;
  if (error || !destination) {
    return <ErrorBlock message={error || "Not found."} onRetry={() => void load()} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: destination.name }} />
      <ScrollView contentContainerStyle={styles.page}>
        <HeroSection
          imageUrl={hero}
          kicker={destination.country || "Destination"}
          title={destination.name}
          body={
            destination.event_count > 0
              ? `${destination.event_count} approved events to discover.`
              : "Stay, eat, move and explore — live sections appear when the catalog has them."
          }
        />
        <View style={styles.body}>
          <Text style={styles.section}>About {destination.name}</Text>
          <Text style={styles.lede}>
            {destination.country
              ? `${destination.name}, ${destination.country}.`
              : destination.name}{" "}
            This page only lists what SafariPlug actually has approved.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            {TRAVEL_CATEGORIES.map((category) => (
              <Text key={category.kind} style={styles.pill} onPress={() => router.push(`/category/${category.kind}`)}>
                {category.label}
              </Text>
            ))}
          </ScrollView>
          {events.length ? (
            <>
              <Text style={styles.section}>Happening soon</Text>
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                />
              ))}
            </>
          ) : (
            <ComingSoonCard
              title={`No approved events in ${destination.name} just now`}
              body="Stays, food, adventure and transfers will appear in their own sections when those APIs have live data."
            />
          )}
          <StoryCta
            kicker="Plan your trip"
            title={`Build a ${destination.name} itinerary`}
            body="Save stays, events and experiences in one trip. Confirmation stays off until suppliers are live."
            action="Open Trips →"
            onPress={() => router.push("/(tabs)/trips")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingBottom: 40 },
  body: { padding: 20, gap: 14 },
  section: { color: colors.text, fontSize: 22, fontWeight: "600", marginTop: 8 },
  lede: { color: colors.textMuted, lineHeight: 22 },
  pills: { gap: 8, paddingRight: 20 },
  pill: {
    color: colors.goldSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "700",
  },
});
