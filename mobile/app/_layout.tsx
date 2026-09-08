import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../src/theme";
import { useEffect } from "react";
import { registerForPushNotifications } from "../src/notifications";
import { supabase } from "../src/auth";

export default function RootLayout() {
  useEffect(() => {
    let active = true;
    const register = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active && session?.user && !session.user.is_anonymous) await registerForPushNotifications();
    };
    register().catch(() => undefined);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !session.user.is_anonymous) registerForPushNotifications().catch(() => undefined);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.goldSoft,
          headerTitleStyle: { color: colors.text, fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ title: "Search" }} />
        <Stack.Screen name="event/[id]" options={{ title: "Event" }} />
        <Stack.Screen name="destination/[slug]" options={{ title: "Destination" }} />
        <Stack.Screen name="category/[kind]" options={{ title: "SafariPlug" }} />
        <Stack.Screen name="ask" options={{ title: "Ask SafariPlug" }} />
      </Stack>
    </>
  );
}
