import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../src/auth";
import { API_BASE_URL } from "../../src/config";
import { colors } from "../../src/theme";

type SavedEvent = {
  id: string;
  event_id: string;
  events: {
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
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const [message, setMessage] = useState("Loading your saved experiences…");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setMessage("Loading your saved experiences…");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.is_anonymous || !(session.user.email_confirmed_at || session.user.phone_confirmed_at)) {
      setSaved([]);
      setMessage("Sign in to save experiences and keep them for your journey.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/account/saved`, {
        headers: { accept: "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
      setSaved(Array.isArray(body.saved) ? body.saved : []);
      setMessage(body.saved?.length ? "" : "Nothing saved yet. Explore SafariPlug and keep the experiences that catch your eye.");
    } catch (error) {
      setSaved([]);
      setMessage(error instanceof Error ? error.message : "Unable to load your saved experiences.");
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function refresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Text style={styles.kicker}>Your collection</Text>
        <Text style={styles.title}>Saved Experiences</Text>
        <Text style={styles.lede}>Keep the places and experiences that catch your eye, then return when you are ready to build your journey.</Text>

        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}

        {saved.map((item) => {
          const event = item.events;
          if (!event) return null;
          const location = event.venue_name || event.cities?.name || event.cities?.country || "East Africa";
          const date = event.start_at ? new Date(event.start_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.category}>{event.category || "Experience"}</Text>
              <Text style={styles.cardTitle}>{event.title}</Text>
              {event.description ? <Text style={styles.description} numberOfLines={2}>{event.description}</Text> : null}
              <Text style={styles.meta}>📍 {location}</Text>
              {date ? <Text style={styles.meta}>📅 {date}</Text> : null}
            </View>
          );
        })}

        {!saved.length && message.includes("Nothing saved") ? (
          <Text style={styles.link} onPress={() => router.push("/(tabs)/explore")}>Start discovering →</Text>
        ) : null}
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
  message: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 16 },
  messageText: { color: colors.textMuted, lineHeight: 21 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 18, gap: 7 },
  category: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  description: { color: colors.textMuted, lineHeight: 20 },
  meta: { color: colors.textMuted, fontSize: 13 },
  link: { color: colors.gold, fontWeight: "800", paddingVertical: 8 },
});
