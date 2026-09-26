import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { supabase } from "../src/auth";
import { API_BASE_URL } from "../src/config";
import { ErrorBlock, LoadingBlock } from "../src/components/StatusBlocks";
import { colors } from "../src/theme";

type Driver={display_name?:string|null;service_city?:string|null;service_country?:string|null};
type DriverRequest={id:string;pickup_label:string;destination_label:string;requested_at:string;passenger_count:number;notes?:string|null;quoted_amount?:number|null;currency:string;status:string;payment_status:string;paid_at?:string|null;driver?:Driver|null};

const labels:Record<string,string>={requested:"Awaiting driver",accepted:"Driver accepted",declined:"Declined",cancelled:"Cancelled",completed:"Completed"};

export default function DriverRequestsScreen(){
 const[items,setItems]=useState<DriverRequest[]>([]);
 const[loading,setLoading]=useState(true);
 const[refreshing,setRefreshing]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const[busy,setBusy]=useState("");
 const[phones,setPhones]=useState<Record<string,string>>({});

 const authHeaders=useCallback(async()=>{
  const{data}=await supabase.auth.getSession();
  if(!data.session)throw new Error("Sign in to manage driver requests.");
  return {accept:"application/json","content-type":"application/json",authorization:"Bearer "+data.session.access_token};
 },[]);

 const load=useCallback(async()=>{
  setError(null);
  try{
   const r=await fetch(API_BASE_URL+"/api/account/driver-requests",{headers:await authHeaders()});
   const b=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(b?.error||"Unable to load driver requests.");
   setItems(Array.isArray(b.requests)?b.requests:[]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load driver requests.");}
  finally{setLoading(false);setRefreshing(false);}
 },[authHeaders]);

 useEffect(()=>{void load()},[load]);

 const cancelRequest=useCallback((item:DriverRequest)=>{
  Alert.alert("Cancel driver request?","This is available only while the driver has not accepted.",[
   {text:"Keep request",style:"cancel"},
   {text:"Cancel request",style:"destructive",onPress:async()=>{
    setBusy(item.id+"cancel");
    try{
     const r=await fetch(API_BASE_URL+"/api/account/driver-requests",{method:"PATCH",headers:await authHeaders(),body:JSON.stringify({requestId:item.id,action:"cancel"})});
     const b=await r.json().catch(()=>({}));
     if(!r.ok)throw new Error(b?.error||"Unable to cancel request.");
     await load();
    }catch(e){const m=e instanceof Error?e.message:"Unable to cancel request.";setError(m);Alert.alert("Cancellation not completed",m);}
    finally{setBusy("");}
   }}
  ]);
 },[authHeaders,load]);

 const pay=useCallback(async(item:DriverRequest)=>{
  const phone=String(phones[item.id]||"").trim();
  if(!phone){Alert.alert("M-Pesa phone required","Enter the phone number that should receive the M-Pesa prompt.");return;}
  setBusy(item.id+"pay");
  try{
   const r=await fetch(API_BASE_URL+"/api/transfers/driver/mpesa",{method:"POST",headers:await authHeaders(),body:JSON.stringify({requestId:item.id,phone})});
   const b=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(b?.error||"Unable to start M-Pesa payment.");
   Alert.alert(b?.alreadyPaid?"Already paid":"M-Pesa request sent",b?.message||"Check your phone to complete payment.");
   await load();
  }catch(e){const m=e instanceof Error?e.message:"Unable to start payment.";setError(m);Alert.alert("Payment not started",m);}
  finally{setBusy("");}
 },[authHeaders,load,phones]);

 if(loading)return <SafeAreaView style={styles.safe}><LoadingBlock label="Loading driver requests…"/></SafeAreaView>;
 if(error&&!items.length)return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><ErrorBlock message={error} onRetry={()=>void load()}/></ScrollView></SafeAreaView>;

 return <SafeAreaView style={styles.safe} edges={["top"]}>
  <Stack.Screen options={{title:"Driver requests"}}/>
  <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
   <View style={styles.hero}><Text style={styles.kicker}>My SafariPlug</Text><Text style={styles.title}>Driver requests</Text><Text style={styles.body}>Track specific-driver requests from submission through acceptance, payment and completion.</Text></View>
   {error?<ErrorBlock message={error} onRetry={()=>void load()}/>:null}
   {!items.length?<View style={styles.empty}><Text style={styles.heading}>No driver requests yet</Text><Text style={styles.body}>Specific-driver requests you send will appear here.</Text></View>:items.map(item=><View key={item.id} style={styles.card}>
    <Text style={styles.status}>{labels[item.status]||item.status.replaceAll("_"," ")}</Text>
    <Text style={styles.heading}>{item.driver?.display_name||"SafariPlug driver"}</Text>
    <Text style={styles.route}>{item.pickup_label+" → "+item.destination_label}</Text>
    <Text style={styles.body}>{new Date(item.requested_at).toLocaleString()+" · "+item.passenger_count+" passenger"+(item.passenger_count===1?"":"s")}</Text>
    <View style={styles.divider}/>
    <View style={styles.row}><Text style={styles.body}>Payment</Text><Text style={styles.value}>{item.payment_status.replaceAll("_"," ")}</Text></View>
    {item.quoted_amount!=null?<View style={styles.row}><Text style={styles.body}>Quote</Text><Text style={styles.value}>{item.currency+" "+Number(item.quoted_amount).toLocaleString()}</Text></View>:<Text style={styles.body}>Custom quote requested</Text>}
    {item.notes?<Text style={styles.note}>{item.notes}</Text>:null}
    {item.status==="accepted"&&item.quoted_amount!=null&&item.payment_status!=="paid"?<View style={styles.payBox}>
     <Text style={styles.payTitle}>Pay with M-Pesa</Text>
     <TextInput value={phones[item.id]||""} onChangeText={value=>setPhones(current=>({...current,[item.id]:value}))} placeholder="2547XXXXXXXX" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" style={styles.input}/>
     <Pressable disabled={busy===item.id+"pay"} onPress={()=>void pay(item)} style={styles.primaryButton}><Text style={styles.primaryText}>{busy===item.id+"pay"?"Starting…":"Send M-Pesa prompt"}</Text></Pressable>
    </View>:null}
    {item.payment_status==="paid"?<Text style={styles.paid}>{"Payment received"+(item.paid_at?" · "+new Date(item.paid_at).toLocaleString():"")}</Text>:null}
    {item.status==="requested"?<Pressable disabled={busy===item.id+"cancel"} onPress={()=>cancelRequest(item)} style={styles.cancelButton}><Text style={styles.cancelText}>{busy===item.id+"cancel"?"Cancelling…":"Cancel request"}</Text></Pressable>:null}
   </View>)}
  </ScrollView>
 </SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},
 kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"800",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:30,fontWeight:"700"},body:{color:colors.textMuted,lineHeight:20},
 empty:{borderRadius:22,borderWidth:1,borderColor:colors.border,padding:20,gap:8},card:{borderRadius:22,borderWidth:1,borderColor:colors.border,backgroundColor:colors.bgCard,padding:18,gap:9},
 status:{color:colors.goldSoft,fontSize:11,fontWeight:"900",textTransform:"uppercase",letterSpacing:1},heading:{color:colors.text,fontSize:19,fontWeight:"800"},route:{color:colors.text,fontSize:16,fontWeight:"700"},
 divider:{height:1,backgroundColor:colors.border,marginVertical:3},row:{flexDirection:"row",justifyContent:"space-between",gap:10},value:{color:colors.text,fontWeight:"800",textTransform:"capitalize"},
 note:{color:colors.textMuted,lineHeight:20,borderRadius:12,backgroundColor:colors.forest,padding:12},payBox:{borderRadius:16,borderWidth:1,borderColor:colors.gold,padding:14,gap:10},payTitle:{color:colors.goldSoft,fontWeight:"900"},
 input:{borderRadius:12,borderWidth:1,borderColor:colors.border,paddingHorizontal:14,paddingVertical:12,color:colors.text},primaryButton:{borderRadius:14,backgroundColor:colors.gold,paddingVertical:13,alignItems:"center"},primaryText:{color:colors.bg,fontWeight:"900"},
 paid:{color:"#6dbf8b",fontWeight:"900"},cancelButton:{borderRadius:14,backgroundColor:"#5a1717",paddingVertical:13,alignItems:"center"},cancelText:{color:"#fff",fontWeight:"900"}
});
