"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

const clean=(value:FormDataEntryValue|null)=>String(value||"").trim();
const refresh=(id:string)=>{revalidatePath(`/admin/ai-sales/edit/${id}`);revalidatePath("/admin/crm");};

export async function addCRMContact(prospectId:string,formData:FormData){await requireAdmin();const full_name=clean(formData.get("full_name"));if(!full_name)throw new Error("Contact name is required.");const {error}=await supabaseAdmin.from("crm_contacts").insert({prospect_id:prospectId,full_name,job_title:clean(formData.get("job_title"))||null,email:clean(formData.get("email"))||null,phone:clean(formData.get("phone"))||null,linkedin_url:clean(formData.get("linkedin_url"))||null,source_url:clean(formData.get("source_url"))||null,notes:clean(formData.get("notes"))||null,is_primary:formData.get("is_primary")==="on"});if(error)throw new Error(error.message);await supabaseAdmin.from("crm_activities").insert({prospect_id:prospectId,activity_type:"note",summary:`Contact added: ${full_name}`});refresh(prospectId);}
export async function addCRMActivity(prospectId:string,formData:FormData){await requireAdmin();const summary=clean(formData.get("summary"));if(!summary)throw new Error("Activity summary is required.");const allowed=["research","note","call","email","whatsapp","meeting","stage_change","approval","system"];const requested=clean(formData.get("activity_type"));const activity_type=allowed.includes(requested)?requested:"note";const {error}=await supabaseAdmin.from("crm_activities").insert({prospect_id:prospectId,activity_type,summary,details:clean(formData.get("details"))||null});if(error)throw new Error(error.message);refresh(prospectId);}
export async function addCRMFollowup(prospectId:string,formData:FormData){await requireAdmin();const title=clean(formData.get("title"));const due=clean(formData.get("due_at"));if(!title||!due)throw new Error("Follow-up title and due date are required.");const due_at=new Date(due);if(Number.isNaN(due_at.getTime()))throw new Error("Follow-up due date is invalid.");const requested=clean(formData.get("priority"));const priority=["low","normal","high"].includes(requested)?requested:"normal";const {error}=await supabaseAdmin.from("crm_followups").insert({prospect_id:prospectId,title,due_at:due_at.toISOString(),priority,notes:clean(formData.get("notes"))||null});if(error)throw new Error(error.message);await supabaseAdmin.from("crm_activities").insert({prospect_id:prospectId,activity_type:"system",summary:`Follow-up scheduled: ${title}`,details:`Due ${due_at.toISOString()}`});refresh(prospectId);}
export async function completeCRMFollowup(prospectId:string,followupId:string){await requireAdmin();const now=new Date().toISOString();const {data,error}=await supabaseAdmin.from("crm_followups").update({status:"completed",completed_at:now,updated_at:now}).eq("id",followupId).eq("prospect_id",prospectId).select("title").single();if(error)throw new Error(error.message);await supabaseAdmin.from("crm_activities").insert({prospect_id:prospectId,activity_type:"system",summary:`Follow-up completed: ${data.title}`});refresh(prospectId);}

export async function approveSalesProspect(id: string) {
  await requireAdmin();
  const { data: prospect, error: prospectError } = await supabaseAdmin.from("ai_sales_prospects").select("*").eq("id", id).single();
  if (prospectError || !prospect) throw new Error(prospectError?.message || "Sales prospect not found.");
  const { data: existingPartner, error: partnerLookupError } = await supabaseAdmin.from("safari_partners").select("id").eq("venue_or_promoter_name", prospect.business_name).maybeSingle();
  if (partnerLookupError) throw new Error(partnerLookupError.message);
  if (!existingPartner) {
    const { error: partnerInsertError } = await supabaseAdmin.from("safari_partners").insert({venue_or_promoter_name: prospect.business_name,contact_person: null,email_or_phone: prospect.contact_email || prospect.phone || null,instagram_handle: prospect.instagram || null,outreach_stage: "prospect",notes: [prospect.description,prospect.website ? `Website: ${prospect.website}` : null,prospect.facebook ? `Facebook: ${prospect.facebook}` : null,prospect.source_name ? `Source: ${prospect.source_name}` : null,prospect.source_url ? `Source URL: ${prospect.source_url}` : null,prospect.notes || null].filter(Boolean).join("\n")});
    if (partnerInsertError) throw new Error(`Partner CRM persistence failed: ${partnerInsertError.message}`);
  }
  const { error: prospectUpdateError } = await supabaseAdmin.from("ai_sales_prospects").update({status: "partner",review_status: "approved",updated_at: new Date().toISOString()}).eq("id", id);
  if (prospectUpdateError) throw new Error(prospectUpdateError.message);
  await supabaseAdmin.from("crm_activities").insert({prospect_id:id,partner_id:existingPartner?.id||null,activity_type:"approval",summary:"Prospect approved for Partner CRM"});
  revalidatePath("/admin/ai-sales");revalidatePath("/admin/ai-sales/partners");revalidatePath("/admin/crm");redirect("/admin/ai-sales");
}
export async function rejectSalesProspect(id: string) {await requireAdmin();const { error }=await supabaseAdmin.from("ai_sales_prospects").update({status:"rejected",review_status:"rejected",updated_at:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);await supabaseAdmin.from("crm_activities").insert({prospect_id:id,activity_type:"approval",summary:"Prospect rejected"});revalidatePath("/admin/ai-sales");revalidatePath("/admin/crm");redirect("/admin/ai-sales");}
