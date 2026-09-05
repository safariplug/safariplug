import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ComingSoonCard } from "../src/components/ComingSoonCard";
import { colors } from "../src/theme";

const PROMPTS = [
  "Plan me 4 days in Watamu.",
  "Find a hotel near the beach.",
  "What is happening in Nairobi this weekend?",
  "Build me a Zanzibar trip.",
];

export default function AskScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>Ask SafariPlug AI</Text>
        <Text style={styles.title}>What are you looking for?</Text>
        <Text style={styles.lede}>
          The agent will only use controlled SafariPlug tools. It will not invent prices, availability, bookings or reviews.
        </Text>
        <TextInput
          editable={false}
          placeholder="The travel agent is not connected yet"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <ComingSoonCard
          title="AI tools are not live"
          body="This is the experience shell. When backend tools exist, prompts like these will run against real catalog and inventory APIs."
        />
        <View style={{ gap: 10, marginTop: 8 }}>
          {PROMPTS.map((prompt) => (
            <View key={prompt} style={styles.prompt}>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, gap: 14, paddingBottom: 48 },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 32, fontWeight: "600", lineHeight: 38 },
  lede: { color: colors.textMuted, lineHeight: 22 },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  prompt: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptText: { color: colors.sand, fontSize: 14 },
});
