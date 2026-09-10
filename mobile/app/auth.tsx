import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase, hasMobileSupabaseConfig } from "../src/auth";
import { colors } from "../src/theme";

export default function AuthScreen() {
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/(tabs)";
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) router.replace(next as never);
    });
    return () => { active = false; };
  }, [next]);

  async function submit() {
    if (!email.trim() || password.length < 6 || busy) return;
    setBusy(true);
    setMessage("");
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then return to SafariPlug and sign in.");
      return;
    }
    router.replace(next as never);
  }

  if (!hasMobileSupabaseConfig()) {
    return <SafeAreaView style={styles.safe}><View style={styles.page}><Text style={styles.kicker}>SafariPlug</Text><Text style={styles.title}>Account setup needed</Text><Text style={styles.body}>The mobile app needs its public Supabase configuration before sign-in can be enabled.</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <Text style={styles.kicker}>SafariPlug</Text>
        <Text style={styles.title}>{mode === "sign-in" ? "Welcome back." : "Create your account."}</Text>
        <Text style={styles.body}>{mode === "sign-in" ? "Sign in to use Concierge, manage bookings and keep your trips together." : "Create a free SafariPlug account to unlock Concierge and booking."}</Text>
        <View style={styles.form}>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.textMuted} style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={colors.textMuted} style={styles.input} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable onPress={() => void submit()} disabled={busy || !email.trim() || password.length < 6} style={[styles.button, (busy || !email.trim() || password.length < 6) && styles.disabled]}>
            {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{mode === "sign-in" ? "Sign in" : "Create account"}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMessage(""); setMode(mode === "sign-in" ? "sign-up" : "sign-in"); }}>
            <Text style={styles.switch}>{mode === "sign-in" ? "New to SafariPlug? Create an account" : "Already have an account? Sign in"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1, padding: 24, justifyContent: "center", gap: 14 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 2.5, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 38, lineHeight: 43, fontWeight: "700" },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  form: { gap: 12 },
  input: { height: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.text, paddingHorizontal: 16, fontSize: 15 },
  button: { height: 56, borderRadius: 16, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  message: { color: colors.goldSoft, fontSize: 12, lineHeight: 18 },
  switch: { color: colors.goldSoft, fontSize: 13, fontWeight: "700", textAlign: "center", paddingVertical: 8 },
});
