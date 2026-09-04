import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function ComingSoonCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Coming soon</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  kicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "600", lineHeight: 28 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
});
