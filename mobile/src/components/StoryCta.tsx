import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function StoryCta({
  kicker,
  title,
  body,
  action,
  onPress,
}: {
  kicker: string;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Text style={styles.action}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#24170F",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  pressed: { opacity: 0.92 },
  copy: { gap: 8 },
  kicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 26, fontWeight: "600", lineHeight: 32 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  action: { color: colors.goldSoft, fontWeight: "800", fontSize: 13 },
});
