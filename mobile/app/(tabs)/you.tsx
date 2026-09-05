import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "../../src/theme";

const ROWS: { label: string; hint: string; href?: string }[] = [
  { label: "My Trips", hint: "Itineraries when you are signed in", href: "/(tabs)/trips" },
  { label: "Saved", hint: "Local architecture only", href: "/(tabs)/saved" },
  { label: "Bookings", hint: "Confirmation is not live", href: "/(tabs)/trips" },
  { label: "Preferences", hint: "Coming with accounts" },
  { label: "Currency", hint: "Display KES — not a live FX engine" },
  { label: "Language", hint: "English" },
  { label: "Notifications", hint: "No alerts yet" },
  { label: "Help", hint: "safariplug.com" },
  { label: "About SafariPlug", hint: "Discover. Plan. Experience Africa." },
];

export default function YouScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>You</Text>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>SP</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>Guest</Text>
            <Text style={styles.meta}>
              Sign-in will use SafariPlug accounts. This app does not store server secrets.
            </Text>
          </View>
        </View>
        {ROWS.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.href ? () => router.push(row.href as never) : undefined}
            disabled={!row.href}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowHint}>{row.hint}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 10 },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  identity: { flexDirection: "row", gap: 14, alignItems: "center", marginVertical: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A2416",
    borderWidth: 1,
    borderColor: colors.gold,
  },
  avatarText: { color: colors.sand, fontWeight: "800" },
  name: { color: colors.text, fontSize: 24, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  row: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
  rowHint: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
});
