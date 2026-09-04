import { StyleSheet, Text } from "react-native";
import { colors } from "../theme";
import { formatPrice } from "../utils/format";

export function PriceLabel({
  price,
  currency,
}: {
  price: number | null;
  currency: string | null;
}) {
  const label = formatPrice(price, currency);
  const tba = label === "Price TBA";
  return (
    <Text style={[styles.price, tba && styles.tba]} accessibilityLabel={label}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  price: {
    color: colors.goldSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  tba: {
    color: colors.textMuted,
    fontWeight: "600",
  },
});
