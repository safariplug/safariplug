import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../src/config";
import { createRestaurantOrder, startRestaurantMpesaPayment } from "../../src/api/restaurants";
import { ApiError } from "../../src/api/client";
import { LoadingBlock } from "../../src/components/StatusBlocks";
import { colors } from "../../src/theme";

type Value = { id: string; name: string; price_delta: number; active: boolean };
type Option = { id: string; name: string; required: boolean; active: boolean; restaurant_menu_item_option_values: Value[] };
type Item = { id: string; name: string; description?: string | null; image_url?: string | null; price: number; currency: string; restaurant_menu_item_options?: Option[] };
type Category = { id: string; name: string; description?: string | null; items: Item[] };
type Settings = { ordering_enabled: boolean; pickup_enabled: boolean; restaurant_delivery_enabled: boolean; restaurant_delivery_fee: number; free_delivery_threshold: number | null; minimum_order_amount: number; preparation_time_minutes: number };
type Menu = { settings: Settings | null; categories: Category[] };
type CartLine = { item: Item; quantity: number; options: { optionId: string; valueId: string }[] };

function linePrice(line: CartLine) {
  return Number(line.item.price) + line.options.reduce((sum, selected) => {
    const option = line.item.restaurant_menu_item_options?.find((entry) => entry.id === selected.optionId);
    const value = option?.restaurant_menu_item_option_values.find((entry) => entry.id === selected.valueId);
    return sum + Number(value?.price_delta || 0);
  }, 0);
}

