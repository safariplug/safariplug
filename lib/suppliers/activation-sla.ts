export type ActivationSlaState = {
  key:"on_track"|"due_soon"|"overdue"|"waiting_supplier"|"complete"|"closed";
  label:string;
  owner:"staff"|"supplier"|"none";
  targetHours:number|null;
  ageHours:number|null;
  overdueHours:number;
};

function hoursSince(value:string|null|undefined,nowMs:number){
  if(!value)return null;
  const time=Date.parse(value);
  if(!Number.isFinite(time))return null;
  return Math.max(0,(nowMs-time)/3600000);
}

export function supplierActivationSla(input:{
  onboardingStatus:string;
  submittedAt?:string|null;
  reviewRequestedAt?:string|null;
  updatedAt?:string|null;
  hasPlatformOnlyBlockers?:boolean;
  earlyReviewWaiting?:boolean;
  nowMs?:number;
}):ActivationSlaState{
  const now=input.nowMs??Date.now();
  const status=input.onboardingStatus;

  if(["approved","live"].includes(status))return{key:"complete",label:"Activation complete",owner:"none",targetHours:null,ageHours:null,overdueHours:0};
  if(status==="rejected")return{key:"closed",label:"Closed",owner:"none",targetHours:null,ageHours:null,overdueHours:0};
  if(status==="changes_requested"){
    const age=hoursSince(input.reviewRequestedAt||input.updatedAt,now);
    return{key:"waiting_supplier",label:age!==null&&age>72?"Supplier response overdue":"Waiting on supplier",owner:"supplier",targetHours:72,ageHours:age,overdueHours:age===null?0:Math.max(0,age-72)};
  }

  const staffTarget=input.earlyReviewWaiting?24:input.hasPlatformOnlyBlockers?24:status==="submitted"?24:null;
  if(staffTarget!==null){
    const start=input.earlyReviewWaiting?(input.reviewRequestedAt||input.updatedAt):(input.submittedAt||input.updatedAt);
    const age=hoursSince(start,now);
    if(age===null)return{key:"on_track",label:"Staff action queued",owner:"staff",targetHours:staffTarget,ageHours:null,overdueHours:0};
    if(age>staffTarget)return{key:"overdue",label:"SafariPlug SLA overdue",owner:"staff",targetHours:staffTarget,ageHours:age,overdueHours:age-staffTarget};
    if(age>=staffTarget*0.75)return{key:"due_soon",label:"SafariPlug action due soon",owner:"staff",targetHours:staffTarget,ageHours:age,overdueHours:0};
    return{key:"on_track",label:"SafariPlug action on track",owner:"staff",targetHours:staffTarget,ageHours:age,overdueHours:0};
  }

  return{key:"waiting_supplier",label:"Supplier activation in progress",owner:"supplier",targetHours:null,ageHours:hoursSince(input.updatedAt,now),overdueHours:0};
}
