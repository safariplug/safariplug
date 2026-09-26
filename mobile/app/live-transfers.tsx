import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { colors } from "../src/theme";

type Route={code:string;from:{type:string;code:string};to:{type:string;code:string}};
type Result={selectionToken:string;supplierAmount:number;supplierCurrency:string;service?:{transferType?:string|null;vehicleName?:string|null;maxPaxCapacity?:number|null};cancellationPolicies?:unknown[]};

export default function LiveTransfersScreen(){
 const params=useLocalSearchParams<{tripId?:string}>();
 const tripId=Array.isArray(params.tripId)?params.tripId[0]:params.tripId;
 const[destinationCode,setDestinationCode]=useState("");
 const[routes,setRoutes]=useState<Route[]>([]);
 const[selected,setSelected]=useState<Route|null>(null);
 const[outbound,setOutbound]=useState("");
 const[inbound,setInbound]=useState("");
 const[adults,setAdults]=useState("2");
 const[children,setChildren]=useState("0");
 const[infants,setInfants]=useState("0");
 const[results,setResults]=useState<Result[]>([]);
 const[busy,setBusy]=useState("");
 const[error,setError]=useState("");

 async function findRoutes(){
  if(!destinationCode.trim()){setError("Enter a destination code.");return;}
  setBusy("routes");setError("");setRoutes([]);setSelected(null);setResults([]);
  try{
   const r=await fetch(API_BASE_URL+"/api/v1/transfers/hotelbeds/routes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({destinationCode:destinationCode.trim().toUpperCase()})});
   const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to load transfer routes.");
   const rows=Array.isArray(b.routes)?b.routes:[];setRoutes(rows);if(!rows.length)setError("No Hotelbeds routes were returned.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load transfer routes.");}finally{setBusy("");}
 }

 async function search(){
  if(!selected||!outbound){setError("Choose a route and outbound date/time.");return;}
  setBusy("search");setError("");setResults([]);
  try{
   const r=await fetch(API_BASE_URL+"/api/v1/transfers/hotelbeds",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"availability",fromType:selected.from.type,fromCode:selected.from.code,toType:selected.to.type,toCode:selected.to.code,outbound,inbound:inbound||undefined,adults:Number(adults||1),children:Number(children||0),infants:Number(infants||0)})});
   const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to search transfer availability.");
   const rows=Array.isArray(b.results)?b.results:[];setResults(rows);if(!rows.length)setError("No transfer services were returned.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to search transfers.");}finally{setBusy("");}
 }

 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"Transfers"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>Hotelbeds Transfers</Text><Text style={styles.title}>Search live transfers</Text><Text style={styles.body}>Airport, hotel and point-to-point supplier inventory.</Text></View>
  <View style={styles.form}><TextInput value={destinationCode} onChangeText={setDestinationCode} autoCapitalize="characters" placeholder="Destination code" placeholderTextColor={colors.textMuted} style={styles.input}/><Pressable disabled={busy!==""} onPress={()=>void findRoutes()} style={styles.primary}><Text style={styles.primaryText}>{busy==="routes"?"Finding routes…":"Find routes"}</Text></Pressable></View>
  {routes.map(r=><Pressable key={r.code} onPress={()=>{setSelected(r);setResults([]);setError("");}} style={[styles.route,selected?.code===r.code&&styles.routeOn]}><Text style={styles.routeText}>{r.from.type+" "+r.from.code+" → "+r.to.type+" "+r.to.code}</Text></Pressable>)}
  {selected?<View style={styles.form}><Text style={styles.heading}>Availability</Text><TextInput value={outbound} onChangeText={setOutbound} placeholder="Outbound YYYY-MM-DDTHH:mm" placeholderTextColor={colors.textMuted} style={styles.input}/><TextInput value={inbound} onChangeText={setInbound} placeholder="Inbound optional YYYY-MM-DDTHH:mm" placeholderTextColor={colors.textMuted} style={styles.input}/><View style={styles.row}><TextInput value={adults} onChangeText={setAdults} keyboardType="number-pad" placeholder="Adults" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={children} onChangeText={setChildren} keyboardType="number-pad" placeholder="Children" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={infants} onChangeText={setInfants} keyboardType="number-pad" placeholder="Infants" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View><Pressable disabled={busy!==""} onPress={()=>void search()} style={styles.primary}><Text style={styles.primaryText}>{busy==="search"?"Searching…":"Search availability"}</Text></Pressable></View>:null}
  {error?<Text style={styles.error}>{error}</Text>:null}
  {results.map((r,i)=><View key={r.selectionToken} style={styles.card}><Text style={styles.provider}>Hotelbeds transfer</Text><Text style={styles.cardTitle}>{r.service?.vehicleName||r.service?.transferType||"Transfer option "+(i+1)}</Text>{r.service?.maxPaxCapacity?<Text style={styles.body}>Up to {r.service.maxPaxCapacity} passengers</Text>:null}<Text style={styles.price}>{r.supplierCurrency+" "+Number(r.supplierAmount).toLocaleString()}</Text>{r.cancellationPolicies?.length?<Text style={styles.body}>Cancellation terms will be shown before payment.</Text>:null}<Pressable onPress={()=>router.push({pathname:"/transfer-book",params:{selectionToken:r.selectionToken,...(tripId?{tripId}: {})}} as never)} style={styles.primary}><Text style={styles.primaryText}>Review & book</Text></Pressable></View>)}
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:14},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:30,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},form:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:16,gap:10},input:{borderRadius:14,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:14,paddingVertical:12},primary:{borderRadius:14,backgroundColor:colors.gold,paddingVertical:13,alignItems:"center"},primaryText:{color:colors.bg,fontWeight:"900"},route:{borderRadius:14,borderWidth:1,borderColor:colors.border,padding:14},routeOn:{borderColor:colors.gold,backgroundColor:colors.forest},routeText:{color:colors.text,fontWeight:"800"},heading:{color:colors.text,fontSize:18,fontWeight:"800"},row:{flexDirection:"row",gap:7},flex:{flex:1},error:{color:"#f5a3a3",lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:8},provider:{color:colors.goldSoft,fontSize:10,fontWeight:"900",textTransform:"uppercase"},cardTitle:{color:colors.text,fontSize:20,fontWeight:"800"},price:{color:colors.text,fontSize:22,fontWeight:"900"}});
