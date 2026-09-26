import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { colors } from "../src/theme";

type Activity={code:string;name:string;description?:string|null;currency?:string|null;amountsFrom?:Array<{amount?:number|null}>};
type Selection={selectionToken:string;supplierAmount:number;supplierCurrency:string;activityName:string;modalityName:string;from:string;to:string;freeCancellation?:boolean|null;session?:{name?:string|null}|null;language?:{name?:string|null}|null};

export default function LiveActivitiesScreen(){
 const params=useLocalSearchParams<{tripId?:string}>();
 const tripId=Array.isArray(params.tripId)?params.tripId[0]:params.tripId;
 const[destinationCode,setDestinationCode]=useState("");
 const[from,setFrom]=useState("");
 const[to,setTo]=useState("");
 const[ages,setAges]=useState("35,32");
 const[text,setText]=useState("");
 const[activities,setActivities]=useState<Activity[]>([]);
 const[selections,setSelections]=useState<Selection[]>([]);
 const[selected,setSelected]=useState<Activity|null>(null);
 const[busy,setBusy]=useState("");
 const[error,setError]=useState("");

 function paxes(){return ages.split(",").map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>=0&&v<=120).map(age=>({age}));}

 async function search(){
  const pax=paxes(); if(!destinationCode.trim()||!from||!to||!pax.length){setError("Destination code, dates and at least one passenger age are required.");return;}
  setBusy("search");setError("");setActivities([]);setSelections([]);setSelected(null);
  try{
   const r=await fetch(API_BASE_URL+"/api/v1/activities/hotelbeds",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"search",destinationCode:destinationCode.trim(),from,to,paxes:pax,text:text.trim()||undefined})});
   const b=await r.json().catch(()=>({})); if(!r.ok)throw new Error(b?.message||"Unable to search live activities.");
   const rows=Array.isArray(b.results)?b.results:[]; setActivities(rows); if(!rows.length)setError("No live activities were returned.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to search activities.");}finally{setBusy("");}
 }

 async function details(activity:Activity){
  setSelected(activity);setSelections([]);setBusy("details");setError("");
  try{
   const r=await fetch(API_BASE_URL+"/api/v1/activities/hotelbeds",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"details",code:activity.code,from,to,paxes:paxes()})});
   const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to load live activity options.");
   const rows=Array.isArray(b.results)?b.results:[];setSelections(rows);if(!rows.length)setError("No bookable live rate was returned.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load activity details.");}finally{setBusy("");}
 }

 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"Live activities"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>Hotelbeds Activities</Text><Text style={styles.title}>Tours, tickets & activities</Text><Text style={styles.body}>Search supplier inventory, review a live modality, then pay through SafariPlug.</Text></View>
  {!selected?<View style={styles.form}>
   <TextInput value={destinationCode} onChangeText={setDestinationCode} placeholder="Hotelbeds destination code" placeholderTextColor={colors.textMuted} autoCapitalize="characters" style={styles.input}/>
   <View style={styles.row}><TextInput value={from} onChangeText={setFrom} placeholder="From YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={to} onChangeText={setTo} placeholder="To YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View>
   <TextInput value={ages} onChangeText={setAges} placeholder="Passenger ages, e.g. 35,32,8" placeholderTextColor={colors.textMuted} style={styles.input}/>
   <TextInput value={text} onChangeText={setText} placeholder="Optional keyword, e.g. safari" placeholderTextColor={colors.textMuted} style={styles.input}/>
   <Pressable disabled={busy!==""} onPress={()=>void search()} style={styles.primary}><Text style={styles.primaryText}>{busy==="search"?"Searching…":"Search live activities"}</Text></Pressable>
  </View>:<Pressable onPress={()=>{setSelected(null);setSelections([]);setError("");}}><Text style={styles.back}>← Back to results</Text></Pressable>}
  {error?<Text style={styles.error}>{error}</Text>:null}
  {!selected?activities.map(a=><View key={a.code} style={styles.card}><Text style={styles.provider}>Hotelbeds activity</Text><Text style={styles.cardTitle}>{a.name}</Text>{a.description?<Text style={styles.body}>{a.description}</Text>:null}{a.amountsFrom?.[0]?.amount!=null?<Text style={styles.price}>{"From "+(a.currency||"")+" "+Number(a.amountsFrom[0].amount).toLocaleString()}</Text>:null}<Pressable disabled={busy!==""} onPress={()=>void details(a)} style={styles.primary}><Text style={styles.primaryText}>{busy==="details"?"Checking…":"See live options"}</Text></Pressable></View>):selections.map((s,i)=><View key={s.selectionToken} style={styles.card}><Text style={styles.provider}>Option {i+1}</Text><Text style={styles.cardTitle}>{s.modalityName}</Text><Text style={styles.body}>{s.from+" → "+s.to}</Text>{s.session?.name?<Text style={styles.body}>Session: {s.session.name}</Text>:null}{s.language?.name?<Text style={styles.body}>Language: {s.language.name}</Text>:null}<Text style={styles.price}>{s.supplierCurrency+" "+Number(s.supplierAmount).toLocaleString()}</Text><Text style={styles.body}>{s.freeCancellation===true?"Free cancellation":s.freeCancellation===false?"Cancellation penalties may apply":""}</Text><Pressable onPress={()=>router.push({pathname:"/activity-book",params:{selectionToken:s.selectionToken,...(tripId?{tripId}: {})}} as never)} style={styles.primary}><Text style={styles.primaryText}>Review & book</Text></Pressable></View>)}
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:30,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},form:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:16,gap:10},input:{borderRadius:14,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:14,paddingVertical:12},row:{flexDirection:"row",gap:8},flex:{flex:1},primary:{borderRadius:14,backgroundColor:colors.gold,paddingVertical:13,alignItems:"center",marginTop:4},primaryText:{color:colors.bg,fontWeight:"900"},back:{color:colors.goldSoft,fontWeight:"800"},error:{color:"#f5a3a3",lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:8},provider:{color:colors.goldSoft,fontSize:10,fontWeight:"900",textTransform:"uppercase"},cardTitle:{color:colors.text,fontSize:20,fontWeight:"800"},price:{color:colors.text,fontSize:22,fontWeight:"900"}});
