import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../src/auth";
import { colors } from "../../src/theme";

export default function YouScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setEmail(data.session?.user.email ?? null); setLoading(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setEmail(session?.user.email ?? null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>You</Text>
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{email ? email.slice(0, 2).toUpperCase() : "SP"}</Text></View>
          <View style={{ flex: 1 }}>
            {loading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.name}>{email ? "Your SafariPlug account" : "Guest"}</Text>}
            <Text style={styles.meta}>{email || "Sign in to keep trips, saved experiences and bookings together."}</Text>
          </View>
        </View>
        <Pressable style={styles.row} onPress={() => router.push("/(tabs)/trips" as never)}><Text style={styles.rowLabel}>My Trips</Text><Text style={styles.rowHint}>Your SafariPlug itineraries</Text></Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/(tabs)/saved" as never)}><Text style={styles.rowLabel}>Saved</Text><Text style={styles.rowHint}>Experiences you want to remember</Text></Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/(tabs)/trips" as never)}><Text style={styles.rowLabel}>Bookings</Text><Text style={styles.rowHint}>View your booking history</Text></Pressable>
        {!email ? (
          <Pressable style={styles.primary} onPress={() => router.push("/auth" as never)}><Text style={styles.primaryText}>Sign in or create account</Text></Pressable>
        ) : (
          <Pressable style={styles.signOut} onPress={() => void signOut()}><Text style={styles.signOutText}>Sign out</Text></Pressable>
        )}
        <View style={styles.info}><Text style={styles.infoTitle}>SafariPlug</Text><Text style={styles.infoBody}>Discover. Plan. Experience Africa.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, page: { padding: 20, paddingBottom: 48, gap: 10 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" },
  identity: { flexDirection: "row", gap: 14, alignItems: "center", marginVertical: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#3A2416", borderWidth: 1, borderColor: colors.gold },
  avatarText: { color: colors.sand, fontWeight: "800" }, name: { color: colors.text, fontSize: 21, fontWeight: "700" }, meta: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  row: { borderRadius: 18, padding: 16, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }, rowLabel: { color: colors.text, fontSize: 16, fontWeight: "700" }, rowHint: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  primary: { height: 54, borderRadius: 16, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 8 }, primaryText: { color: colors.bg, fontWeight: "800" },
  signOut: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 8 }, signOutText: { color: colors.text, fontWeight: "700" },
  info: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: colors.bgCard }, infoTitle: { color: colors.text, fontWeight: "800" }, infoBody: { color: colors.textMuted, marginTop: 4 },
});
