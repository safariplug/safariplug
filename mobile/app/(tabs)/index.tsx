import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { fetchDestinations, fetchEvents, fetchExperienceTaxonomy } from "../../src/api/catalog";
import { ApiError } from "../../src/api/client";
import { AppHeader } from "../../src/components/AppHeader";
import { CategoryTile } from "../../src/components/CategoryTile";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { DestinationCard } from "../../src/components/DestinationCard";
import { EventCard } from "../../src/components/EventCard";
import { ExperienceCard } from "../../src/components/ExperienceCard";
import { HeroSection } from "../../src/components/HeroSection";
import { HorizontalRail } from "../../src/components/HorizontalRail";
import { LoadingSkeleton } from "../../src/components/LoadingSkeleton";
import { SearchBar } from "../../src/components/SearchBar";
import { StoryCta } from "../../src/components/StoryCta";
import { ErrorBlock } from "../../src/components/StatusBlocks";
import { TRAVEL_CATEGORIES } from "../../src/discover/categories";
import { destinationCover, excludeById, firstCatalogImage } from "../../src/discover/dedupe";
import type {
  CatalogDestination,
  CatalogEvent,
  CatalogExperienceCollection,
} from "../../src/models/event";
import { colors } from "../../src/theme";

export default function DiscoverScreen() {
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [featured, setFeatured] = useState<CatalogEvent[]>([]);
  const [destinations, setDestinations] = useState<CatalogDestination[]>([]);
  const [collections, setCollections] = useState<CatalogExperienceCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setError(null);
    try {
      const [feed, featuredFeed, places, taxonomy] = await Promise.all([
        fetchEvents({ page: 1, when: "valid", limit: 12 }),
        fetchEvents({ page: 1, featured: true, when: "valid", limit: 8 }),
        fetchDestinations(),
        fetchExperienceTaxonomy(),
      ]);
      setEvents(feed.events);
      setFeatured(featuredFeed.events);
      setDestinations(places);
      setCollections(taxonomy.collections);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load SafariPlug.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const happening = excludeById(events, featured);
  const heroEvent = featured.find((row) => row.image_url) || events.find((row) => row.image_url);
  const heroImage = heroEvent?.image_url ?? firstCatalogImage(events);

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
              void bootstrap();
            }}
          />
        }
      >
        <AppHeader
          onSearch={() => router.push("/search")}
          onProfile={() => router.push("/(tabs)/you")}
        />
        <View style={styles.searchWrap}>
          <SearchBar onPress={() => router.push("/search")} />
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 20 }}>
            <LoadingSkeleton height={360} />
            <LoadingSkeleton height={108} />
          </View>
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void bootstrap()} />
        ) : (
          <>
            <HeroSection
              imageUrl={heroImage}
              title={"Discover Africa\ndifferently."}
              body="Find places to stay, things to do, people to meet and experiences worth remembering."
              onPress={
                heroEvent ? () => router.push(`/event/${heroEvent.id}`) : undefined
              }
            />

            <HorizontalRail title="Explore by category">
              {TRAVEL_CATEGORIES.map((category) => (
                <CategoryTile
                  key={category.kind}
                  category={category}
                  onPress={() => router.push(`/category/${category.kind}`)}
                />
              ))}
            </HorizontalRail>

            {destinations.length ? (
              <HorizontalRail
                title="Popular destinations"
                actionLabel="See all"
                onAction={() => router.push("/(tabs)/explore")}
              >
                {destinations.map((destination) => (
                  <DestinationCard
                    key={destination.id}
                    destination={destination}
                    imageUrl={destinationCover(destination.name, [...featured, ...events])}
                    onPress={() => router.push(`/destination/${destination.slug}`)}
                  />
                ))}
              </HorizontalRail>
            ) : null}

            <View style={styles.sectionPad}>
              <Text style={styles.sectionTitle}>Featured experiences</Text>
              {collections.length ? (
                <ScrollRail>
                  {collections.map((collection) => (
                    <ExperienceCard
                      key={collection.slug}
                      collection={collection}
                      onPress={() => router.push("/category/experiences")}
                    />
                  ))}
                </ScrollRail>
              ) : (
                <ComingSoonCard
                  title="More experiences are coming to SafariPlug"
                  body="Tours, safaris, dining and wellness will appear here from the live catalog — never as invented listings."
                />
              )}
            </View>

            {happening.length ? (
              <HorizontalRail
                title="Happening soon"
                actionLabel="See all"
                onAction={() => router.push("/category/events")}
              >
                {happening.slice(0, 8).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    compact
                    onPress={() => router.push(`/event/${event.id}`)}
                  />
                ))}
              </HorizontalRail>
            ) : featured.length ? null : (
              <View style={styles.sectionPad}>
                <ComingSoonCard
                  title="No events just now"
                  body="There are no approved upcoming events in the catalog."
                />
              </View>
            )}

            {featured.length && happening.length === 0 ? (
              <View style={styles.sectionPad}>
                <Text style={styles.sectionTitle}>Happening soon</Text>
                <Text style={styles.muted}>
                  Featured stories are already shown above. More dates will appear here as they are approved.
                </Text>
              </View>
            ) : null}

            <StoryCta
              kicker="Explore"
              title="See Africa on the map"
              body="Destinations, events and experiences — only where real coordinates exist."
              action="Open Explore →"
              onPress={() => router.push("/(tabs)/explore")}
            />
            <StoryCta
              kicker="Trips"
              title="Plan your trip"
              body="Save a stay, a transfer, a table and a night out in one itinerary. Booking confirmation stays off until a real supplier is live."
              action="Open Trips →"
              onPress={() => router.push("/(tabs)/trips")}
            />
            <StoryCta
              kicker="Ask SafariPlug AI"
              title="What are you looking for?"
              body={'Try “Plan me 4 days in Watamu” — answers will only use live SafariPlug tools, never invented prices.'}
              action="Ask SafariPlug →"
              onPress={() => router.push("/ask")}
            />
            <View style={{ height: 28 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScrollRail({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: 8 }}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingBottom: 40, backgroundColor: colors.bg },
  searchWrap: { paddingHorizontal: 20, marginBottom: 18 },
  sectionPad: { paddingHorizontal: 20, marginTop: 28, gap: 14 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: "600" },
  muted: { color: colors.textMuted, lineHeight: 21 },
});
