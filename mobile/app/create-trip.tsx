import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { apiPost } from "../src/api/client";
import { colors } from "../src/theme";

type Trip={id:string;title?:string|null;start_on?:string|null;end_on?:string|null};

export default function CreateTripScreen(){
 const[title,setTitle]=useState("");
 const[startOn,setStartOn]=useState("");
 const[endOn,setEndOn]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");

 async function create(){
  setBusy(true);setError("");
  try{
   if(startOn&&endOn&&endOn<startOn)throw new Error("End date must be after the start date.");
   const result=await apiPost<Trip>("/trips",{title:title.trim()||undefined,start_on:startOn||undefined,end_on:endOn||undefined},true);
   if(!result.data?.id)throw new Error("SafariPlug did not return the new trip.");
   router.replace({pathname:"/trip/[tripId]",params:{tripId:result.data.id}});
  }catch(e){setError(e instanceof Error?e.message:"Unable to create trip.");setBusy(false);}
 }

 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"New trip"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>SafariPlug Journey</Text><Text style={styles.title}>Start a new trip</Text><Text style={styles.body}>Create the journey here, then add hotels, transfers, food, services and activities without leaving the app.</Text></View>
  <View style={styles.card}>
   <Text style={styles.label}>Trip name</Text><TextInput value={title} onChangeText={setTitle} placeholder="Diani weekend, Nairobi business trip…" placeholderTextColor={colors.textMuted} style={styles.input}/>
   <Text style={styles.label}>Start date</Text><TextInput value={startOn} onChangeText={setStartOn} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={colors.textMuted} style={styles.input}/>
   <Text style={styles.label}>End date</Text><TextInput value={endOn} onChangeText={setEndOn} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={colors.textMuted} style={styles.input}/>
  </View>
  {error?<Text style={styles.error}>{error}</Text>:null}
  <Pressable disabled={busy} onPress={()=>void create()} style={styles.primary}><Text style={styles.primaryText}>{busy?"Creating trip…":"Create trip"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:30,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:10},label:{color:colors.text,fontWeight:"800",marginTop:4},input:{borderRadius:14,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:14,paddingVertical:12},error:{color:"#f5a3a3",lineHeight:20},primary:{borderRadius:15,backgroundColor:colors.gold,paddingVertical:14,alignItems:"center"},primaryText:{color:colors.bg,fontWeight:"900"}});
