import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

export function LoadingSkeleton({ height = 160 }: { height?: number }) {
  return <View style={[styles.block, { height }]} />;
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 22,
    backgroundColor: "#1C1712",
    marginBottom: 14,
  },
});
