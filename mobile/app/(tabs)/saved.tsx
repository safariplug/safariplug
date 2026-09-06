import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../src/auth";
import { API_BASE_URL } from "../../src/config";
import { colors } from "../../src/theme";

type SavedExperience = {
  id: string;
  event_id: string;
  events?: {
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    venue_name?: string | null;
    start_at?: string | null;
    cities?: { name?: string | null; country?: string | null } | null;
  } | null;
};

export default function SavedScreen() {
  const [saved, setSaved] = useState<SavedExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSaved([]);
        setMessage("Sign in to keep your saved experiences across devices.");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/account/saved`, {
        headers: { accept: "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setSaved([]);
        setMessage("Sign in to keep your saved experiences across devices.");
        return;
      }
      if (!response.ok) throw new Error(body.error || "Unable to load saved experiences.");
      setSaved(Array.isArray(body.saved) ? body.saved : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load saved experiences.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.gold} />}
      >
        <Text style={styles.kicker}>Saved</Text>
        <Text style={styles.title}>Keep what moves you</Text>
        <Text style={styles.lede}>Your saved SafariPlug experiences, ready when you are.</Text>

        {loading ? <Text style={styles.muted}>Loading your saves…</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {!loading && !message && saved.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.muted}>Tap Save on an experience you want to come back to.</Text>
            <Pressable onPress={() => router.push("/(tabs)")} style={styles.button}>
              <Text style={styles.buttonText}>Discover experiences</Text>
            </Pressable>
          </View>
        ) : null}

        {saved.map((item) => {
          const event = item.events;
          if (!event) return null;
          return (
            <Pressable key={item.id} onPress={() => router.push(`/event/${event.id}`)} style={styles.card}>
              <Text style={styles.category}>{event.category || "Experience"}</Text>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.meta}>
                {[event.cities?.name, event.venue_name].filter(Boolean).join(" · ") || "SafariPlug"}
              </Text>
              {event.start_at ? <Text style={styles.date}>{new Date(event.start_at).toLocaleDateString()}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 32, fontWeight: "600" },
  lede: { color: colors.textMuted, lineHeight: 22 },
  muted: { color: colors.textMuted, lineHeight: 21 },
  message: { color: colors.goldSoft, lineHeight: 21 },
  empty: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20, gap: 12, backgroundColor: colors.bgCard },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "700" },
  button: { alignSelf: "flex-start", borderRadius: 14, backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 12 },
  buttonText: { color: colors.bg, fontWeight: "800" },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, backgroundColor: colors.bgCard, gap: 7 },
  category: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: "700", lineHeight: 25 },
  meta: { color: colors.textMuted, fontSize: 13 },
  date: { color: colors.goldSoft, fontSize: 12, fontWeight: "700" },
});
