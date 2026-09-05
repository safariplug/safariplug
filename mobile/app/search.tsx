import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { fetchDestinations, searchEvents } from "../src/api/catalog";
import { ApiError } from "../src/api/client";
import { ComingSoonCard } from "../src/components/ComingSoonCard";
import { EventCard } from "../src/components/EventCard";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../src/components/StatusBlocks";
import type { CatalogDestination, CatalogEvent } from "../src/models/event";
import { colors } from "../src/theme";

const FILTERS = ["All", "Stays", "Experiences", "Events", "Food", "Transfers", "Activities", "Places"] as const;
type Filter = (typeof FILTERS)[number];

const COMING: Partial<Record<Filter, { title: string; body: string }>> = {
  Stays: {
    title: "Hotel booking is coming soon",
    body: "SafariPlug is connecting trusted accommodation partners across Africa. Search will not invent rooms or rates.",
  },
  Food: {
    title: "Dining inventory is not live",
    body: "Restaurants and culinary experiences will appear from the catalog when they exist.",
  },
  Transfers: {
    title: "Transfers are coming soon",
    body: "Airport and hotel transfers need a live supplier. No fake cars or prices.",
  },
};

export default function SearchScreen() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [places, setPlaces] = useState<CatalogDestination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(draft.trim()), 400);
    return () => clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    void fetchDestinations()
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!query || (filter !== "All" && filter !== "Events" && filter !== "Experiences")) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    searchEvents(query)
      .then((result) => {
        if (!cancelled) setEvents(result.events);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvents([]);
        setError(err instanceof ApiError ? err.message : "Search failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, filter]);

  const coming = COMING[filter];
  const matchedPlaces =
    filter === "Places" || filter === "All"
      ? places.filter((row) =>
          query ? row.name.toLowerCase().includes(query.toLowerCase()) : false
        )
      : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ title: "Search" }} />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Destinations, events, stays, experiences"
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={80}
        style={styles.input}
        accessibilityLabel="Search SafariPlug"
      />
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.chip, filter === item && styles.chipOn]}
          >
            <Text style={[styles.chipLabel, filter === item && styles.chipLabelOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {coming && filter !== "All" ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ComingSoonCard title={coming.title} body={coming.body} />
        </View>
      ) : loading ? (
        <LoadingBlock label="Searching…" />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
          )}
          ListHeaderComponent={
            matchedPlaces.length ? (
              <View style={{ marginBottom: 16, gap: 8 }}>
                {matchedPlaces.map((place) => (
                  <Pressable
                    key={place.id}
                    onPress={() => router.push(`/destination/${place.slug}`)}
                    style={styles.place}
                  >
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeMeta}>
                      {place.country || "Destination"}
                      {place.event_count ? ` · ${place.event_count} events` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? (
              <ErrorBlock message={error} onRetry={() => setQuery(query)} />
            ) : query ? (
              <EmptyBlock title="No matches" body="Try another city, venue, or experience name." />
            ) : (
              <EmptyBlock
                title="Search the catalog"
                body="SafariPlug search uses the live API. It will not invent hotels, drivers or prices."
              />
            )
          }
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  input: {
    margin: 20,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: "rgba(212,165,116,0.16)", borderColor: colors.gold },
  chipLabel: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  chipLabelOn: { color: colors.goldSoft },
  list: { paddingHorizontal: 20, paddingBottom: 48 },
  place: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  placeMeta: { color: colors.textMuted, marginTop: 4 },
});
