import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function SearchBar({
  placeholder = "Where do you want to go?",
  onPress,
}: {
  placeholder?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Search SafariPlug"
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={styles.glyph}>
        <Text style={styles.glyphText}>⌕</Text>
      </View>
      <Text style={styles.placeholder}>{placeholder}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.88 },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,165,116,0.14)",
  },
  glyphText: { color: colors.goldSoft, fontSize: 16, fontWeight: "700" },
  placeholder: { color: colors.textMuted, fontSize: 16, flex: 1 },
});
