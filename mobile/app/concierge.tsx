import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../src/config";
import { colors } from "../src/theme";

type Message = { role: "user" | "assistant"; content: string };
type Card = {
  provider?: string;
  service?: string;
  cityName?: string | null;
  price?: number;
  currency?: string;
  slots?: { label?: string }[];
};

const SUGGESTIONS = [
  "Find me a great barber in Nairobi this Saturday afternoon",
  "I need a relaxing massage in Nairobi tomorrow after 5 PM",
  "Find a manicure under KES 2,500 this weekend",
];

export default function ConciergeScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(value = text) {
    const content = value.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/concierge`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (body?.error === "registered_client_required") {
          setMessages([
            ...next,
            {
              role: "assistant",
              content: "Concierge is reserved for registered SafariPlug clients. Sign in or create a free account on SafariPlug to continue.",
            },
          ]);
        } else {
          throw new Error(body?.message || body?.error || "Concierge is temporarily unavailable.");
        }
        setCards([]);
        return;
      }
      setMessages([...next, { role: "assistant", content: body?.message || "I found some options for you." }]);
      setCards(Array.isArray(body?.cards) ? body.cards : []);
    } catch (error) {
      setMessages([
        ...next,
        { role: "assistant", content: error instanceof Error ? error.message : "Unable to reach SafariPlug." },
      ]);
      setCards([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.mark}><Text style={styles.markText}>✦</Text></View>
            <Text style={styles.kicker}>SafariPlug Intelligence</Text>
            <Text style={styles.title}>Tell us what you need.</Text>
            <Text style={styles.lede}>We’ll find real providers, check live appointment times, and help arrange the booking.</Text>
          </View>

          {!messages.length ? (
            <View style={styles.suggestions}>
              <Text style={styles.sectionLabel}>Try asking</Text>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => void send(suggestion)} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                  <Text style={styles.arrow}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.chat}>
            {messages.map((message, index) => (
              <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, message.role === "user" && styles.userText]}>{message.content}</Text>
              </View>
            ))}
            {busy ? (
              <View style={styles.loadingRow}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Checking SafariPlug…</Text></View>
            ) : null}
            {cards.map((card, index) => (
              <View key={`${card.provider}-${card.service}-${index}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.provider}>{card.provider || "SafariPlug provider"}</Text>
                    <Text style={styles.service}>{card.service || "Service"}</Text>
                    <Text style={styles.muted}>{card.cityName || "Location available on request"}</Text>
                  </View>
                  {typeof card.price === "number" ? <Text style={styles.price}>{card.currency || "KES"} {card.price.toLocaleString()}</Text> : null}
                </View>
                {card.slots?.length ? <Text style={styles.live}>{card.slots.slice(0, 4).map((slot) => slot.label).filter(Boolean).join("  ·  ")}</Text> : <Text style={styles.muted}>No open times found for this request.</Text>}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              editable={!busy}
              multiline
              placeholder="e.g. Find me a barber in Westlands Saturday at 3pm…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              onSubmitEditing={() => void send()}
            />
            <Pressable onPress={() => void send()} disabled={!text.trim() || busy} style={[styles.send, (!text.trim() || busy) && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.sendText}>↑</Text>}
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>Live times are checked before they are presented. Selecting a time never books it.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  page: { padding: 20, paddingBottom: 24, gap: 24 },
  hero: { paddingTop: 12, gap: 10 },
  mark: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  markText: { color: colors.bg, fontSize: 22, fontWeight: "800" },
  kicker: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2.5, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 38, lineHeight: 43, fontWeight: "700", letterSpacing: -1 },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  suggestions: { gap: 10 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 2 },
  suggestion: { minHeight: 58, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  suggestionText: { color: colors.sand, flex: 1, fontSize: 13, lineHeight: 19 },
  arrow: { color: colors.gold, fontSize: 24 },
  chat: { gap: 12 },
  bubble: { maxWidth: "88%", paddingHorizontal: 15, paddingVertical: 12, borderRadius: 17 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.gold },
  aiBubble: { alignSelf: "flex-start", backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  userText: { color: colors.bg },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  card: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, gap: 10 },
  cardTop: { flexDirection: "row", gap: 12 },
  cardCopy: { flex: 1, gap: 3 },
  provider: { color: colors.text, fontSize: 16, fontWeight: "700" },
  service: { color: colors.goldSoft, fontSize: 13 },
  price: { color: colors.text, fontSize: 13, fontWeight: "700" },
  live: { color: colors.goldSoft, fontSize: 12, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 12 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  composer: { minHeight: 58, borderRadius: 19, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, paddingLeft: 15, paddingRight: 7, paddingVertical: 7, flexDirection: "row", alignItems: "center" },
  input: { flex: 1, color: colors.text, fontSize: 14, maxHeight: 90, paddingTop: 9, paddingBottom: 9 },
  send: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  sendText: { color: colors.bg, fontSize: 22, fontWeight: "800" },
  disabled: { opacity: 0.35 },
  disclaimer: { color: colors.textMuted, fontSize: 9, textAlign: "center", paddingHorizontal: 10, paddingTop: 5 },
});
