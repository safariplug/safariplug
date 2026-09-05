import { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { fetchEvents, fetchExperienceTaxonomy } from "../../src/api/catalog";
import {
  fetchHotels,
  fetchServices,
  fetchTransferSearch,
  fetchTransfersCatalog,
  type InventoryState,
} from "../../src/api/inventory";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { EventCard } from "../../src/components/EventCard";
import { ExperienceCard } from "../../src/components/ExperienceCard";
import { ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import { categoryByKind } from "../../src/discover/categories";
import type { CatalogEvent, CatalogExperienceCollection } from "../../src/models/event";
import { colors } from "../../src/theme";

function comingCopy(kind: string, state?: InventoryState<unknown>) {
  if (kind === "stay") {
    return {
      title: "Hotel booking is coming soon",
      body: "SafariPlug is connecting trusted accommodation partners across Africa. /api/v1/hotels is not configured — no rooms or rates are invented.",
    };
  }
  if (kind === "transfers") {
    return {
      title: "Transfers are coming soon",
      body: "Airport / hotel / date / passengers / luggage will search live suppliers. None are connected yet.",
    };
  }
  if (kind === "drivers") {
    return {
      title: "Trusted private drivers are coming soon",
      body: "SafariPlug will not publish an unverified driver directory. Contact details and verification evidence stay private.",
    };
  }
  if (kind === "food") {
    return {
      title: "Food & drink is being mapped",
      body: "Restaurants and dining experiences appear when the catalog has them. Nothing here is fabricated.",
    };
  }
  if (kind === "adventure" || kind === "wellness" || kind === "activities") {
    return {
      title: "Live services are not listed yet",
      body: state?.code
        ? `The services API reported ${state.code}.`
        : "Adventure, wellness and activities use the unified SafariPlug services catalog.",
    };
  }
  return {
    title: "Coming soon",
    body: "This surface is ready for live inventory. SafariPlug will not fake it.",
  };
}

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const category = categoryByKind(kind || "");
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [collections, setCollections] = useState<CatalogExperienceCollection[]>([]);
  const [inventory, setInventory] = useState<InventoryState<unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (kind === "events") {
        const feed = await fetchEvents({ page: 1, when: "valid", limit: 20 });
        setEvents(feed.events);
      } else if (kind === "experiences" || kind === "safaris") {
        const taxonomy = await fetchExperienceTaxonomy();
        setCollections(taxonomy.collections);
      } else if (kind === "stay") {
        setInventory(await fetchHotels());
      } else if (kind === "transfers") {
        const [catalog, search] = await Promise.all([
          fetchTransfersCatalog(),
          fetchTransferSearch(),
        ]);
        setInventory(catalog.status === "available" ? catalog : search);
      } else if (kind === "adventure" || kind === "wellness" || kind === "activities") {
        setInventory(await fetchServices());
      } else {
        setInventory({ status: "not_configured", data: null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this category.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = category?.label || "SafariPlug";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title }} />
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : kind === "events" ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ComingSoonCard
              title="No approved events just now"
              body="The events API returned an empty catalog for this filter."
            />
          }
        />
      ) : kind === "experiences" || kind === "safaris" ? (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.blurb}>{category?.blurb}</Text>
          {collections.length ? (
            collections.map((collection) => (
              <View key={collection.slug} style={{ marginBottom: 12 }}>
                <ExperienceCard collection={collection} />
              </View>
            ))
          ) : (
            <ComingSoonCard
              title="More experiences are coming to SafariPlug"
              body="The experiences API has no collections to show yet."
            />
          )}
        </ScrollView>
      ) : inventory?.status === "available" && Array.isArray(inventory.data) ? (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.blurb}>{category?.blurb}</Text>
          <Text style={styles.meta}>{inventory.data.length} live listings</Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.blurb}>{category?.blurb}</Text>
          <ComingSoonCard
            title={comingCopy(kind || "", inventory || undefined).title}
            body={comingCopy(kind || "", inventory || undefined).body}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, gap: 16, paddingBottom: 48 },
  list: { padding: 20, paddingBottom: 48 },
  blurb: { color: colors.textMuted, lineHeight: 22, fontSize: 16 },
  meta: { color: colors.goldSoft },
});
