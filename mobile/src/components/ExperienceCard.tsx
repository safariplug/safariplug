import { Pressable, StyleSheet, Text } from "react-native";
import type { CatalogExperienceCollection } from "../models/event";
import { colors } from "../theme";

export function ExperienceCard({
  collection,
  onPress,
}: {
  collection: CatalogExperienceCollection;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
    >
      <Text style={styles.kicker}>Experience</Text>
      <Text style={styles.title}>{collection.name}</Text>
      {collection.description ? (
        <Text style={styles.body} numberOfLines={3}>
          {collection.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    minHeight: 160,
    marginRight: 12,
    borderRadius: 24,
    padding: 18,
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
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "600" },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
