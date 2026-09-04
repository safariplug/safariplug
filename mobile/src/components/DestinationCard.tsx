import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CatalogDestination } from "../models/event";
import { colors } from "../theme";
import { EventImage } from "./EventImage";

export function DestinationCard({
  destination,
  imageUrl,
  onPress,
  wide,
}: {
  destination: CatalogDestination;
  imageUrl: string | null;
  onPress: () => void;
  wide?: boolean;
}) {
  const count =
    destination.event_count > 0
      ? `${destination.event_count} ${destination.event_count === 1 ? "event" : "events"} to discover`
      : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={destination.name}
      style={({ pressed }) => [styles.card, wide && styles.wide, pressed && styles.pressed]}
    >
      <EventImage uri={imageUrl} style={styles.image} />
      <View style={styles.overlay} />
      <View style={styles.body}>
        <Text style={styles.name}>{destination.name}</Text>
        {destination.country ? (
          <Text style={styles.meta}>{destination.country}</Text>
        ) : null}
        {count ? <Text style={styles.count}>{count}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    height: 280,
    marginRight: 12,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.bgCard,
  },
  wide: { width: "100%", marginRight: 0 },
  pressed: { opacity: 0.92 },
  image: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,9,7,0.28)",
  },
  body: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    gap: 4,
  },
  name: { color: colors.text, fontSize: 24, fontWeight: "700" },
  meta: { color: colors.sand, fontSize: 13 },
  count: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
