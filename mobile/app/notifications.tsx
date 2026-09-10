import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { supabase } from "../src/auth";
import { API_BASE_URL } from "../src/config";

type NotificationItem = {
  id: string;
  appointment_id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  read_at: string | null;
  created_at: string;
};

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || session.user.is_anonymous) {
        setError("Sign in to see your SafariPlug notifications.");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/account/notifications`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Unable to load notifications.");
      setItems(json.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user || session.user.is_anonymous) return;

      channel = supabase
        .channel(`service-appointment-notifications:${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "service_appointment_notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            const notification = payload.new as NotificationItem;
            setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 100));
          },
        )
        .subscribe();
    }

    subscribe();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function markRead(item?: NotificationItem) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(`${API_BASE_URL}/api/account/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(item ? { id: item.id } : {}),
    });
    if (item) setItems((current) => current.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));
    else setItems((current) => current.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>SafariPlug</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You’re all caught up"}</Text>
          </View>
          {unread > 0 && <Pressable onPress={() => markRead()} style={styles.readAll}><Text style={styles.readAllText}>Mark all read</Text></Pressable>}
        </View>

        {loading ? <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Loading your updates…</Text></View> : error ? (
          <View style={styles.card}><Text style={styles.cardTitle}>Notifications unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => load()} style={styles.primary}><Text style={styles.primaryText}>Try again</Text></Pressable></View>
        ) : items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.cardTitle}>Nothing new</Text><Text style={styles.muted}>Appointment confirmations, changes and completion updates will appear here.</Text><Pressable onPress={() => router.push("/(tabs)/trips" as never)} style={styles.primary}><Text style={styles.primaryText}>View my trips</Text></Pressable></View>
        ) : items.map((item) => (
          <Pressable key={item.id} onPress={() => markRead(item)} style={[styles.card, !item.read_at && styles.unreadCard]}>
            <View style={styles.cardTop}><View style={[styles.dot, !item.read_at && styles.unreadDot]} /><Text style={styles.time}>{relativeTime(item.created_at)}</Text></View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.appointment}>Appointment update · {item.status.replaceAll("_", " ")}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12 },
  kicker: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2.5, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 32, fontWeight: "800", marginTop: 4 },
  subtitle: { color: colors.textMuted, marginTop: 5 },
  readAll: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  readAllText: { color: colors.goldSoft, fontSize: 12, fontWeight: "700" },
  card: { borderRadius: 20, padding: 17, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  unreadCard: { borderColor: colors.gold, borderWidth: 1.5 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted },
  unreadDot: { backgroundColor: colors.gold },
  time: { color: colors.textMuted, fontSize: 11 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "750", marginTop: 11 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  appointment: { color: colors.goldSoft, fontSize: 11, fontWeight: "700", marginTop: 12, textTransform: "capitalize" },
  center: { paddingVertical: 80, alignItems: "center", gap: 12 },
  empty: { marginTop: 30, padding: 28, borderRadius: 24, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyIcon: { color: colors.gold, fontSize: 30 },
  muted: { color: colors.textMuted, lineHeight: 20, marginTop: 6 },
  primary: { marginTop: 18, backgroundColor: colors.gold, borderRadius: 13, paddingHorizontal: 17, paddingVertical: 12 },
  primaryText: { color: "#1a1008", fontWeight: "800" },
});
