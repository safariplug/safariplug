import { useCallback, useEffect, useState } from "react";
import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { apiGet, ApiError } from "../src/api/client";
import { ErrorBlock, LoadingBlock } from "../src/components/StatusBlocks";
import { colors } from "../src/theme";

type Restaurant = { id: string; name: string; slug: string; description?: string | null; city_id?: string | null };

export default function RestaurantsScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await apiGet<Restaurant[]>("/restaurants");
      setRestaurants(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load restaurants.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={styles.kicker}>Food & drink</Text>
        <Text style={styles.title}>Order from real restaurants</Text>
        <Text style={styles.lede}>Menus come directly from restaurants that have SafariPlug ordering enabled. No invented menus or availability.</Text>
        {loading ? <LoadingBlock label="Loading restaurants…" /> : error ? <ErrorBlock message={error} onRetry={() => void load()} /> : restaurants.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No restaurants are live yet</Text><Text style={styles.emptyBody}>SafariPlug will show restaurants only after their ordering setup is active.</Text></View>
        ) : restaurants.map((restaurant) => (
          <Pressable key={restaurant.id} style={styles.card} onPress={() => router.push({ pathname: "/restaurant/[businessId]", params: { businessId: restaurant.id, name: restaurant.name } })}>
            <View style={styles.badge}><Text style={styles.badgeText}>ORDERING LIVE</Text></View>
            <Text style={styles.cardTitle}>{restaurant.name}</Text>
            {restaurant.description ? <Text style={styles.cardBody}>{restaurant.description}</Text> : null}
            <Text style={styles.cta}>View menu →</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, gap: 14, paddingBottom: 48 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", lineHeight: 36 },
  lede: { color: colors.textMuted, lineHeight: 22, marginBottom: 4 },
  card: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 18, gap: 9 },
  badge: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: colors.forest, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: colors.goldSoft, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  cardTitle: { color: colors.text, fontSize: 21, fontWeight: "700" },
  cardBody: { color: colors.textMuted, lineHeight: 20 },
  cta: { color: colors.goldSoft, fontWeight: "800", marginTop: 3 },
  empty: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 7 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "700" },
  emptyBody: { color: colors.textMuted, lineHeight: 21 },
});
