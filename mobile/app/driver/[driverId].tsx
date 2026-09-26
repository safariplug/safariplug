import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../src/config";
import { supabase } from "../../src/auth";
import { colors } from "../../src/theme";

type Rate={id:string;rate_type:string;origin_label?:string|null;destination_label?:string|null;airport_code?:string|null;amount:number;currency:string};
type Driver={id:string;display_name:string;personal_photo_url:string;service_city?:string|null;service_country?:string|null;vehicles?:Array<{id:string;make_model?:string|null;category?:string|null;passenger_capacity?:number|null}>;driver_transfer_rates?:Rate[]};

export default function DriverDetailScreen(){
 const params=useLocalSearchParams<{driverId?:string;tripId?:string}>(); const driverId=String(params.driverId||""); const tripId=Array.isArray(params.tripId)?params.tripId[0]:params.tripId;
 const[driver,setDriver]=useState<Driver|null>(null); const[loading,setLoading]=useState(true); const[busy,setBusy]=useState(false); const[error,setError]=useState("");
 const[pickup,setPickup]=useState(""); const[destination,setDestination]=useState(""); const[requestedAt,setRequestedAt]=useState(""); const[passengers,setPassengers]=useState("1"); const[notes,setNotes]=useState(""); const[rateId,setRateId]=useState("");

 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch(API_BASE_URL+"/api/drivers/discovery?id="+encodeURIComponent(driverId),{headers:{accept:"application/json"}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||"Verified driver not found.");if(active)setDriver(b.driver||null);}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load driver.");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[driverId]);

 const requestDriver=useCallback(async()=>{
  if(!driver)return;
  if(!pickup.trim()||!destination.trim()||!requestedAt.trim()){setError("Pickup, destination and future pickup time are required.");return;}
  setBusy(true);setError("");
  try{
   const{data}=await supabase.auth.getSession();if(!data.session)throw new Error("Sign in to request this driver.");
   const r=await fetch(API_BASE_URL+"/api/account/driver-requests",{method:"POST",headers:{"content-type":"application/json",accept:"application/json",authorization:"Bearer "+data.session.access_token},body:JSON.stringify({driverId:driver.id,pickup:pickup.trim(),destination:destination.trim(),requestedAt:requestedAt.trim(),passengers:Number(passengers||1),notes:notes.trim()||undefined,rateId:rateId||undefined,tripId:tripId||undefined})});
   const b=await r.json().catch(()=>({}));
   if(!r.ok){
    if(b?.error==="traveler_verification_required")throw new Error("SafariPlug traveler verification is required before a specific-driver request can be submitted.");
    throw new Error(b?.error||b?.message||"Unable to create driver request.");
   }
   Alert.alert("Driver request sent","The ride is still pending until the driver accepts it.");
   router.replace("/driver-requests" as never);
  }catch(e){const m=e instanceof Error?e.message:"Unable to create driver request.";setError(m);Alert.alert("Request not sent",m);}
  finally{setBusy(false);}
 },[destination,driver,notes,passengers,pickup,rateId,requestedAt,tripId]);

 if(loading)return<SafeAreaView style={styles.safe}><Text style={styles.loading}>Loading verified driver…</Text></SafeAreaView>;
 if(!driver)return<SafeAreaView style={styles.safe}><Text style={styles.error}>{error||"Driver not available."}</Text></SafeAreaView>;
 const vehicle=driver.vehicles?.[0];
 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:driver.display_name}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}>{driver.personal_photo_url?<Image source={{uri:driver.personal_photo_url}} style={styles.avatar}/>:null}<Text style={styles.verified}>VERIFIED SAFARIPLUG DRIVER</Text><Text style={styles.title}>{driver.display_name}</Text><Text style={styles.body}>{[driver.service_city,driver.service_country].filter(Boolean).join(", ")}</Text></View>
  {vehicle?<View style={styles.card}><Text style={styles.heading}>{vehicle.make_model||vehicle.category||"Approved vehicle"}</Text><Text style={styles.body}>{vehicle.passenger_capacity?vehicle.passenger_capacity+" passenger capacity":"Capacity confirmed before request."}</Text></View>:null}
  {(driver.driver_transfer_rates||[]).length?<View style={styles.card}><Text style={styles.heading}>Published rates</Text><Pressable onPress={()=>setRateId("")} style={[styles.rate,!rateId&&styles.rateOn]}><Text style={styles.rateText}>Request custom quote</Text></Pressable>{(driver.driver_transfer_rates||[]).map(rate=><Pressable key={rate.id} onPress={()=>setRateId(rate.id)} style={[styles.rate,rateId===rate.id&&styles.rateOn]}><Text style={styles.rateText}>{rate.origin_label||rate.airport_code||rate.rate_type.replaceAll("_"," ")}{rate.destination_label?" → "+rate.destination_label:""}</Text><Text style={styles.ratePrice}>{rate.currency+" "+Number(rate.amount).toLocaleString()}</Text></Pressable>)}</View>:null}
  <View style={styles.card}><Text style={styles.heading}>Request this driver</Text>{tripId?<Text style={styles.trip}>This request will be linked to your selected SafariPlug trip.</Text>:null}<TextInput value={pickup} onChangeText={setPickup} placeholder="Pickup location" placeholderTextColor={colors.textMuted} style={styles.input}/><TextInput value={destination} onChangeText={setDestination} placeholder="Destination" placeholderTextColor={colors.textMuted} style={styles.input}/><TextInput value={requestedAt} onChangeText={setRequestedAt} placeholder="Pickup time e.g. 2026-10-02T14:30" placeholderTextColor={colors.textMuted} style={styles.input}/><TextInput value={passengers} onChangeText={setPassengers} keyboardType="number-pad" placeholder="Passengers" placeholderTextColor={colors.textMuted} style={styles.input}/><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Flight, luggage, child seat or trip details (optional)" placeholderTextColor={colors.textMuted} style={[styles.input,{minHeight:90,textAlignVertical:"top"}]}/><Text style={styles.notice}>Specific-driver requests use SafariPlug's existing traveler verification state. No new paid verification provider is introduced here.</Text></View>
  {error?<Text style={styles.error}>{error}</Text>:null}
  <Pressable disabled={busy} onPress={()=>void requestDriver()} style={styles.primary}><Text style={styles.primaryText}>{busy?"Sending request…":"Send driver request"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:14},loading:{color:colors.textMuted,padding:24},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7,alignItems:"flex-start"},avatar:{width:96,height:96,borderRadius:28,marginBottom:8},verified:{color:"#6dbf8b",fontSize:10,fontWeight:"900",letterSpacing:1.5},title:{color:colors.text,fontSize:30,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:10},heading:{color:colors.text,fontSize:18,fontWeight:"800"},trip:{color:colors.goldSoft,fontWeight:"800"},rate:{borderRadius:13,borderWidth:1,borderColor:colors.border,padding:12,gap:4},rateOn:{borderColor:colors.gold,backgroundColor:colors.forest},rateText:{color:colors.text,fontWeight:"700"},ratePrice:{color:colors.goldSoft,fontWeight:"900"},input:{borderRadius:13,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:13,paddingVertical:12},notice:{color:colors.textMuted,fontSize:12,lineHeight:18},error:{color:"#f5a3a3",lineHeight:20},primary:{borderRadius:15,backgroundColor:colors.gold,paddingVertical:14,alignItems:"center"},primaryText:{color:colors.bg,fontWeight:"900"}});
