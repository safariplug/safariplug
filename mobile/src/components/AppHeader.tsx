import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function AppHeader({
  location = "Exploring Africa",
  onSearch,
  onProfile,
}: {
  location?: string;
  onSearch: () => void;
  onProfile: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>SafariPlug</Text>
        <Text style={styles.location}>📍 {location}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={styles.iconBtn}
        >
          <Text style={styles.icon}>⌕</Text>
        </Pressable>
        <Pressable
          onPress={onProfile}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>SP</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { gap: 4, flex: 1 },
  wordmark: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  location: { color: colors.goldSoft, fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { color: colors.goldSoft, fontSize: 18, fontWeight: "700" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A2416",
    borderWidth: 1,
    borderColor: colors.gold,
  },
  avatarText: { color: colors.sand, fontSize: 11, fontWeight: "800" },
});
