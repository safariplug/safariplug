import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ color: focused ? colors.goldSoft : colors.textMuted, fontSize: 13, fontWeight: "800" }}>
      {glyph}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", paddingBottom: 8 },
        tabBarActiveTintColor: colors.goldSoft,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ focused }) => <TabIcon glyph="◆" focused={focused} /> }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} /> }} />
      <Tabs.Screen name="concierge" options={{ title: "Concierge", tabBarIcon: ({ focused }) => <TabIcon glyph="✦" focused={focused} /> }} />
      <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: ({ focused }) => <TabIcon glyph="▤" focused={focused} /> }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: ({ focused }) => <TabIcon glyph="◇" focused={focused} /> }} />
      <Tabs.Screen name="you" options={{ title: "You", tabBarIcon: ({ focused }) => <TabIcon glyph="●" focused={focused} /> }} />
    </Tabs>
  );
}
