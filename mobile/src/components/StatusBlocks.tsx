import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function LoadingBlock({ label = "Loading SafariPlug…" }: { label?: string }) {
  return (
    <View style={styles.block}>
      <ActivityIndicator color={colors.gold} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>Couldn’t load catalog</Text>
      <Text style={styles.muted}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" },
  muted: { color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  retry: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryLabel: { color: colors.goldSoft, fontWeight: "800" },
});
