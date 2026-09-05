import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { fetchDestinations, fetchEvents } from "../../src/api/catalog";
import { ApiError } from "../../src/api/client";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { DestinationCard } from "../../src/components/DestinationCard";
import { ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import { destinationCover } from "../../src/discover/dedupe";
import type { CatalogDestination, CatalogEvent } from "../../src/models/event";
import { colors } from "../../src/theme";

export default function ExploreScreen() {
  const [destinations, setDestinations] = useState<CatalogDestination[]>([]);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [places, feed] = await Promise.all([
        fetchDestinations(),
        fetchEvents({ page: 1, when: "valid", limit: 20 }),
      ]);
      setDestinations(places);
      setEvents(feed.events);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load destinations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.gold}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Text style={styles.kicker}>Explore</Text>
        <Text style={styles.title}>Places across East Africa</Text>
        <Text style={styles.lede}>
          Destinations from the live SafariPlug catalog. The map shows only records we actually have.
        </Text>
        <View style={styles.map}>
          <Text style={styles.mapKicker}>Map</Text>
          <Text style={styles.mapTitle}>Coordinates appear when listings include them.</Text>
          <Text style={styles.mapBody}>
            No invented pins. When events and stays ship real locations, they will land here.
          </Text>
        </View>
        {loading ? (
          <LoadingBlock label="Loading destinations…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void load()} />
        ) : destinations.length === 0 ? (
          <ComingSoonCard
            title="Destinations are loading from the catalog"
            body="SafariPlug will not invent cities that the API does not return."
          />
        ) : (
          <View style={styles.grid}>
            {destinations.map((destination) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                imageUrl={destinationCover(destination.name, events)}
                wide
                onPress={() => router.push(`/destination/${destination.slug}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 32, fontWeight: "600", lineHeight: 38 },
  lede: { color: colors.textMuted, lineHeight: 22 },
  map: {
    borderRadius: 28,
    minHeight: 180,
    padding: 22,
    justifyContent: "flex-end",
    backgroundColor: colors.forest,
    gap: 6,
  },
  mapKicker: {
    color: colors.goldSoft,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  mapTitle: { color: colors.text, fontSize: 20, fontWeight: "600" },
  mapBody: { color: colors.sand, lineHeight: 20 },
  grid: { gap: 12 },
});
