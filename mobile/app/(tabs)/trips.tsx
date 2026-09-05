import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
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
    if (trips.status === "unauthorized" || bookings.status === "unauthorized") {
      setNote("Sign in on SafariPlug to keep trips across devices. Nothing is invented here.");
      return;
    }
    if (trips.status === "available" && Array.isArray(trips.data) && trips.data.length) {
      setNote(`You have ${trips.data.length} trip${trips.data.length === 1 ? "" : "s"} on SafariPlug.`);
      return;
    }
    setNote("No trips yet. Save experiences and organize an itinerary in one place.");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>My trips</Text>
        <Text style={styles.title}>Build the journey</Text>
        <Text style={styles.lede}>
          Hotel, airport transfer, diving, dinner, driver, event — one trip. Booking stays off until a supplier is live.
        </Text>
        <TripCard title="Your itinerary" body={note} />
        <ComingSoonCard
          title="Booking confirmation is not live"
          body="SafariPlug will not pretend a hotel, transfer or driver is reserved. Quotes remain unconfirmed listed prices until a real contract exists."
        />
        <StoryCta
          kicker="Discover"
          title="Start from a destination"
          body="Pick a place, then add stays, events and experiences as they become available."
          action="Explore destinations →"
          onPress={() => router.push("/(tabs)/explore")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 32, fontWeight: "600" },
  lede: { color: colors.textMuted, lineHeight: 22 },
});
