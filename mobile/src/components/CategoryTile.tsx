import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TravelCategory } from "../discover/categories";
import { colors } from "../theme";

export function CategoryTile({
  category,
  onPress,
}: {
  category: TravelCategory;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.label}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.markWrap}>
        <Text style={styles.mark}>{category.mark}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {category.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 108,
    minHeight: 108,
    marginRight: 10,
    borderRadius: 22,
    padding: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  markWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(196,92,38,0.22)",
  },
  mark: { color: colors.sand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
});
