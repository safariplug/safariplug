import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { EventImage } from "./EventImage";

export function HeroSection({
  imageUrl,
  kicker = "SafariPlug",
  title,
  body,
  onPress,
}: {
  imageUrl: string | null;
  kicker?: string;
  title: string;
  body: string;
  onPress?: () => void;
}) {
  const inner = (
    <View style={styles.hero}>
      <EventImage uri={imageUrl} style={styles.image} />
      <View style={styles.veil} />
      <View style={styles.copy}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 360,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: colors.forest,
    marginHorizontal: 20,
  },
  image: { ...StyleSheet.absoluteFillObject },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,9,7,0.42)",
  },
  copy: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 24,
    gap: 8,
  },
  kicker: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "600",
    lineHeight: 40,
  },
  body: { color: colors.sand, fontSize: 15, lineHeight: 22 },
});
