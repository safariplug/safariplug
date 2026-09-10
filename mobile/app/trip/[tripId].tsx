import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../src/api/client";
import { supabase } from "../../src/auth";
import { colors } from "../../src/theme";

type Trip = { id: string; title: string | null; start_on: string | null; end_on: string | null; status: string; cities?: { name?: string | null; country?: string | null } | null };
type Item = { id: string; item_kind: string; display_title: string; display_start: string | null; display_end: string | null; notes?: string | null; event?: { venue_name?: string | null; venue_address?: string | null } | null; appointment?: { status?: string | null; payment_status?: string | null; customer_total_amount?: number | null; currency?: string | null } | null; food_order?: { status?: string | null; payment_status?: string | null; customer_total?: number | null; currency?: string | null; business?: { name?: string | null } | null } | null };

function labelKind(kind: string) { const labels: Record<string, string> = { event: "Experience", appointment: "Appointment", food_order: "Food order", hotel: "Stay", transfer: "Transfer", restaurant: "Dining" }; return labels[kind] || kind.replaceAll("_", " "); }
function formatWhen(value: string | null) { if (!value) return "Time to be scheduled"; return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("Loading your journey…");
  const load = useCallback(async () => {
    if (!tripId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setMessage("Sign in to view this journey."); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/trip-planner/${encodeURIComponent(tripId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || "Unable to load this journey."); return; }
      setTrip(body.trip || null); setItems(Array.isArray(body.items) ? body.items : []); setMessage(body.items?.length ? "Your journey is taking shape." : "No items yet. Add experiences, services or dining to this journey.");
    } catch { setMessage("Unable to reach SafariPlug."); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load]);
  if (!trip && message === "Loading your journey…") return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.gold} style={styles.loader} /></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>← My trips</Text></Pressable>
    {trip ? <>
      <Text style={styles.kicker}>SafariPlug Journey</Text><Text style={styles.title}>{trip.title || "Untitled trip"}</Text>
      <Text style={styles.destination}>{trip.cities?.name || "Destination"}{trip.cities?.country ? `, ${trip.cities.country}` : ""}</Text>
      <Text style={styles.dates}>{trip.start_on || "Flexible start"} · {trip.end_on || "Flexible end"}</Text>
      <Text style={styles.section}>Itinerary</Text>
      {items.length ? items.map((item) => <View key={item.id} style={styles.card}>
        <Text style={styles.kind}>{labelKind(item.item_kind)}</Text><Text style={styles.itemTitle}>{item.food_order?.business?.name || item.display_title}</Text>
        <Text style={styles.when}>{formatWhen(item.display_start)}</Text>
        {item.event?.venue_name ? <Text style={styles.detail}>{item.event.venue_name}{item.event.venue_address ? ` · ${item.event.venue_address}` : ""}</Text> : null}
        {item.food_order?.status ? <Text style={styles.detail}>Order: {item.food_order.status.replaceAll("_", " ")}{item.food_order.payment_status ? ` · Payment: ${item.food_order.payment_status.replaceAll("_", " ")}` : ""}</Text> : null}
        {item.appointment?.status ? <Text style={styles.detail}>Booking: {item.appointment.status.replaceAll("_", " ")}{item.appointment.payment_status ? ` · Payment: ${item.appointment.payment_status.replaceAll("_", " ")}` : ""}</Text> : null}
        {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      </View>) : <Text style={styles.empty}>Nothing has been added yet.</Text>}
      <Text style={styles.section}>Add to this trip</Text>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => router.push({ pathname: "/category/[kind]", params: { kind: "food", tripId: trip.id } })}><Text style={styles.actionTitle}>Order food</Text><Text style={styles.actionBody}>Browse live restaurant menus and add an order to this journey.</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push({ pathname: "/category/[kind]", params: { kind: "wellness", tripId: trip.id } })}><Text style={styles.actionTitle}>Book a service</Text><Text style={styles.actionBody}>Find available wellness, beauty and personal services for this journey.</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push({ pathname: "/category/[kind]", params: { kind: "adventure", tripId: trip.id } })}><Text style={styles.actionTitle}>Add an activity</Text><Text style={styles.actionBody}>Explore bookable adventure and watersport providers.</Text></Pressable>
      </View>
      <Pressable style={styles.cta} onPress={() => router.push("/(tabs)/explore")}><Text style={styles.ctaText}>Discover more →</Text></Pressable>
    </> : <Text style={styles.empty}>{message}</Text>}
    <Text style={styles.message}>{message}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, loader: { flex: 1 }, page: { padding: 20, paddingBottom: 48, gap: 12 }, back: { color: colors.goldSoft, fontWeight: "700", marginBottom: 14 }, kicker: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase" }, title: { color: colors.text, fontSize: 32, fontWeight: "600", marginTop: 2 }, destination: { color: colors.textMuted, fontSize: 16 }, dates: { color: colors.textMuted, fontSize: 13 }, section: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 20 }, card: { borderRadius: 22, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, padding: 18 }, kind: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" }, itemTitle: { color: colors.text, fontSize: 19, fontWeight: "700", marginTop: 5 }, when: { color: colors.textMuted, marginTop: 5 }, detail: { color: colors.textMuted, marginTop: 5, lineHeight: 20 }, notes: { color: colors.textMuted, marginTop: 7, fontStyle: "italic" }, empty: { color: colors.textMuted, paddingVertical: 18 }, actions: { gap: 10 }, action: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 17, gap: 6 }, actionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" }, actionBody: { color: colors.textMuted, lineHeight: 20 }, cta: { backgroundColor: colors.gold, borderRadius: 18, paddingVertical: 15, alignItems: "center", marginTop: 12 }, ctaText: { color: "#070708", fontWeight: "800" }, message: { color: colors.textMuted, fontSize: 12, marginTop: 8 } });
