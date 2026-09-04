import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function HorizontalRail({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
  head: {
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "600" },
  action: { color: colors.goldSoft, fontSize: 13, fontWeight: "700" },
  row: { paddingHorizontal: 20, paddingRight: 28 },
});
