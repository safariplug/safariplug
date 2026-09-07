import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { fetchBookings, fetchTrips } from "../../src/api/inventory";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { StoryCta } from "../../src/components/StoryCta";
import { TripCard } from "../../src/components/TripCard";
import { colors } from "../../src/theme";

export default function TripsScreen() {
  const [note, setNote] = useState("Checking your trips…");

  const load = useCallback(async () => {
    const [trips, bookings] = await Promise.all([fetchTrips(), fetchBookings()]);
    if (trips.status === "unauthorized" || bookings.status === "unauthorized") { setNote("Sign in on SafariPlug to keep trips across devices."); return; }
    if (trips.status === "available" && Array.isArray(trips.data) && trips.data.length) { setNote(`You have ${trips.data.length} trip${trips.data.length === 1 ? "" : "s"} on SafariPlug.`); return; }
    setNote("No trips yet. Start building your journey with SafariPlug.");
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>My trips</Text>
        <Text style={styles.title}>Build the journey</Text>
        <Text style={styles.lede}>Put your hotel, airport transfer, food, experiences, appointments, drivers and events into one journey.</Text>
        <Pressable style={styles.planButton} onPress={() => void Linking.openURL("https://safariplug.com/plan")}><Text style={styles.planButtonText}>Plan a new trip →</Text></Pressable>
        <TripCard title="Your itinerary" body={note} />
        <ComingSoonCard title="Live booking stays honest" body="SafariPlug only confirms a booking when real supplier inventory and payment are connected." />
        <StoryCta kicker="Discover" title="Start from a destination" body="Pick a place, then add stays, events and experiences to your journey." action="Explore destinations →" onPress={() => router.push("/(tabs)/explore")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 32, fontWeight: "600" },
  lede: { color: colors.textMuted, lineHeight: 22 },
  planButton: { borderRadius: 18, backgroundColor: colors.gold, paddingVertical: 15, paddingHorizontal: 18, alignItems: "center" },
  planButtonText: { color: "#070708", fontWeight: "800", fontSize: 15 },
});
