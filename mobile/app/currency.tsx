import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "../src/theme";
import { DISPLAY_CURRENCIES, useFx, type DisplayCurrency } from "../src/fx";

export default function CurrencyScreen() {
  const { currency, setCurrency, updatedAt, loading, error } = useFx();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>Display currency</Text>
        <Text style={styles.body}>
          SafariPlug keeps the original booking currency authoritative. This setting only converts prices for display.
        </Text>
        <View style={styles.status}>
          <Text style={styles.statusTitle}>{loading ? "Updating live rates…" : error ? "Live rates unavailable" : "Live FX active"}</Text>
          <Text style={styles.statusText}>
            {updatedAt ? `Rates updated ${new Date(updatedAt).toLocaleString()}` : error || "Connecting to live rates…"}
          </Text>
        </View>
        {DISPLAY_CURRENCIES.map((code) => {
          const selected = code === currency;
          return (
            <Pressable
              key={code}
              onPress={() => {
                setCurrency(code as DisplayCurrency);
                router.back();
              }}
              style={[styles.row, selected && styles.selected]}
            >
              <Text style={styles.code}>{code}</Text>
              <Text style={styles.check}>{selected ? "✓" : ""}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", marginBottom: 4 },
  body: { color: colors.textMuted, lineHeight: 21, marginBottom: 8 },
  status: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 4 },
  statusTitle: { color: colors.goldSoft, fontWeight: "800", fontSize: 15 },
  statusText: { color: colors.textMuted, marginTop: 5, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 17 },
  selected: { borderColor: colors.gold },
  code: { color: colors.text, fontSize: 16, fontWeight: "700" },
  check: { color: colors.goldSoft, fontSize: 18, fontWeight: "800" },
});
