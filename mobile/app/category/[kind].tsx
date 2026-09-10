import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { fetchEvents, fetchExperienceTaxonomy } from "../../src/api/catalog";
import { apiGet, ApiError } from "../../src/api/client";
import { fetchHotels, fetchServices, fetchTransferSearch, fetchTransfersCatalog, type InventoryState } from "../../src/api/inventory";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { EventCard } from "../../src/components/EventCard";
import { ExperienceCard } from "../../src/components/ExperienceCard";
import { ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import { categoryByKind } from "../../src/discover/categories";
import type { CatalogEvent, CatalogExperienceCollection } from "../../src/models/event";
import { colors } from "../../src/theme";

type ServiceOffering = { id: string; title: string; description?: string | null; category?: string | null; city_id?: string | null };
type Restaurant = { id: string; name: string; slug: string; description?: string | null; city_id?: string | null };

function comingCopy(kind: string, state?: InventoryState<unknown>) {
  if (kind === "stay") return { title: "Hotel booking is coming soon", body: "SafariPlug is connecting trusted accommodation partners across Africa. No rooms or rates are invented." };
  if (kind === "transfers") return { title: "Transfers are coming soon", body: "Airport, hotel, date, passengers and luggage will search live suppliers. None are connected yet." };
  if (kind === "drivers") return { title: "Trusted private drivers are coming soon", body: "SafariPlug will not publish an unverified driver directory." };
  return { title: "Live services are not listed yet", body: state?.code ? `The services API reported ${state.code}.` : "SafariPlug will show approved service listings here when available." };
}

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const category = categoryByKind(kind || "");
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [collections, setCollections] = useState<CatalogExperienceCollection[]>([]);
  const [inventory, setInventory] = useState<InventoryState<unknown> | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null); setLoading(true);
    try {
      if (kind === "events") setEvents((await fetchEvents({ page: 1, when: "valid", limit: 20 })).events);
      else if (kind === "experiences" || kind === "safaris") setCollections((await fetchExperienceTaxonomy()).collections);
      else if (kind === "stay") setInventory(await fetchHotels());
      else if (kind === "transfers") {
        const [catalog, search] = await Promise.all([fetchTransfersCatalog(), fetchTransferSearch()]);
        setInventory(catalog.status === "available" ? catalog : search);
      } else if (kind === "food") {
        const result = await apiGet<Restaurant[]>("/restaurants");
        setRestaurants(Array.isArray(result.data) ? result.data : []);
      } else if (kind === "adventure" || kind === "wellness" || kind === "activities") setInventory(await fetchServices());
      else setInventory({ status: "not_configured", data: null });
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load this category."); }
    finally { setLoading(false); }
  }, [kind]);

  useEffect(() => { void load(); }, [load]);
  const title = category?.label || "SafariPlug";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title }} />
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={() => void load()} /> : kind === "events" ? (
        <FlatList data={events} keyExtractor={(item) => item.id} renderItem={({ item }) => <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />} contentContainerStyle={styles.list} ListEmptyComponent={<ComingSoonCard title="No approved events just now" body="The events API returned an empty catalog for this filter." />} />
      ) : kind === "experiences" || kind === "safaris" ? (
        <ScrollView contentContainerStyle={styles.page}><Text style={styles.blurb}>{category?.blurb}</Text>{collections.length ? collections.map((collection) => <View key={collection.slug} style={styles.collection}><ExperienceCard collection={collection} /></View>) : <ComingSoonCard title="More experiences are coming to SafariPlug" body="The experiences API has no collections to show yet." />}</ScrollView>
      ) : kind === "food" ? (
        <ScrollView contentContainerStyle={styles.page}><Text style={styles.blurb}>{category?.blurb}</Text><Text style={styles.meta}>{restaurants.length} restaurants with ordering enabled</Text>{restaurants.length ? restaurants.map((restaurant) => <Pressable key={restaurant.id} style={styles.card} onPress={() => router.push({ pathname: "/restaurant/[businessId]", params: { businessId: restaurant.id, name: restaurant.name } })}><Text style={styles.cardKicker}>ORDERING LIVE</Text><Text style={styles.cardTitle}>{restaurant.name}</Text>{restaurant.description ? <Text style={styles.cardBody}>{restaurant.description}</Text> : null}<Text style={styles.goldCta}>View menu →</Text></Pressable>) : <ComingSoonCard title="No restaurants are live yet" body="SafariPlug only shows restaurants after online ordering is enabled." />}</ScrollView>
      ) : inventory?.status === "available" && Array.isArray(inventory.data) ? (
        <ScrollView contentContainerStyle={styles.page}><Text style={styles.blurb}>{category?.blurb}</Text><Text style={styles.meta}>{inventory.data.length} live listings</Text>{kind === "adventure" || kind === "wellness" || kind === "activities" ? <View style={styles.cards}>{(inventory.data as ServiceOffering[]).map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardKicker}>{item.category || "SafariPlug service"}</Text><Text style={styles.cardTitle}>{item.title}</Text>{item.description ? <Text style={styles.cardBody}>{item.description}</Text> : null}<Pressable style={styles.cta} onPress={() => router.push({ pathname: "/concierge", params: { request: `I want to arrange ${item.title}${item.category ? ` (${item.category})` : ""}. Please show me real providers and available times.` } })}><Text style={styles.ctaText}>Ask Concierge to arrange →</Text></Pressable></View>)}</View> : null}</ScrollView>
      ) : <ScrollView contentContainerStyle={styles.page}><Text style={styles.blurb}>{category?.blurb}</Text><ComingSoonCard title={comingCopy(kind || "", inventory || undefined).title} body={comingCopy(kind || "", inventory || undefined).body} /></ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, page: { padding: 20, gap: 16, paddingBottom: 48 }, list: { padding: 20, paddingBottom: 48 }, blurb: { color: colors.textMuted, lineHeight: 22, fontSize: 16 }, meta: { color: colors.goldSoft }, collection: { marginBottom: 12 }, cards: { gap: 12 }, card: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 16, gap: 8 }, cardKicker: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" }, cardTitle: { color: colors.text, fontSize: 19, fontWeight: "700" }, cardBody: { color: colors.textMuted, lineHeight: 20 }, cta: { marginTop: 4, borderRadius: 14, backgroundColor: colors.gold, paddingVertical: 12, alignItems: "center" }, ctaText: { color: colors.bg, fontWeight: "800", fontSize: 13 }, goldCta: { color: colors.goldSoft, fontWeight: "800", fontSize: 13 },
});
