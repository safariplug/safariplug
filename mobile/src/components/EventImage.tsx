import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme";

type Props = {
  uri: string | null;
  style?: StyleProp<ViewStyle>;
};

export function EventImage({ uri, style }: Props) {
  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderKicker}>SafariPlug</Text>
          <Text style={styles.placeholderLabel}>Image coming soon</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: "#151316",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#151316",
  },
  placeholderKicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  placeholderLabel: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 13,
  },
});
