import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { API_BASE_URL } from "../../src/config";
import { ApiError } from "../../src/api/client";
import { ErrorBlock, LoadingBlock } from "../../src/components/StatusBlocks";
import { colors } from "../../src/theme";

type Value = { id: string; name: string; price_delta: number; active: boolean };
type Option = { id: string; name: string; required: boolean; active: boolean; restaurant_menu_item_option_values: Value[] };
type Item = { id: string; name: string; description?: string | null; image_url?: string | null; price: number; currency: string; restaurant_menu_item_options?: Option[] };
type Category = { id: string; name: string; description?: string | null; items: Item[] };
type Menu = { settings: { ordering_enabled: boolean; pickup_enabled: boolean; minimum_order_amount: number; preparation_time_minutes: number } | null; categories: Category[] };

export default function RestaurantScreen() {
  const { businessId, name } = useLocalSearchParams<{ businessId: string; name?: string }>();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId) return;
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/restaurants/${encodeURIComponent(businessId)}/menu`);
      const data = await response.json();
      if (!response.ok) throw new ApiError(response.status, "menu_error", data?.error || "Unable to load this menu.");
      setMenu(data as Menu);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load this menu.");
    } finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ title: typeof name === "string" ? name : "Restaurant" }} />
      <ScrollView contentContainerStyle={styles.page}>
        {loading ? <LoadingBlock label="Loading menu…" /> : error ? <ErrorBlock message={error} onRetry={() => void load()} /> : !menu?.settings?.ordering_enabled ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Ordering is not currently available</Text><Text style={styles.emptyBody}>This restaurant has not enabled online ordering.</Text></View>
        ) : (
          <>
            <View style={styles.hero}><Text style={styles.kicker}>SafariPlug Food</Text><Text style={styles.title}>{typeof name === "string" ? name : "Restaurant"}</Text><Text style={styles.heroBody}>Real menu items, current prices and restaurant-controlled availability.</Text></View>
            {menu.categories.map((category) => <View key={category.id} style={styles.section}><Text style={styles.sectionTitle}>{category.name}</Text>{category.description ? <Text style={styles.sectionBody}>{category.description}</Text> : null}{category.items.map((item) => <View key={item.id} style={styles.item}><View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.name}</Text>{item.description ? <Text style={styles.itemBody}>{item.description}</Text> : null}<Text style={styles.price}>{item.currency} {Number(item.price).toLocaleString()}</Text></View><Pressable style={styles.add} onPress={() => router.push({ pathname: "/ask", params: { request: `I want to order ${item.name} from ${typeof name === "string" ? name : "this restaurant"}.` } })}><Text style={styles.addText}>Ask to order</Text></Pressable></View>)}</View>)}
            <View style={styles.notice}><Text style={styles.noticeTitle}>Native menu is connected</Text><Text style={styles.noticeBody}>The same restaurant-controlled menu and availability rules used by SafariPlug ordering are now visible in the mobile app.</Text></View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, page: { padding: 20, gap: 16, paddingBottom: 48 }, hero: { borderRadius: 26, backgroundColor: colors.forest, padding: 22, gap: 7 }, kicker: { color: colors.goldSoft, fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" }, title: { color: colors.text, fontSize: 30, fontWeight: "700" }, heroBody: { color: colors.sand, lineHeight: 21 }, section: { gap: 10 }, sectionTitle: { color: colors.text, fontSize: 23, fontWeight: "700" }, sectionBody: { color: colors.textMuted, lineHeight: 20 }, item: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 16, gap: 12 }, itemCopy: { gap: 5 }, itemTitle: { color: colors.text, fontSize: 18, fontWeight: "700" }, itemBody: { color: colors.textMuted, lineHeight: 19 }, price: { color: colors.goldSoft, fontWeight: "800", marginTop: 3 }, add: { alignSelf: "flex-start", borderRadius: 13, backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 10 }, addText: { color: colors.bg, fontWeight: "800", fontSize: 12 }, notice: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 6 }, noticeTitle: { color: colors.text, fontSize: 17, fontWeight: "700" }, noticeBody: { color: colors.textMuted, lineHeight: 20 }, empty: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 7 }, emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "700" }, emptyBody: { color: colors.textMuted, lineHeight: 21 },
});
