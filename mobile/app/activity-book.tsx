import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../src/config";
import { supabase } from "../src/auth";
import { colors } from "../src/theme";

type Pax={name:string;surname:string};
type Preflight={selectionToken:string;pricing?:{customerRetailAmount?:number;customerCurrency?:string};activity?:{name?:string;modalityName?:string;from?:string;to?:string;sessionName?:string|null;languageName?:string|null;freeCancellation?:boolean|null;comments?:string[];questions?:Array<{code:string;text:string;required:boolean}>;paxes?:Array<{age:number}>}};

export default function ActivityBookScreen(){
 const params=useLocalSearchParams<{selectionToken?:string;tripId?:string}>(); const token=String(params.selectionToken||"");
 const[preflight,setPreflight]=useState<Preflight|null>(null); const[loading,setLoading]=useState(true); const[busy,setBusy]=useState(false); const[accepted,setAccepted]=useState(false); const[error,setError]=useState("");
 const[holder,setHolder]=useState({name:"",surname:"",email:"",phone:""}); const[paxes,setPaxes]=useState<Pax[]>([]); const[answers,setAnswers]=useState<Record<string,string>>({});

 const headers=useCallback(async()=>{const{data}=await supabase.auth.getSession();if(!data.session)throw new Error("Sign in to book this activity.");return{"content-type":"application/json",accept:"application/json",authorization:"Bearer "+data.session.access_token};},[]);

 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch(API_BASE_URL+"/api/v1/activities/hotelbeds/checkout",{method:"POST",headers:await headers(),body:JSON.stringify({action:"preflight",selectionToken:token,currency:"KES"})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||"Unable to verify this activity rate.");if(active){setPreflight(b);const ages=Array.isArray(b?.activity?.paxes)?b.activity.paxes:[];setPaxes(ages.map(()=>({name:"",surname:""})));}}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to verify this activity.");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[headers,token]);

 function updatePax(i:number,key:keyof Pax,value:string){setPaxes(rows=>rows.map((p,n)=>n===i?{...p,[key]:value}:p));}

 async function checkout(){
  if(!preflight?.selectionToken||!accepted)return;
  if(!holder.name.trim()||!holder.surname.trim()||!holder.email.trim()||!holder.phone.trim()){setError("Holder name, email and international phone are required.");return;}
  if(paxes.some(p=>!p.name.trim()||!p.surname.trim())){setError("Enter every participant's first and last name.");return;}
  const questions=preflight.activity?.questions||[]; const missing=questions.find(q=>q.required&&!answers[q.code]?.trim()); if(missing){setError("Answer required: "+missing.text);return;}
  setBusy(true);setError("");
  try{
   const r=await fetch(API_BASE_URL+"/api/v1/activities/hotelbeds/checkout",{method:"POST",headers:await headers(),body:JSON.stringify({action:"prepare",idempotencyKey:"mobile-activity-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),selectionToken:preflight.selectionToken,currency:"KES",tripId:params.tripId||undefined,termsAccepted:true,customerPhone:holder.phone.trim(),holder:{name:holder.name.trim(),surname:holder.surname.trim(),email:holder.email.trim(),phone:holder.phone.trim()},paxes:paxes.map(p=>({name:p.name.trim(),surname:p.surname.trim()})),answers:questions.map(q=>({code:q.code,answer:answers[q.code]?.trim()||""}))})});
   const b=await r.json().catch(()=>({})); if(!r.ok)throw new Error(b?.message||b?.error||"Unable to start activity checkout."); if(!b?.bookingId)throw new Error("SafariPlug did not return an activity booking session.");
   Alert.alert("M-Pesa request sent","Complete payment on your phone. SafariPlug will reconfirm the activity only after payment succeeds.");
   router.replace({pathname:"/travel-booking/[product]/[bookingId]",params:{product:"activity",bookingId:String(b.bookingId),label:String(preflight.activity?.name||"Activity booking"),bookingStatus:String(b.status||"payment_pending"),paymentStatus:"pending",currency:String(preflight.pricing?.customerCurrency||"KES"),amount:String(preflight.pricing?.customerRetailAmount||0),providerReference:"",...(params.tripId?{tripId:String(params.tripId)}:{})}} as never);
  }catch(e){setError(e instanceof Error?e.message:"Unable to start activity checkout.");setBusy(false);}
 }

 const a=preflight?.activity; const price=preflight?.pricing;
 return <SafeAreaView style={styles.safe} edges={["top"]}><Stack.Screen options={{title:"Review activity"}}/><ScrollView contentContainerStyle={styles.page}>
  <View style={styles.hero}><Text style={styles.kicker}>Hotelbeds Activity</Text><Text style={styles.title}>{a?.name||"Review activity"}</Text><Text style={styles.body}>{[a?.modalityName,a?.from&&a?.to?a.from+" → "+a.to:null].filter(Boolean).join(" · ")}</Text></View>
  {loading?<Text style={styles.body}>Verifying live activity rate…</Text>:null}
  {a?<View style={styles.card}>{a.sessionName?<Text style={styles.body}>Session: {a.sessionName}</Text>:null}{a.languageName?<Text style={styles.body}>Language: {a.languageName}</Text>:null}{a.comments?.map((c,i)=><Text key={i} style={styles.muted}>• {c}</Text>)}</View>:null}
  <View style={styles.total}><Text style={styles.body}>Verified SafariPlug total</Text><Text style={styles.price}>{(price?.customerCurrency||"KES")+" "+Number(price?.customerRetailAmount||0).toLocaleString()}</Text></View>
  <View style={styles.card}><Text style={styles.heading}>Lead participant</Text><View style={styles.row}><TextInput value={holder.name} onChangeText={v=>setHolder({...holder,name:v})} placeholder="First name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={holder.surname} onChangeText={v=>setHolder({...holder,surname:v})} placeholder="Last name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View><TextInput value={holder.email} onChangeText={v=>setHolder({...holder,email:v})} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" style={styles.input}/><TextInput value={holder.phone} onChangeText={v=>setHolder({...holder,phone:v})} placeholder="+2547…" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" style={styles.input}/></View>
  <View style={styles.card}><Text style={styles.heading}>Participants</Text>{(a?.paxes||[]).map((p,i)=><View key={i} style={styles.participant}><Text style={styles.muted}>Participant {i+1} · age {p.age}</Text><View style={styles.row}><TextInput value={paxes[i]?.name||""} onChangeText={v=>updatePax(i,"name",v)} placeholder="First name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/><TextInput value={paxes[i]?.surname||""} onChangeText={v=>updatePax(i,"surname",v)} placeholder="Last name" placeholderTextColor={colors.textMuted} style={[styles.input,styles.flex]}/></View></View>)}</View>
  {(a?.questions||[]).length?<View style={styles.card}><Text style={styles.heading}>Supplier questions</Text>{(a?.questions||[]).map(q=><View key={q.code}><Text style={styles.body}>{q.text}{q.required?" *":""}</Text><TextInput value={answers[q.code]||""} onChangeText={v=>setAnswers({...answers,[q.code]:v})} style={styles.input}/></View>)}</View>:null}
  <View style={styles.accept}><Switch value={accepted} onValueChange={setAccepted}/><Text style={[styles.body,{flex:1}]}>I reviewed and accept the activity, price, dates, cancellation terms and supplier information.</Text></View>
  {error?<Text style={styles.error}>{error}</Text>:null}
  <Pressable disabled={loading||busy||!preflight||!accepted} onPress={()=>void checkout()} style={[styles.primary,(loading||busy||!accepted)&&styles.disabled]}><Text style={styles.primaryText}>{busy?"Holding activity & starting M-Pesa…":"Continue with M-Pesa"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},page:{padding:20,paddingBottom:48,gap:16},hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"900",letterSpacing:2,textTransform:"uppercase"},title:{color:colors.text,fontSize:28,fontWeight:"800"},body:{color:colors.textMuted,lineHeight:20},card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:10},heading:{color:colors.text,fontSize:18,fontWeight:"800"},muted:{color:colors.textMuted,fontSize:12,lineHeight:18},total:{borderRadius:18,borderWidth:1,borderColor:colors.gold,padding:16},price:{color:colors.text,fontSize:28,fontWeight:"900",marginTop:5},row:{flexDirection:"row",gap:8},flex:{flex:1},input:{borderRadius:13,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:13,paddingVertical:12},participant:{gap:8,borderTopWidth:1,borderTopColor:colors.border,paddingTop:10},accept:{flexDirection:"row",gap:12,alignItems:"center",borderRadius:18,borderWidth:1,borderColor:colors.border,padding:14},error:{color:"#f5a3a3",lineHeight:20},primary:{borderRadius:15,backgroundColor:colors.gold,paddingVertical:14,alignItems:"center"},disabled:{opacity:.45},primaryText:{color:colors.bg,fontWeight:"900"}});
