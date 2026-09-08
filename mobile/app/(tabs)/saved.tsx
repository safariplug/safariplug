import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { colors } from "../../src/theme";

export default function SavedScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>Saved</Text>
        <Text style={styles.title}>Keep what moves you</Text>
        <Text style={styles.lede}>
          Events, experiences, stays, destinations and tables — when syncing exists, they will live here.
        </Text>
        <ComingSoonCard
          title="Nothing saved yet"
          body="Saves are not synced to SafariPlug in this release. This screen will not invent a wishlist."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 32, fontWeight: "600" },
  lede: { color: colors.textMuted, lineHeight: 22 },
});
