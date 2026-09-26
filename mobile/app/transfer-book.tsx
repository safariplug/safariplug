import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { supabase } from "../src/auth";
import { colors } from "../src/theme";

type Preflight={selectionToken:string;pricing?:{customerRetailAmount?:number;customerCurrency?:string};route?:{from?:{type?:string;code?:string};to?:{type?:string;code?:string};outbound?:string;adults?:number;children?:number;infants?:number};service?:{transferType?:string|null;vehicleName?:string|null};cancellationPolicies?:Array<{amount?:number|null;from?:string|null;currencyId?:string|null}>};

export default function TransferBookScreen(){
 const params=useLocalSearchParams<{selectionToken?:string;tripId?:string}>(); const token=String(params.selectionToken||"");
 const[preflight,setPreflight]=useState<Preflight|null>(null); const[loading,setLoading]=useState(true); const[busy,setBusy]=useState(false); const[accepted,setAccepted]=useState(false); const[error,setError]=useState("");
 const[holder,setHolder]=useState({name:"",surname:"",email:"",phone:""}); const[flightCode,setFlightCode]=useState(""); const[flightCompany,setFlightCompany]=useState(""); const[flightDirection,setFlightDirection]=useState<"ARRIVAL"|"DEPARTURE">("ARRIVAL");

 const headers=useCallback(async()=>{const{data}=await supabase.auth.getSession();if(!data.session)throw new Error("Sign in to book this transfer.");return{"content-type":"application/json",accept:"application/json",authorization:"Bearer "+data.session.access_token};},[]);

 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch(API_BASE_URL+"/api/v1/transfers/hotelbeds/checkout",{method:"POST",headers:await headers(),body:JSON.stringify({action:"preflight",selectionToken:token,currency:"KES"})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to verify this transfer.");if(active)setPreflight(b);}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to verify transfer.");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[headers,token]);

 async function checkout(){
  if(!preflight?.selectionToken||!accepted)return;
  if(!holder.name.trim()||!holder.surname.trim()||!holder.email.trim()||!holder.phone.trim()){setError("Lead passenger name, email and international phone are required.");return;}
  setBusy(true);setError("");
  try{
   const transferDetails=(flightCode.trim()||flightCompany.trim())?[{type:"FLIGHT",direction:flightDirection,code:flightCode.trim(),companyName:flightCompany.trim()}]:undefined;
   const r=await fetch(API_BASE_URL+"/api/v1/transfers/hotelbeds/checkout",{method:"POST",headers:await headers(),body:JSON.stringify({action:"prepare",idempotencyKey:"mobile-transfer-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),selectionToken:preflight.selectionToken,currency:"KES",tripId:params.tripId||undefined,termsAccepted:true,customerPhone:holder.phone.trim(),holder:{name:holder.name.trim(),surname:holder.surname.trim(),email:holder.email.trim(),phone:holder.phone.trim()},transferDetails})});
   const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||b?.error||"Unable to start transfer payment.");if(!b?.bookingId)throw new Error("SafariPlug did not return a transfer booking session.");
   Alert.alert("M-Pesa request sent","Complete payment on your phone. SafariPlug will confirm the transfer only after payment succeeds.");
   const route=preflight.route; const label=[route?.from?.code,route?.to?.code].filter(Boolean).join(" → ")||"Transfer booking";
   router.replace({pathname:"/travel-booking/[product]/[bookingId]",params:{product:"transfer",bookingId:String(b.bookingId),label,bookingStatus:String(b.status||"payment_pending"),paymentStatus:"pending",currency:String(preflight.pricing?.customerCurrency||"KES"),amount:String(preflight.pricing?.customerRetailAmount||0),providerReference:"",...(params.tripId?{tripId:String(params.tripId)}:{})}} as never);
  }catch(e){setError(e instanceof Error?e.message:"Unable to start transfer payment.");setBusy(false);}
 }

 const r=preflight?.route; const price=preflight?.pricing;
 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"Review transfer"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>Hotelbeds Transfer</Text><Text style={styles.title}>Review your transfer</Text><Text style={styles.body}>{[r?.from?.code,r?.to?.code].filter(Boolean).join(" → ")}</Text></View>
  {loading?<Text style={styles.body}>Verifying selected transfer…</Text>:null}
  {preflight?<View style={styles.card}><Text style={styles.heading}>{preflight.service?.vehicleName||preflight.service?.transferType||"Transfer service"}</Text><Text style={styles.body}>Outbound: {r?.outbound||"—"}</Text><Text style={styles.body}>{(r?.adults||0)+" adult · "+(r?.children||0)+" child · "+(r?.infants||0)+" infant"}</Text>{(preflight.cancellationPolicies||[]).map((p,i)=><Text key={i} style={styles.muted}>Cancellation from {p.from||"supplier cutoff"}: {p.currencyId||""} {p.amount??"supplier-defined"}</Text>)}</View>:null}
  <View style={styles.total}><Text style={styles.body}>Verified SafariPlug total</Text><Text style={styles.price}>{(price?.customerCurrency||"KES")+" "+Number(price?.customerRetailAmount||0).toLocaleString()}</Text></View>
  <View style={styles.card}><Text style={styles.heading}>Lead passenger</Text><View style={styles.row}><TextInput value={holder.name} onChangeText={v=>setHolder({...holder,name:v})} placeholder="First name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={holder.surname} onChangeText={v=>setHolder({...holder,surname:v})} placeholder="Last name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View><TextInput value={holder.email} onChangeText={v=>setHolder({...holder,email:v})} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" style={styles.input}/><TextInput value={holder.phone} onChangeText={v=>setHolder({...holder,phone:v})} placeholder="+2547…" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" style={styles.input}/></View>
  <View style={styles.card}><Text style={styles.heading}>Flight details (optional)</Text><View style={styles.row}><Pressable onPress={()=>setFlightDirection("ARRIVAL")} style={[styles.choice,flightDirection==="ARRIVAL"&&styles.choiceOn]}><Text style={styles.choiceText}>Arrival</Text></Pressable><Pressable onPress={()=>setFlightDirection("DEPARTURE")} style={[styles.choice,flightDirection==="DEPARTURE"&&styles.choiceOn]}><Text style={styles.choiceText}>Departure</Text></Pressable></View><TextInput value={flightCode} onChangeText={setFlightCode} placeholder="Flight number" placeholderTextColor={colors.textMuted} style={styles.input}/><TextInput value={flightCompany} onChangeText={setFlightCompany} placeholder="Airline" placeholderTextColor={colors.textMuted} style={styles.input}/></View>
  <View style={styles.accept}><Switch value={accepted} onValueChange={setAccepted}/><Text style={[styles.body,{flex:1}]}>I reviewed and accept the selected transfer, price, cancellation terms and supplier conditions.</Text></View>
  {error?<Text style={styles.error}>{error}</Text>:null}
  <Pressable disabled={loading||busy||!preflight||!accepted} onPress={()=>void checkout()} style={[styles.primary,(loading||busy||!accepted)&&styles.disabled]}><Text style={styles.primaryText}>{busy?"Starting M-Pesa…":"Continue with M-Pesa"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:28,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:10},heading:{color:colors.text,fontSize:18,fontWeight:"800"},muted:{color:colors.textMuted,fontSize:12,lineHeight:18},total:{borderRadius:18,borderWidth:1,borderColor:colors.gold,padding:16},price:{color:colors.text,fontSize:28,fontWeight:"900",marginTop:5},row:{flexDirection:"row",gap:8},flex:{flex:1},input:{borderRadius:13,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:13,paddingVertical:12},choice:{flex:1,borderRadius:12,borderWidth:1,borderColor:colors.border,padding:12,alignItems:"center"},choiceOn:{borderColor:colors.gold,backgroundColor:colors.forest},choiceText:{color:colors.text,fontWeight:"800"},accept:{flexDirection:"row",gap:12,alignItems:"center",borderRadius:18,borderWidth:1,borderColor:colors.border,padding:14},error:{color:"#f5a3a3",lineHeight:20},primary:{borderRadius:15,backgroundColor:colors.gold,paddingVertical:14,alignItems:"center"},disabled:{opacity:.45},primaryText:{color:colors.bg,fontWeight:"900"}});
