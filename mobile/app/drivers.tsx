import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { colors } from "../src/theme";

type Driver={id:string;display_name:string;personal_photo_url:string;service_city?:string|null;service_country?:string|null;preferred?:boolean;vehicles?:Array<{id:string;make_model?:string|null;category?:string|null;passenger_capacity?:number|null}>;driver_transfer_rates?:Array<{id:string;rate_type:string;origin_label?:string|null;destination_label?:string|null;airport_code?:string|null;amount:number;currency:string}>};

export default function DriversScreen(){
 const params=useLocalSearchParams<{tripId?:string}>(); const tripId=Array.isArray(params.tripId)?params.tripId[0]:params.tripId;
 const[drivers,setDrivers]=useState<Driver[]>([]); const[loading,setLoading]=useState(true); const[error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch(API_BASE_URL+"/api/drivers/discovery",{headers:{accept:"application/json"}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||"Unable to load verified drivers.");if(active)setDrivers(Array.isArray(b.drivers)?b.drivers:[]);}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load drivers.");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"Verified drivers"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>SafariPlug Drivers</Text><Text style={styles.title}>Choose a verified driver</Text><Text style={styles.body}>Only active drivers with current SafariPlug verification, a personal photo, current driving credentials and an eligible vehicle are shown.</Text></View>
  {tripId?<Text style={styles.trip}>Choosing a driver for this SafariPlug trip.</Text>:null}
  {loading?<Text style={styles.body}>Loading eligible drivers…</Text>:null}
  {error?<Text style={styles.error}>{error}</Text>:null}
  {!loading&&!drivers.length&&!error?<Text style={styles.body}>No eligible drivers are publicly available right now.</Text>:null}
  {drivers.map(d=>{const vehicle=d.vehicles?.[0];return <Pressable key={d.id} style={styles.card} onPress={()=>router.push({pathname:"/driver/[driverId]",params:{driverId:d.id,...(tripId?{tripId}: {})}} as never)}>
    <View style={styles.head}>{d.personal_photo_url?<Image source={{uri:d.personal_photo_url}} style={styles.avatar}/>:<View style={styles.avatar}/>}<View style={styles.flex}><Text style={styles.verified}>VERIFIED</Text><Text style={styles.name}>{d.display_name}</Text><Text style={styles.body}>{[d.service_city,d.service_country].filter(Boolean).join(", ")||"SafariPlug service area"}</Text></View></View>
    {vehicle?<Text style={styles.vehicle}>{vehicle.make_model||vehicle.category||"Approved vehicle"}{vehicle.passenger_capacity?" · "+vehicle.passenger_capacity+" passengers":""}</Text>:null}
    {(d.driver_transfer_rates||[]).slice(0,2).map(rate=><View key={rate.id} style={styles.rate}><Text style={styles.body}>{rate.origin_label||rate.airport_code||rate.rate_type.replaceAll("_"," ")}{rate.destination_label?" → "+rate.destination_label:""}</Text><Text style={styles.ratePrice}>{rate.currency+" "+Number(rate.amount).toLocaleString()}</Text></View>)}
    <Text style={styles.cta}>Request this driver →</Text>
  </Pressable>})}
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:14},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:30,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},trip:{color:colors.goldSoft,fontWeight:"800"},error:{color:"#f5a3a3"},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:10},head:{flexDirection:"row",gap:14,alignItems:"center"},avatar:{width:66,height:66,borderRadius:22,backgroundColor:colors.forest},flex:{flex:1},verified:{color:"#6dbf8b",fontSize:10,fontWeight:"900",letterSpacing:1.4},name:{color:colors.text,fontSize:20,fontWeight:"800",marginTop:3},vehicle:{color:colors.text,fontWeight:"700"},rate:{flexDirection:"row",justifyContent:"space-between",gap:10,borderTopWidth:1,borderTopColor:colors.border,paddingTop:9},ratePrice:{color:colors.text,fontWeight:"900"},cta:{color:colors.goldSoft,fontWeight:"900",marginTop:3}});
