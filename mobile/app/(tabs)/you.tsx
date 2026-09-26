import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "../../src/theme";
import { supabase } from "../../src/auth";

const ROWS: { label: string; hint: string; href?: string }[] = [
  { label: "My Trips", hint: "Itineraries when you are signed in", href: "/(tabs)/trips" },
  { label: "Restaurant Orders", hint: "Food orders and live delivery status", href: "/(tabs)/orders" },
  { label: "Service Bookings", hint: "Appointments, confirmations and payment state", href: "/(tabs)/appointments" },
  { label: "Saved", hint: "Saved experiences", href: "/(tabs)/saved" },
  { label: "Currency", hint: "Display KES — not a live FX engine" },
  { label: "Language", hint: "English" },
  { label: "Notifications", hint: "Appointment, finance and payout updates", href: "/notifications" },
  { label: "Help", hint: "SafariPlug support" },
  { label: "About SafariPlug", hint: "Discover. Plan. Experience Africa." },
];

export default function YouScreen() {
  const [email,setEmail]=useState<string|null>(null);
  const [staff,setStaff]=useState(false);

  useEffect(()=>{
    let active=true;
    async function load(){
      const {data:{session}}=await supabase.auth.getSession();
      if(!active)return;
      setEmail(session?.user?.email||null);
      if(session?.user&&!session.user.is_anonymous){
        const {data}=await supabase.rpc("is_staff_portal_user");
        if(active)setStaff(Boolean(data));
      }else{
        setStaff(false);
      }
    }
    void load();
    const {data:listener}=supabase.auth.onAuthStateChange(()=>{void load();});
    return()=>{active=false;listener.subscription.unsubscribe();};
  },[]);

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.kicker}>You</Text>
    <View style={styles.identity}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{email?email.slice(0,2).toUpperCase():"SP"}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{email?email.split("@")[0]:"Guest"}</Text>
        <Text style={styles.meta}>{email?email:"Sign in to manage bookings, trips and staff access."}</Text>
      </View>
    </View>

    {!email?<Pressable onPress={()=>router.push("/auth" as never)} style={styles.signIn}><Text style={styles.signInText}>Sign in</Text></Pressable>:null}
    {staff?<Pressable onPress={()=>router.push("/staff" as never)} style={styles.staffRow}><Text style={styles.staffLabel}>Staff Operations</Text><Text style={styles.staffHint}>Secure mobile overview for SafariPlug staff queues</Text></Pressable>:null}

    {ROWS.map(row=><Pressable key={row.label} onPress={row.href?()=>router.push(row.href as never):undefined} disabled={!row.href} style={styles.row}><Text style={styles.rowLabel}>{row.label}</Text><Text style={styles.rowHint}>{row.hint}</Text></Pressable>)}
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  page:{padding:20,paddingBottom:48,gap:10},
  kicker:{color:colors.gold,fontSize:11,fontWeight:"800",letterSpacing:3,textTransform:"uppercase"},
  identity:{flexDirection:"row",gap:14,alignItems:"center",marginVertical:12},
  avatar:{width:64,height:64,borderRadius:32,alignItems:"center",justifyContent:"center",backgroundColor:"#3A2416",borderWidth:1,borderColor:colors.gold},
  avatarText:{color:colors.sand,fontWeight:"800"},
  name:{color:colors.text,fontSize:24,fontWeight:"700"},
  meta:{color:colors.textMuted,marginTop:4,lineHeight:20},
  signIn:{borderRadius:18,padding:16,backgroundColor:colors.gold,alignItems:"center"},
  signInText:{color:colors.bg,fontWeight:"800"},
  staffRow:{borderRadius:18,padding:16,backgroundColor:"#2a1d10",borderWidth:1,borderColor:colors.gold},
  staffLabel:{color:colors.goldSoft,fontSize:16,fontWeight:"800"},
  staffHint:{color:colors.textMuted,marginTop:4,fontSize:13},
  row:{borderRadius:18,padding:16,backgroundColor:colors.bgCard,borderWidth:1,borderColor:colors.border},
  rowLabel:{color:colors.text,fontSize:16,fontWeight:"700"},
  rowHint:{color:colors.textMuted,marginTop:4,fontSize:13}
});
