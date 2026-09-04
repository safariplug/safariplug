import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

export function TripCard({
  title,
  body,
  onPress,
}: {
  title: string;
  body: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
    >
      <Text style={styles.kicker}>Trip</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  pressed: { opacity: 0.9 },
  kicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "600" },
  body: { color: colors.textMuted, lineHeight: 21 },
});
