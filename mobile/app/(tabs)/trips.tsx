import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { apiGet } from "../../src/api/client";
import { fetchBookings } from "../../src/api/inventory";
import { ComingSoonCard } from "../../src/components/ComingSoonCard";
import { StoryCta } from "../../src/components/StoryCta";
import { colors } from "../../src/theme";

type Trip = { id: string; title: string | null; start_on: string | null; end_on: string | null; status: string; destination_city_id: string | null };

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [note, setNote] = useState("Checking your trips…");

  const load = useCallback(async () => {
    try {
      const [tripResult, bookings] = await Promise.all([apiGet<Trip[]>("/trips", { page: 1, limit: 20 }, true), fetchBookings()]);
      if (tripResult.data) setTrips(Array.isArray(tripResult.data) ? tripResult.data : []);
      if (tripResult.data?.length) setNote(`You have ${tripResult.data.length} trip${tripResult.data.length === 1 ? "" : "s"} on SafariPlug.`);
      else if (bookings.status === "unauthorized") setNote("Sign in on SafariPlug to keep trips across devices.");
      else setNote("No trips yet. Start building your journey with SafariPlug.");
    } catch {
      setNote("Unable to load your trips right now.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.kicker}>My trips</Text><Text style={styles.title}>Build the journey</Text>
    <Text style={styles.lede}>Put your hotel, airport transfer, food, experiences, appointments, drivers and events into one journey.</Text>
    <Pressable style={styles.planButton} onPress={() => void Linking.openURL("https://safariplug.com/plan")}><Text style={styles.planButtonText}>Plan a new trip →</Text></Pressable>
    {trips.map((trip) => <Pressable key={trip.id} style={styles.tripCard} onPress={() => router.push({ pathname: "/trip/[tripId]", params: { tripId: trip.id } })}>
      <Text style={styles.tripKicker}>Journey</Text><Text style={styles.tripTitle}>{trip.title || "Untitled trip"}</Text>
      <Text style={styles.tripMeta}>{trip.start_on || "Flexible start"} · {trip.end_on || "Flexible end"}</Text>
      <Text style={styles.tripOpen}>Open itinerary →</Text>
    </Pressable>)}
    {!trips.length ? <ViewNote text={note} /> : null}
    <ComingSoonCard title="Live booking stays honest" body="SafariPlug only confirms a booking when real supplier inventory and payment are connected." />
    <StoryCta kicker="Discover" title="Start from a destination" body="Pick a place, then add stays, events and experiences to your journey." action="Explore destinations →" onPress={() => router.push("/(tabs)/explore")} />
  </ScrollView></SafeAreaView>;
}

function ViewNote({ text }: { text: string }) { return <Text style={styles.note}>{text}</Text>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, page: { padding: 20, paddingBottom: 48, gap: 16 }, kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" }, title: { color: colors.text, fontSize: 32, fontWeight: "600" }, lede: { color: colors.textMuted, lineHeight: 22 }, planButton: { borderRadius: 18, backgroundColor: colors.gold, paddingVertical: 15, paddingHorizontal: 18, alignItems: "center" }, planButtonText: { color: "#070708", fontWeight: "800", fontSize: 15 }, tripCard: { borderRadius: 22, padding: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, gap: 7 }, tripKicker: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2.2, textTransform: "uppercase" }, tripTitle: { color: colors.text, fontSize: 20, fontWeight: "700" }, tripMeta: { color: colors.textMuted, fontSize: 13 }, tripOpen: { color: colors.goldSoft, fontWeight: "700", marginTop: 4 }, note: { color: colors.textMuted, paddingVertical: 8 } });