export default function RestaurantScreen() {
  const { businessId, name } = useLocalSearchParams<{ businessId: string; name?: string }>();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [draftOptions, setDraftOptions] = useState<{ optionId: string; valueId: string }[]>([]);
  const [method, setMethod] = useState<"pickup" | "restaurant_delivery">("pickup");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/restaurants/${encodeURIComponent(businessId)}/menu`);
      const data = await response.json();
      if (!response.ok) throw new ApiError(response.status, "menu_error", data?.error || "Unable to load this menu.");
      setMenu(data as Menu);
      if (data?.settings?.pickup_enabled) setMethod("pickup");
      else if (data?.settings?.restaurant_delivery_enabled) setMethod("restaurant_delivery");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Unable to load this menu.");
    } finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0), [cart]);
  const deliveryFee = method === "restaurant_delivery" && menu?.settings
    ? (menu.settings.free_delivery_threshold != null && subtotal >= Number(menu.settings.free_delivery_threshold) ? 0 : Number(menu.settings.restaurant_delivery_fee || 0))
    : 0;
  const total = subtotal + deliveryFee;
  const currency = cart[0]?.item.currency || "KES";

  function addItem(item: Item) {
    if ((item.restaurant_menu_item_options || []).length) {
      setSelectedItem(item); setDraftOptions([]); return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id && !line.options.length);
      return existing ? current.map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { item, quantity: 1, options: [] }];
    });
  }

  function chooseOption(optionId: string, valueId: string) {
    setDraftOptions((current) => [...current.filter((entry) => entry.optionId !== optionId), { optionId, valueId }]);
  }

  function addCustomizedItem() {
    if (!selectedItem) return;
    const options = selectedItem.restaurant_menu_item_options || [];
    if (options.some((option) => option.required && !draftOptions.some((selected) => selected.optionId === option.id))) {
      setMessage(`Select all required options for ${selectedItem.name}.`); return;
    }
    setCart((current) => [...current, { item: selectedItem, quantity: 1, options: draftOptions }]);
    setSelectedItem(null); setMessage(null);
  }

  function changeQuantity(index: number, delta: number) {
    setCart((current) => current.flatMap((line, position) => position === index ? (line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []) : [line]));
  }

  async function checkout() {
    setMessage(null);
    if (!cart.length) return setMessage("Add at least one item to your order.");
    if (!customer.name.trim() || !customer.phone.trim()) return setMessage("Add your name and M-Pesa phone number.");
    if (method === "restaurant_delivery" && !customer.address.trim()) return setMessage("Add a delivery address.");
    if (menu?.settings && subtotal < Number(menu.settings.minimum_order_amount || 0)) return setMessage(`Minimum order is ${currency} ${Number(menu.settings.minimum_order_amount).toLocaleString()}.`);
    setBusy(true);
    try {
      const created = await createRestaurantOrder({ businessId: businessId!, fulfillmentMethod: method, customerName: customer.name.trim(), customerPhone: customer.phone.trim(), customerEmail: customer.email.trim() || undefined, deliveryAddress: method === "restaurant_delivery" ? customer.address.trim() : undefined, customerNotes: customer.notes.trim() || undefined, items: cart.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity, options: line.options })) });
      const payment = await startRestaurantMpesaPayment(created.order.id, customer.phone.trim());
      setCart([]);
      setMessage(`Order ${created.order.public_id || created.order.id} created. M-Pesa payment request started${payment.intent.providerReference ? ` (${payment.intent.providerReference})` : ""}. Check your phone to complete payment.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to place your order.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ title: typeof name === "string" ? name : "Restaurant" }} />
      <ScrollView contentContainerStyle={styles.page}>
        {loading ? <LoadingBlock label="Loading menu…" /> : menu?.settings?.ordering_enabled !== true ? <View style={styles.empty}><Text style={styles.emptyTitle}>Ordering is not currently available</Text><Text style={styles.emptyBody}>{message || "This restaurant has not enabled online ordering."}</Text></View> : <>
          <View style={styles.hero}><Text style={styles.kicker}>SafariPlug Food</Text><Text style={styles.title}>{typeof name === "string" ? name : "Restaurant"}</Text><Text style={styles.heroBody}>Choose your food, fulfilment method and pay securely with M-Pesa.</Text></View>
          {menu.categories.map((category) => <View key={category.id} style={styles.section}><Text style={styles.sectionTitle}>{category.name}</Text>{category.description ? <Text style={styles.sectionBody}>{category.description}</Text> : null}{category.items.map((item) => <View key={item.id} style={styles.item}><View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.name}</Text>{item.description ? <Text style={styles.itemBody}>{item.description}</Text> : null}<Text style={styles.price}>{item.currency} {Number(item.price).toLocaleString()}</Text>{item.restaurant_menu_item_options?.length ? <Text style={styles.custom}>Customizable</Text> : null}</View><Pressable style={styles.add} onPress={() => addItem(item)}><Text style={styles.addText}>Add</Text></Pressable></View>)}</View>)}
          <View style={styles.cart}><Text style={styles.cartTitle}>Your order</Text>{!cart.length ? <Text style={styles.emptyBody}>Your cart is empty.</Text> : cart.map((line, index) => <View key={`${line.item.id}-${index}`} style={styles.cartLine}><View style={styles.itemCopy}><Text style={styles.itemTitle}>{line.item.name}</Text><Text style={styles.itemBody}>{currency} {linePrice(line).toLocaleString()}{line.options.length ? " · options selected" : ""}</Text></View><Pressable onPress={() => changeQuantity(index, -1)} style={styles.qty}><Text>−</Text></Pressable><Text style={styles.qtyText}>{line.quantity}</Text><Pressable onPress={() => changeQuantity(index, 1)} style={styles.qty}><Text>+</Text></Pressable></View>)}<View style={styles.totalRow}><Text style={styles.itemBody}>Subtotal</Text><Text style={styles.itemTitle}>{currency} {subtotal.toLocaleString()}</Text></View>{menu.settings.restaurant_delivery_enabled ? <View style={styles.totalRow}><Text style={styles.itemBody}>Restaurant delivery</Text><Text style={styles.itemBody}>{method === "restaurant_delivery" ? (deliveryFee ? `${currency} ${deliveryFee.toLocaleString()}` : "Free") : "Not selected"}</Text></View> : null}<View style={styles.totalRow}><Text style={styles.cartTotal}>Total</Text><Text style={styles.cartTotal}>{currency} {total.toLocaleString()}</Text></View></View>
          <View style={styles.checkout}><Text style={styles.sectionTitle}>Checkout</Text><View style={styles.methods}>{menu.settings.pickup_enabled ? <Pressable onPress={() => setMethod("pickup")} style={[styles.method, method === "pickup" && styles.methodActive]}><Text style={styles.methodText}>Pickup</Text></Pressable> : null}{menu.settings.restaurant_delivery_enabled ? <Pressable onPress={() => setMethod("restaurant_delivery")} style={[styles.method, method === "restaurant_delivery" && styles.methodActive]}><Text style={styles.methodText}>Restaurant delivery</Text></Pressable> : null}</View><TextInput value={customer.name} onChangeText={(value) => setCustomer((current) => ({ ...current, name: value }))} placeholder="Full name" placeholderTextColor={colors.textMuted} style={styles.input} /><TextInput value={customer.phone} onChangeText={(value) => setCustomer((current) => ({ ...current, phone: value }))} placeholder="M-Pesa phone number" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" style={styles.input} /><TextInput value={customer.email} onChangeText={(value) => setCustomer((current) => ({ ...current, email: value }))} placeholder="Email (optional)" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" style={styles.input} />{method === "restaurant_delivery" ? <TextInput value={customer.address} onChangeText={(value) => setCustomer((current) => ({ ...current, address: value }))} placeholder="Delivery address" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline /> : null}<TextInput value={customer.notes} onChangeText={(value) => setCustomer((current) => ({ ...current, notes: value }))} placeholder="Order notes (optional)" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline />{message ? <Text style={styles.message}>{message}</Text> : null}<Pressable disabled={busy || !cart.length} onPress={() => void checkout()} style={[styles.checkoutButton, (busy || !cart.length) && styles.disabled]}><Text style={styles.checkoutText}>{busy ? "Creating order & starting M-Pesa…" : "Place order & pay with M-Pesa"}</Text></Pressable><Text style={styles.disclaimer}>SafariPlug re-checks menu prices, availability and order totals on the server before creating the order.</Text></View>
        </>}
      </ScrollView>
      {selectedItem ? <View style={styles.modalBackdrop}><View style={styles.modal}><Text style={styles.titleSmall}>Customize {selectedItem.name}</Text><Text style={styles.itemBody}>Choose the required options before adding it.</Text>{(selectedItem.restaurant_menu_item_options || []).map((option) => <View key={option.id} style={styles.option}><Text style={styles.optionTitle}>{option.name}{option.required ? " · Required" : " · Optional"}</Text>{option.restaurant_menu_item_option_values.map((value) => <Pressable key={value.id} onPress={() => chooseOption(option.id, value.id)} style={styles.optionRow}><Text style={styles.itemBody}>{draftOptions.some((entry) => entry.optionId === option.id && entry.valueId === value.id) ? "●" : "○"} {value.name}</Text><Text style={styles.itemBody}>{Number(value.price_delta) ? `${Number(value.price_delta) > 0 ? "+" : "−"}${selectedItem.currency} ${Math.abs(Number(value.price_delta)).toLocaleString()}` : "Included"}</Text></Pressable>)}</View>)}<Pressable onPress={addCustomizedItem} style={styles.checkoutButton}><Text style={styles.checkoutText}>Add to order</Text></Pressable><Pressable onPress={() => setSelectedItem(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable></View></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, page: { padding: 20, gap: 16, paddingBottom: 56 }, hero: { borderRadius: 26, backgroundColor: colors.forest, padding: 22, gap: 7 }, kicker: { color: colors.goldSoft, fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" }, title: { color: colors.text, fontSize: 30, fontWeight: "700" }, titleSmall: { color: colors.text, fontSize: 23, fontWeight: "700" }, heroBody: { color: colors.sand, lineHeight: 21 }, section: { gap: 10 }, sectionTitle: { color: colors.text, fontSize: 23, fontWeight: "700" }, sectionBody: { color: colors.textMuted, lineHeight: 20 }, item: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 16, gap: 12 }, itemCopy: { flex: 1, gap: 5 }, itemTitle: { color: colors.text, fontSize: 17, fontWeight: "700" }, itemBody: { color: colors.textMuted, lineHeight: 19 }, price: { color: colors.goldSoft, fontWeight: "800", marginTop: 3 }, custom: { color: colors.gold, fontSize: 11, fontWeight: "700" }, add: { alignSelf: "flex-start", borderRadius: 13, backgroundColor: colors.gold, paddingHorizontal: 18, paddingVertical: 10 }, addText: { color: colors.bg, fontWeight: "800", fontSize: 12 }, cart: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: 17, gap: 12 }, cartTitle: { color: colors.text, fontSize: 21, fontWeight: "700" }, cartLine: { flexDirection: "row", alignItems: "center", gap: 8 }, qty: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, qtyText: { color: colors.text, fontWeight: "700", minWidth: 18, textAlign: "center" }, totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, cartTotal: { color: colors.text, fontSize: 18, fontWeight: "800" }, checkout: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 17, gap: 12 }, methods: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, method: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 }, methodActive: { backgroundColor: colors.gold, borderColor: colors.gold }, methodText: { color: colors.text, fontWeight: "700" }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.bgCard, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 }, multiline: { minHeight: 72, textAlignVertical: "top" }, message: { color: colors.goldSoft, lineHeight: 20 }, checkoutButton: { borderRadius: 16, backgroundColor: colors.gold, paddingVertical: 14, alignItems: "center" }, checkoutText: { color: colors.bg, fontWeight: "800" }, disclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 17 }, empty: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 7 }, emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "700" }, disabled: { opacity: 0.45 }, modalBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }, modal: { maxHeight: "90%", borderRadius: 26, backgroundColor: colors.bgCard, padding: 20, gap: 12 }, option: { gap: 7 }, optionTitle: { color: colors.text, fontWeight: "800" }, optionRow: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 12 }, cancel: { alignItems: "center", paddingVertical: 8 }, cancelText: { color: colors.textMuted, fontWeight: "700" } });