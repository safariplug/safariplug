import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { apiGet, ApiError } from "../src/api/client";
import { colors } from "../src/theme";

type StaffOverview = {
  role:string;
  email:string|null;
  queues:{
    supplierReviews:number;
    refundReviews:number;
    payoutActions:number;
    eventReviews:number;
    verificationReviews:number;
  };
};

const QUEUES=[
  {key:"supplierReviews",label:"Supplier reviews",hint:"Submitted suppliers waiting for staff decision"},
  {key:"refundReviews",label:"Refund reviews",hint:"Paid service cancellations needing finance review"},
  {key:"payoutActions",label:"Payout actions",hint:"Eligible, approved, processing, held or failed payouts"},
  {key:"eventReviews",label:"Event reviews",hint:"AI-discovered events still awaiting curation"},
  {key:"verificationReviews",label:"Verification reviews",hint:"Traveler, provider, driver or specialist trust cases"},
] as const;

export default function StaffScreen(){
  const [data,setData]=useState<StaffOverview|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");

  async function load(background=false){
    if(background)setRefreshing(true);else setLoading(true);
    setError("");
    try{
      const response=await apiGet<StaffOverview>("/staff/overview",undefined,true);
      setData(response.data);
    }catch(err){
      const message=err instanceof ApiError?err.message:"Unable to load staff operations.";
      setError(message);
      if(err instanceof ApiError&&(err.status===401||err.status===403)) setData(null);
    }finally{
      setLoading(false);setRefreshing(false);
    }
  }

  useEffect(()=>{void load();},[]);

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={colors.gold}/>}>
      <Pressable onPress={()=>router.back()}><Text style={styles.back}>← Back</Text></Pressable>
      <Text style={styles.kicker}>SafariPlug Staff</Text>
      <Text style={styles.title}>Operations at a glance.</Text>
      <Text style={styles.body}>This mobile staff view uses your signed-in SafariPlug account and server-side staff authorization. Financial and verification decisions remain in the governed admin workspaces.</Text>

      {loading?<View style={styles.center}><ActivityIndicator color={colors.gold}/></View>:null}
      {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text>{!data?<Pressable onPress={()=>router.replace("/auth?next=/staff" as never)} style={styles.button}><Text style={styles.buttonText}>Sign in with staff account</Text></Pressable>:null}</View>:null}

      {data?<>
        <View style={styles.identity}><Text style={styles.identityTitle}>{data.email||"SafariPlug staff"}</Text><Text style={styles.identityMeta}>{data.role.replaceAll("_"," ")}</Text></View>
        <View style={styles.grid}>
          {QUEUES.map(item=>{
            const value=data.queues[item.key];
            return <View key={item.key} style={[styles.card,value>0&&styles.cardAttention]}><Text style={styles.cardLabel}>{item.label}</Text><Text style={styles.cardValue}>{value}</Text><Text style={styles.cardHint}>{item.hint}</Text></View>;
          })}
        </View>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Governed actions stay protected</Text><Text style={styles.noticeBody}>Use the web Command Center for approvals, payouts, refunds and verification decisions. This mobile screen is a secure operations overview, not a bypass around those controls.</Text></View>
      </>:null}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  page:{padding:20,paddingBottom:48,gap:14},
  back:{color:colors.goldSoft,fontWeight:"700"},
  kicker:{color:colors.gold,fontSize:11,fontWeight:"800",letterSpacing:2.5,textTransform:"uppercase",marginTop:8},
  title:{color:colors.text,fontSize:34,lineHeight:39,fontWeight:"700"},
  body:{color:colors.textMuted,fontSize:14,lineHeight:21},
  center:{paddingVertical:36,alignItems:"center"},
  error:{borderRadius:18,padding:16,backgroundColor:"#321c19",borderWidth:1,borderColor:"#63302a",gap:12},
  errorText:{color:"#f0b0a8",lineHeight:20},
  button:{borderRadius:14,backgroundColor:colors.gold,paddingVertical:13,paddingHorizontal:16,alignItems:"center"},
  buttonText:{color:colors.bg,fontWeight:"800"},
  identity:{borderRadius:18,padding:16,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border},
  identityTitle:{color:colors.text,fontSize:16,fontWeight:"700"},
  identityMeta:{color:colors.goldSoft,fontSize:12,marginTop:4,textTransform:"capitalize"},
  grid:{gap:10},
  card:{borderRadius:18,padding:18,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border},
  cardAttention:{borderColor:colors.gold},
  cardLabel:{color:colors.textMuted,fontSize:12,fontWeight:"700",textTransform:"uppercase",letterSpacing:1.2},
  cardValue:{color:colors.text,fontSize:34,fontWeight:"800",marginTop:6},
  cardHint:{color:colors.textMuted,fontSize:12,lineHeight:18,marginTop:4},
  notice:{borderRadius:18,padding:18,backgroundColor:"#21170f",borderWidth:1,borderColor:"#4b3520"},
  noticeTitle:{color:colors.goldSoft,fontWeight:"800"},
  noticeBody:{color:colors.textMuted,fontSize:12,lineHeight:19,marginTop:6},
});
