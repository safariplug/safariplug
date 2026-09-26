import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { supabase } from "../src/auth";
import { API_BASE_URL } from "../src/config";
import { ErrorBlock, LoadingBlock } from "../src/components/StatusBlocks";
import { colors } from "../src/theme";

type RefundReview={status:string;resolution?:string|null;updated_at?:string|null};
type Booking={
  id:string;
  product:"hotel"|"transfer"|"activity";
  bookingId:string;
  label:string;
  providerReference?:string|null;
  currency:string;
  amount:number;
  paymentStatus:string;
  bookingStatus:string;
  createdAt:string;
  refundReview?:RefundReview|null;
};

const productLabel:Record<Booking["product"],string>={hotel:"Hotel",transfer:"Transfer",activity:"Activity"};

export default function TravelBookingsScreen(){
  const[items,setItems]=useState<Booking[]>([]);
  const[loading,setLoading]=useState(true);
  const[refreshing,setRefreshing]=useState(false);
  const[error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setError(null);
    try{
      const{data}=await supabase.auth.getSession();
      if(!data.session)throw new Error("Sign in to see your travel bookings.");
      const response=await fetch(`${API_BASE_URL}/api/account/travel-bookings`,{
        headers:{accept:"application/json",authorization:`Bearer ${data.session.access_token}`}
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body?.error||"Unable to load travel bookings.");
      setItems(Array.isArray(body.bookings)?body.bookings:[]);
    }catch(e){
      setError(e instanceof Error?e.message:"Unable to load travel bookings.");
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  },[]);

  useEffect(()=>{void load()},[load]);

  if(loading)return<SafeAreaView style={styles.safe}><LoadingBlock label="Loading travel bookings…"/></SafeAreaView>;
  if(error)return<SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><ErrorBlock message={error} onRetry={()=>void load()}/></ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <Stack.Screen options={{title:"Travel bookings"}}/>
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load()}}/>}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>My SafariPlug</Text>
        <Text style={styles.title}>Travel bookings</Text>
        <Text style={styles.body}>Hotels, transfers and activities in one place, including payment and refund-review status.</Text>
      </View>

      {!items.length?<View style={styles.empty}><Text style={styles.heading}>No travel bookings yet</Text><Text style={styles.body}>Your completed travel checkouts will appear here.</Text></View>:items.map(item=><View key={item.id} style={styles.card}>
        <View style={styles.row}>
          <View style={{flex:1}}>
            <Text style={styles.product}>{productLabel[item.product]}</Text>
            <Text style={styles.heading}>{item.label}</Text>
            <Text style={styles.body}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
          <Text style={styles.amount}>{item.currency} {Number(item.amount).toLocaleString()}</Text>
        </View>
        <View style={styles.divider}/>
        <View style={styles.row}>
          <Text style={styles.body}>Booking</Text>
          <Text style={styles.status}>{item.bookingStatus.replaceAll("_"," ")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.body}>Payment</Text>
          <Text style={styles.status}>{item.paymentStatus.replaceAll("_"," ")}</Text>
        </View>
        <Text style={styles.reference}>Supplier ref: {item.providerReference||"pending"}</Text>
        {item.refundReview?<View style={styles.review}><Text style={styles.reviewTitle}>{item.refundReview.status==="resolved"?"Refund review resolved":"Refund review in progress"}</Text><Text style={styles.reviewText}>{item.refundReview.resolution?String(item.refundReview.resolution).replaceAll("_"," "):"SafariPlug finance is reviewing this cancelled paid booking."}</Text></View>:null}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  page:{padding:20,gap:16,paddingBottom:48},
  hero:{borderRadius:26,backgroundColor:colors.forest,padding:22,gap:7},
  kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"800",letterSpacing:2,textTransform:"uppercase"},
  title:{color:colors.text,fontSize:30,fontWeight:"700"},
  body:{color:colors.textMuted,lineHeight:20},
  empty:{borderRadius:22,borderWidth:1,borderColor:colors.border,padding:20,gap:8},
  card:{borderRadius:22,borderWidth:1,borderColor:colors.border,backgroundColor:colors.bgCard,padding:18,gap:9},
  row:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12},
  product:{color:colors.goldSoft,fontSize:11,fontWeight:"800",textTransform:"uppercase",letterSpacing:1.2},
  heading:{color:colors.text,fontSize:18,fontWeight:"800",marginTop:4},
  amount:{color:colors.text,fontWeight:"900"},
  status:{color:colors.goldSoft,fontWeight:"800",textTransform:"capitalize"},
  divider:{height:1,backgroundColor:colors.border,marginVertical:2},
  reference:{color:colors.textMuted,fontSize:11},
  review:{borderRadius:14,borderWidth:1,borderColor:colors.gold,padding:12,backgroundColor:colors.forest},
  reviewTitle:{color:colors.goldSoft,fontWeight:"900"},
  reviewText:{color:colors.textMuted,fontSize:12,lineHeight:18,marginTop:3},
});
