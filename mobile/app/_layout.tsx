import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../src/theme";

export default function RootLayout() {
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
        <Stack.Screen name="concierge" options={{ title: "Concierge" }} />
      </Stack>
    </>
  );
}
