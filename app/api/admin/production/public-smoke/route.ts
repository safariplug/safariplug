import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const ROUTES=["/","/hotels","/experiences","/activities","/events","/transfers","/drivers","/restaurants","/services","/destinations","/about","/contact","/privacy","/terms"];
const HOME_MARKERS=["One SafariPlug. Your whole trip.","SafariPlug — One place for your whole trip across Africa"];
const MARKERS=new Map<string,string[]>([
  ["/contact",["info@safariplug.com","+254 768 240 096"]],
  ["/about",["One place to put the whole trip together"]],
  ["/privacy",["Privacy Policy"]],
  ["/terms",["Terms of Use"]],
  ["/destinations",["Start with a destination"]],
]);

async function fetchText(base:string,path:string,redirect:RequestRedirect="follow"){
  const response=await fetch(base+path,{cache:"no-store",redirect,headers:{"user-agent":"SafariPlug-Launch-Gate/1.0"}});
  const text=await response.text();
  return {response,text};
}

export async function POST(){
  try{
    const admin=await requireAdmin();
    const base=(process.env.SAFARIPLUG_BASE_URL||process.env.NEXT_PUBLIC_APP_URL||"https://www.safariplug.com").replace(/\/$/,"");
    const failures:string[]=[];
    const checks:Array<{path:string;status:number;ok:boolean;detail:string}>=[];

    for(const path of ROUTES){
      try{
        const {response,text}=await fetchText(base,path);
        const contentType=response.headers.get("content-type")||"";
        const usableHtml=response.ok&&contentType.includes("text/html")&&text.length>200&&!/404|not found/i.test(text.slice(0,1000));
        const markers=path==="/"?HOME_MARKERS:(MARKERS.get(path)||[]);
        const missing=markers.filter((marker)=>!text.includes(marker));
        const ok=usableHtml&&missing.length===0;
        if(!usableHtml)failures.push(path+": expected usable HTML 200, received "+response.status+" "+contentType);
        for(const marker of missing)failures.push(path+': missing marker "'+marker+'"');
        checks.push({path,status:response.status,ok,detail:ok?"ok":missing.length?"missing "+missing.join(", "):"unusable response"});
      }catch(error){
        const detail=error instanceof Error?error.message:String(error);
        failures.push(path+": "+detail);
        checks.push({path,status:0,ok:false,detail});
      }
    }

    try{
      const {response}=await fetchText(base,"/account","manual");
      const location=response.headers.get("location")||"";
      const ok=[301,302,303,307,308].includes(response.status)&&location.includes("/login")&&location.includes("next=");
      if(!ok)failures.push("/account: expected auth redirect preserving next destination; got "+response.status+" -> "+location);
      checks.push({path:"/account",status:response.status,ok,detail:location||"no location"});
    }catch(error){
      const detail=error instanceof Error?error.message:String(error);
      failures.push("/account: "+detail);
      checks.push({path:"/account",status:0,ok:false,detail});
    }

    let version:any=null;
    try{
      const response=await fetch(base+"/api/version",{cache:"no-store",headers:{"user-agent":"SafariPlug-Launch-Gate/1.0"}});
      version=await response.json().catch(()=>null);
      const ok=response.ok&&version?.service==="SafariPlug";
      if(!ok)failures.push("/api/version: expected SafariPlug JSON response, received "+response.status);
      checks.push({path:"/api/version",status:response.status,ok,detail:version?JSON.stringify(version):"invalid JSON"});
    }catch(error){
      const detail=error instanceof Error?error.message:String(error);
      failures.push("/api/version: "+detail);
      checks.push({path:"/api/version",status:0,ok:false,detail});
    }

    const now=new Date().toISOString();
    const status=failures.length?"failed":"passed";
    const note=failures.length
      ?"Automated public smoke failed: "+failures.slice(0,8).join(" | ")
      :"Automated public smoke passed for core marketplace, trust/legal, destination, auth redirect and version surfaces. Production version: "+(version?.commit||"commit unavailable")+".";

    const {error}=await supabaseAdmin.from("production_launch_checks").upsert({
      check_key:"public_smoke",status,note:note.slice(0,2000),verified_by:admin.id,verified_at:now,updated_at:now,
    },{onConflict:"check_key"});
    if(error)return NextResponse.json({error:error.message},{status:500});

    return NextResponse.json({ok:failures.length===0,status,base,version,failures,checks,verifiedAt:now});
  }catch(error){
    if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Unable to run production smoke."},{status:500});
  }
}