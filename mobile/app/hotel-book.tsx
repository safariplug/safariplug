import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { supabase } from "../src/auth";
import { colors } from "../src/theme";

type Guest={name:string;surname:string};
type Preflight={bookingToken?:string;rate?:{roomName?:string|null;boardName?:string|null;cancellation?:string|null;notices?:string[]};pricing?:{customerRetailAmount?:number;customerCurrency?:string}};
export default function HotelBookScreen(){
 const p=useLocalSearchParams<{hotelName?:string;bookingToken?:string;checkIn?:string;checkOut?:string;guests?:string;total?:string;tripId?:string}>();
 const guestCount=Math.max(1,Math.min(20,Number(p.guests||1)));
 const[guests,setGuests]=useState<Guest[]>(()=>Array.from({length:guestCount},()=>({name:"",surname:""})));
 const[phone,setPhone]=useState("");
 const[accepted,setAccepted]=useState(false);
 const[loading,setLoading]=useState(true);
 const[paying,setPaying]=useState(false);
 const[error,setError]=useState("");
 const[preflight,setPreflight]=useState<Preflight|null>(null);
 const finalAmount=preflight?.pricing?.customerRetailAmount??Number(p.total||0);
 const finalCurrency=preflight?.pricing?.customerCurrency||"KES";
 const token=String(p.bookingToken||"");
 const hotelName=String(p.hotelName||"Hotel stay");

 const headers=useCallback(async()=>{
  const{data}=await supabase.auth.getSession();
  if(!data.session)throw new Error("Sign in to book this hotel.");
  return {"content-type":"application/json",accept:"application/json",authorization:"Bearer "+data.session.access_token};
 },[]);

 useEffect(()=>{let active=true;(async()=>{try{
  const r=await fetch(API_BASE_URL+"/api/v1/hotels/hotelbeds",{method:"POST",headers:await headers(),body:JSON.stringify({action:"preflight",bookingToken:token,currency:"KES"})});
  const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to verify this Hotelbeds rate.");
  if(active)setPreflight(b);
 }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to verify this Hotelbeds rate.");}finally{if(active)setLoading(false);}})();return()=>{active=false}},[headers,token]);

 function updateGuest(index:number,key:keyof Guest,value:string){setGuests(rows=>rows.map((g,i)=>i===index?{...g,[key]:value}:g));}

 async function pay(){
  if(!preflight?.bookingToken||!accepted)return;
  if(!phone.trim()){setError("M-Pesa phone number is required.");return;}
  if(guests.some(g=>!g.name.trim()||!g.surname.trim())){setError("Enter every guest's first and last name.");return;}
  setPaying(true);setError("");
  try{
   const r=await fetch(API_BASE_URL+"/api/v1/hotels/hotelbeds",{method:"POST",headers:await headers(),body:JSON.stringify({
    action:"prepare",idempotencyKey:"mobile-hotel-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),bookingToken:preflight.bookingToken,currency:"KES",customerPhone:phone.trim(),termsAccepted:true,
    tripId:p.tripId||undefined,paxes:guests.map(g=>({type:"AD",name:g.name.trim(),surname:g.surname.trim(),roomId:1}))
   })});
   const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to start Hotelbeds payment.");
   if(!b?.bookingId)throw new Error("SafariPlug did not return a hotel booking session.");
   Alert.alert("M-Pesa request sent","Complete payment on your phone. SafariPlug will confirm the hotel only after payment succeeds.");
   router.replace({pathname:"/travel-booking/[product]/[bookingId]",params:{product:"hotel",bookingId:String(b.bookingId),label:hotelName,bookingStatus:String(b.status||"payment_pending"),paymentStatus:"pending",currency:finalCurrency,amount:String(finalAmount),providerReference:"",...(p.tripId?{tripId:String(p.tripId)}:{})}} as never);
  }catch(e){setError(e instanceof Error?e.message:"Unable to start payment.");setPaying(false);}
 }

 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"Review hotel"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>Hotelbeds</Text><Text style={styles.title}>{hotelName}</Text><Text style={styles.body}>{String(p.checkIn||"")+" → "+String(p.checkOut||"")+" · "+guestCount+" guest"+(guestCount===1?"":"s")}</Text></View>
  {loading?<Text style={styles.body}>Verifying live rate terms…</Text>:null}
  {preflight?.rate?<View style={styles.card}><Text style={styles.heading}>{preflight.rate.roomName||"Hotel room"}</Text>{preflight.rate.boardName?<Text style={styles.body}>{preflight.rate.boardName}</Text>:null}{preflight.rate.cancellation?<Text style={styles.body}>{preflight.rate.cancellation}</Text>:null}{(preflight.rate.notices||[]).map((n,i)=><Text key={i} style={styles.muted}>• {n}</Text>)}</View>:null}
  <View style={styles.total}><Text style={styles.body}>Verified SafariPlug total</Text><Text style={styles.price}>{finalCurrency+" "+Number(finalAmount).toLocaleString()}</Text></View>
  <View style={styles.card}><Text style={styles.heading}>Guest details</Text>{guests.map((g,i)=><View key={i} style={styles.row}><TextInput value={g.name} onChangeText={v=>updateGuest(i,"name",v)} placeholder={"Guest "+(i+1)+" first name"} placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={g.surname} onChangeText={v=>updateGuest(i,"surname",v)} placeholder="Last name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View>)}<TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="M-Pesa phone e.g. 2547…" placeholderTextColor={colors.textMuted} style={styles.input}/></View>
  <View style={styles.accept}><Switch value={accepted} onValueChange={setAccepted}/><Text style={[styles.body,{flex:1}]}>I reviewed and accept the room, board, cancellation and supplier rate terms shown above.</Text></View>
  {error?<Text style={styles.error}>{error}</Text>:null}
  <Pressable disabled={loading||paying||!preflight?.bookingToken||!accepted} onPress={()=>void pay()} style={[styles.primary,(loading||paying||!accepted)&&styles.disabled]}><Text style={styles.primaryText}>{paying?"Starting M-Pesa…":"Continue with M-Pesa"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:28,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:10},heading:{color:colors.text,fontSize:18,fontWeight:"800"},muted:{color:colors.textMuted,fontSize:12,lineHeight:18},total:{borderRadius:18,borderWidth:1,borderColor:colors.gold,padding:16},price:{color:colors.text,fontSize:28,fontWeight:"900",marginTop:5},row:{flexDirection:"row",gap:8},flex:{flex:1},input:{borderRadius:13,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:13,paddingVertical:12},accept:{flexDirection:"row",gap:12,alignItems:"center",borderRadius:18,borderWidth:1,borderColor:colors.border,padding:14},error:{color:"#f5a3a3",lineHeight:20},primary:{borderRadius:15,backgroundColor:colors.gold,paddingVertical:14,alignItems:"center"},disabled:{opacity:.45},primaryText:{color:colors.bg,fontWeight:"900"}});
