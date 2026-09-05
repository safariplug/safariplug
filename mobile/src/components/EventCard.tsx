import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CatalogEvent } from "../models/event";
import { colors } from "../theme";
import { cityLabel, formatEventWhen, venueLine } from "../utils/format";
import { EventImage } from "./EventImage";
import { PriceLabel } from "./PriceLabel";

export function EventCard({
  event,
  onPress,
  compact = false,
}: {
  event: CatalogEvent;
  onPress: () => void;
  compact?: boolean;
}) {
  const when = formatEventWhen(event.start_at, event.end_at);
  const venue = venueLine(event);
  const city = cityLabel(event);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={event.title}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        pressed && styles.pressed,
      ]}
    >
      <EventImage uri={event.image_url} style={compact ? styles.compactImage : styles.image} />
      <View style={styles.body}>
        <Text style={styles.kicker}>
          {[city, event.category].filter(Boolean).join(" · ") || "Event"}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {when ? <Text style={styles.meta}>{when}</Text> : null}
        {venue ? (
          <Text style={styles.meta} numberOfLines={1}>
            {venue}
          </Text>
        ) : null}
        <PriceLabel price={event.price} currency={event.currency} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 16,
  },
  compact: {
    width: 260,
    marginRight: 12,
    marginBottom: 0,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  image: { height: 210, width: "100%" },
  compactImage: { height: 150, width: "100%" },
  body: { padding: 16, gap: 6 },
  kicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  },
  meta: { color: colors.textMuted, fontSize: 13 },
});
