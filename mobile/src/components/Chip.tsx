import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  selected: {
    borderColor: colors.gold,
    backgroundColor: "rgba(201,168,106,0.14)",
  },
  label: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  labelSelected: { color: colors.goldSoft },
});
