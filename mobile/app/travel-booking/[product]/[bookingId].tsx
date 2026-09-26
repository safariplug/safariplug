import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../../src/auth";
import { API_BASE_URL } from "../../../src/config";
import { ErrorBlock, LoadingBlock } from "../../../src/components/StatusBlocks";
import { colors } from "../../../src/theme";

type Product="hotel"|"transfer"|"activity";

type ActionResult={
  status?:string;
  supplierStatus?:string;
  message?:string;
  refund?:string;
  refundReview?:{status?:string;resolution?:string|null}|null;
  ledger?:Record<string,unknown>|null;
  providerBooking?:unknown;
};

function endpoint(product:Product){
  if(product==="hotel")return"/api/v1/hotels/hotelbeds";
  if(product==="transfer")return"/api/v1/transfers/hotelbeds/checkout";
  return"/api/v1/activities/hotelbeds/checkout";
}

function pretty(value:string|undefined|null){
  return String(value||"pending").replaceAll("_"," ");
}

export default function TravelBookingDetailScreen(){
  const params=useLocalSearchParams<{
    product?:string;
    bookingId?:string;
    label?:string;
    bookingStatus?:string;
    paymentStatus?:string;
    currency?:string;
    amount?:string;
    providerReference?:string;
  }>();
  const product=(params.product||"hotel") as Product;
  const bookingId=String(params.bookingId||"");
  const[loading,setLoading]=useState(true);
  const[actionBusy,setActionBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[result,setResult]=useState<ActionResult|null>(null);
  const[bookingStatus,setBookingStatus]=useState(String(params.bookingStatus||"pending"));
  const[paymentStatus,setPaymentStatus]=useState(String(params.paymentStatus||"pending"));

  const title=useMemo(()=>String(params.label||`${product} booking`),[params.label,product]);

  const callAction=useCallback(async(action:"status"|"cancel")=>{
    const{data}=await supabase.auth.getSession();
    if(!data.session)throw new Error("Sign in to manage this booking.");
    const response=await fetch(`${API_BASE_URL}${endpoint(product)}`,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        accept:"application/json",
        authorization:`Bearer ${data.session.access_token}`,
      },
      body:JSON.stringify({
        action,
        bookingId,
        ...(action==="cancel"?{confirmCancellation:true}:{}),
      }),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body?.message||body?.error||"Unable to update booking.");
    return body as ActionResult;
  },[bookingId,product]);

  const refresh=useCallback(async()=>{
    if(!bookingId){setError("Booking ID is missing.");setLoading(false);return;}
    setError(null);
    try{
      const body=await callAction("status");
      setResult(body);
      if(body.status)setBookingStatus(body.status);
      const ledger=body.ledger&&typeof body.ledger==="object"?body.ledger:{};
      if(typeof ledger.paymentStatus==="string")setPaymentStatus(ledger.paymentStatus);
      else if(typeof ledger.payment_status==="string")setPaymentStatus(ledger.payment_status);
    }catch(e){
      setError(e instanceof Error?e.message:"Unable to refresh booking.");
    }finally{
      setLoading(false);
    }
  },[bookingId,callAction]);

  useEffect(()=>{void refresh()},[refresh]);

  const cancelBooking=useCallback(()=>{
    Alert.alert(
      "Cancel this booking?",
      "SafariPlug will first cancel with the supplier. If this is a paid booking, a finance refund review will be created automatically. Cancellation fees may apply.",
      [
        {text:"Keep booking",style:"cancel"},
        {text:"Cancel booking",style:"destructive",onPress:async()=>{
          setActionBusy(true);
          setError(null);
          try{
            const body=await callAction("cancel");
            setResult(body);
            setBookingStatus("cancelled");
            Alert.alert(
              "Booking cancelled",
              body.refundReview
                ?"The supplier cancellation succeeded and SafariPlug finance has received the refund review."
                :(body.refund||"The supplier cancellation succeeded.")
            );
          }catch(e){
            const message=e instanceof Error?e.message:"Unable to cancel booking.";
            setError(message);
            Alert.alert("Cancellation not completed",message);
          }finally{
            setActionBusy(false);
          }
        }},
      ]
    );
  },[callAction]);

  if(loading)return<SafeAreaView style={styles.safe}><LoadingBlock label="Refreshing booking status…"/></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <Stack.Screen options={{title:"Manage booking"}}/>
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={()=>router.back()}><Text style={styles.back}>← Travel bookings</Text></Pressable>

      <View style={styles.hero}>
        <Text style={styles.kicker}>{product}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>Supplier ref: {params.providerReference||"pending"}</Text>
      </View>

      {error?<ErrorBlock message={error} onRetry={()=>void refresh()}/>:null}

      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.label}>Booking status</Text><Text style={styles.value}>{pretty(bookingStatus)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Payment status</Text><Text style={styles.value}>{pretty(paymentStatus)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total</Text><Text style={styles.value}>{params.currency||"KES"} {Number(params.amount||0).toLocaleString()}</Text></View>
        {result?.supplierStatus?<View style={styles.row}><Text style={styles.label}>Supplier status</Text><Text style={styles.value}>{pretty(result.supplierStatus)}</Text></View>:null}
        {result?.message?<Text style={styles.notice}>{result.message}</Text>:null}
      </View>

      {result?.refundReview?<View style={styles.review}>
        <Text style={styles.reviewTitle}>{result.refundReview.status==="resolved"?"Refund review resolved":"Refund review in progress"}</Text>
        <Text style={styles.body}>{result.refundReview.resolution?pretty(result.refundReview.resolution):"SafariPlug finance is reviewing the payment outcome for this cancelled booking."}</Text>
      </View>:null}

      <Pressable disabled={actionBusy} onPress={()=>void refresh()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>{actionBusy?"Working…":"Refresh live status"}</Text>
      </Pressable>

      {bookingStatus==="confirmed"?<Pressable disabled={actionBusy} onPress={cancelBooking} style={styles.dangerButton}>
        <Text style={styles.dangerText}>{actionBusy?"Working…":"Cancel booking"}</Text>
      </Pressable>:null}

      {bookingStatus==="cancelled"?<View style={styles.cancelled}>
        <Text style={styles.cancelledTitle}>Cancelled</Text>
        <Text style={styles.body}>{result?.refund||"Any refund due will follow SafariPlug's finance review process."}</Text>
      </View>:null}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  page:{padding:20,paddingBottom:48,gap:16},
  back:{color:colors.goldSoft,fontWeight:"800"},
  hero:{borderRadius:24,backgroundColor:colors.forest,padding:22,gap:7},
  kicker:{color:colors.goldSoft,fontSize:10,fontWeight:"800",letterSpacing:2,textTransform:"uppercase"},
  title:{color:colors.text,fontSize:28,fontWeight:"800"},
  body:{color:colors.textMuted,lineHeight:20},
  card:{borderRadius:22,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border,padding:18,gap:12},
  row:{flexDirection:"row",justifyContent:"space-between",gap:14},
  label:{color:colors.textMuted},
  value:{color:colors.text,fontWeight:"800",textTransform:"capitalize",textAlign:"right",flex:1},
  notice:{color:colors.textMuted,lineHeight:20,borderTopWidth:1,borderTopColor:colors.border,paddingTop:12},
  review:{borderRadius:18,borderWidth:1,borderColor:colors.gold,padding:16,backgroundColor:colors.forest,gap:5},
  reviewTitle:{color:colors.goldSoft,fontWeight:"900"},
  secondaryButton:{borderRadius:16,borderWidth:1,borderColor:colors.gold,paddingVertical:14,alignItems:"center"},
  secondaryText:{color:colors.goldSoft,fontWeight:"900"},
  dangerButton:{borderRadius:16,backgroundColor:"#5a1717",paddingVertical:14,alignItems:"center"},
  dangerText:{color:"#fff",fontWeight:"900"},
  cancelled:{borderRadius:18,borderWidth:1,borderColor:colors.border,padding:16,gap:5},
  cancelledTitle:{color:colors.text,fontWeight:"900"},
});
