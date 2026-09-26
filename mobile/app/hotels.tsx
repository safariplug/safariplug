import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { colors } from "../src/theme";

type Hotel={
 provider:string;property_id:string;property_name:string;currency:string;
 total?:{amount:number;currency:string}|null;cancellation?:string|null;availability:string;
 supplier_context?:{address?:string|null;booking_token?:string;board_name?:string|null;notices?:string[]};
};

function iso(offset:number){const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10);}

export default function HotelSearchScreen(){
 const params=useLocalSearchParams<{tripId?:string}>();
 const tripId=Array.isArray(params.tripId)?params.tripId[0]:params.tripId;
 const[destination,setDestination]=useState("");
 const[checkIn,setCheckIn]=useState(iso(7));
 const[checkOut,setCheckOut]=useState(iso(9));
 const[guests,setGuests]=useState("2");
 const[rooms,setRooms]=useState("1");
 const[items,setItems]=useState<Hotel[]>([]);
 const[loading,setLoading]=useState(false);
 const[error,setError]=useState("");
 const canSearch=useMemo(()=>destination.trim().length>0&&checkIn&&checkOut&&checkOut>checkIn,[destination,checkIn,checkOut]);

 async function runSearch(){
  if(!canSearch)return;
  setLoading(true);setError("");setItems([]);
  try{
   const q=new URLSearchParams({destination:destination.trim(),check_in:checkIn,check_out:checkOut,guests,rooms,currency:"KES",location_scope:"specific",bookable_only:"true"});
   const r=await fetch(API_BASE_URL+"/api/v1/hotels?"+q.toString(),{headers:{accept:"application/json"}});
   const b=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(b?.error?.message||b?.message||"Hotel search failed.");
   const rows=Array.isArray(b?.data)?b.data:[];
   setItems(rows);
   if(!rows.length)setError("No bookable rooms were returned for this search.");
  }catch(e){setError(e instanceof Error?e.message:"Hotel search failed.");}
  finally{setLoading(false);}
 }

 return <SafeAreaView style={styles.safe} edges={["top"]}>
  <Stack.Screen options={{title:"Hotels"}}/>
  <ScrollView contentContainerStyle={styles.page}>
   <View style={styles.hero}><Text style={styles.kicker}>SafariPlug Stays</Text><Text style={styles.title}>Search live hotels</Text><Text style={styles.body}>Only supplier-confirmed inventory and prices are shown.</Text></View>
   <View style={styles.form}>
    <TextInput value={destination} onChangeText={setDestination} placeholder="Westlands, Diani Beach, Karen…" placeholderTextColor={colors.textMuted} style={styles.input}/>
    <View style={styles.row}><TextInput value={checkIn} onChangeText={setCheckIn} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={checkOut} onChangeText={setCheckOut} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View>
    <View style={styles.row}><TextInput value={guests} onChangeText={setGuests} keyboardType="number-pad" placeholder="Guests" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={rooms} onChangeText={setRooms} keyboardType="number-pad" placeholder="Rooms" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View>
    <Pressable disabled={!canSearch||loading} onPress={()=>void runSearch()} style={[styles.primary,!canSearch&&styles.disabled]}><Text style={styles.primaryText}>{loading?"Checking suppliers…":"Search live stays"}</Text></Pressable>
   </View>
   {error?<Text style={styles.error}>{error}</Text>:null}
   {items.map(h=>{
    const token=h.supplier_context?.booking_token||"";
    const canBook=h.provider==="hotelbeds"&&rooms==="1"&&Boolean(token);
    return <View key={h.provider+"-"+h.property_id} style={styles.card}>
     <Text style={styles.provider}>{h.provider}</Text><Text style={styles.cardTitle}>{h.property_name}</Text>
     {h.supplier_context?.address?<Text style={styles.body}>{h.supplier_context.address}</Text>:null}
     {h.total?<Text style={styles.price}>{h.total.currency+" "+Number(h.total.amount).toLocaleString()}</Text>:null}
     {h.supplier_context?.board_name?<Text style={styles.body}>{h.supplier_context.board_name}</Text>:null}
     {h.cancellation?<Text style={styles.body}>{h.cancellation}</Text>:null}
     {canBook?<Pressable onPress={()=>router.push({pathname:"/hotel-book",params:{hotelName:h.property_name,bookingToken:token,checkIn,checkOut,guests,total:String(h.total?.amount||0),...(tripId?{tripId}: {})}} as never)} style={styles.primary}><Text style={styles.primaryText}>Review & book</Text></Pressable>:<Text style={styles.muted}>This result is visible, but native checkout is not available for this supplier yet.</Text>}
    </View>;
   })}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},
 kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"800",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:30,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},
 form:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:16,gap:10},input:{borderRadius:14,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:14,paddingVertical:12},
 row:{flexDirection:"row",gap:10},flex:{flex:1},primary:{borderRadius:14,backgroundColor:colors.gold,paddingVertical:13,alignItems:"center",marginTop:3},disabled:{opacity:.5},primaryText:{color:colors.bg,fontWeight:"900"},
 error:{color:"#f5a3a3",lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:8},provider:{color:colors.goldSoft,fontSize:10,fontWeight:"900",textTransform:"uppercase"},
 cardTitle:{color:colors.text,fontSize:20,fontWeight:"800"},price:{color:colors.text,fontSize:24,fontWeight:"900"},muted:{color:colors.textMuted,fontSize:12,lineHeight:18}
});
