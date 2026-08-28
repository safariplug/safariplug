"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { discoverBusinesses } from "./discovery";
import { scoreProspect } from "./scoring";


function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}



export async function runSalesScout(
  formData: FormData
) {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      throw new Error(error.message);
    }

    console.error("SALES ACTION AUTH ERROR:", error);
    throw new Error(
      error instanceof Error ? error.message : "Request failed"
    );
  }

  const city =
    cleanText(
      formData.get("city")
    ) || "Nairobi";


  const category =
    cleanText(
      formData.get("category")
    ) || "Hotels";



  const prospects =
    await discoverBusinesses(
      city,
      category
    );



  for (const prospect of prospects) {


    const intelligence =
      scoreProspect({

        business_name:
          prospect.business_name,

        category:
          prospect.category,

        city:
          prospect.city,

      });



    const { data: existingProspect } =
      await supabaseAdmin
        .from("ai_sales_prospects")
        .select("id")
        .eq(
          "business_name",
          prospect.business_name
        )
        .eq(
          "city",
          city
        )
        .maybeSingle();



    if (existingProspect) {
      continue;
    }



    const { error } =
      await supabaseAdmin
        .from("ai_sales_prospects")
        .insert({

          business_name:
            prospect.business_name,


          category:
            prospect.category,


          city:
            prospect.city,


          website:
            prospect.website,


          instagram:
            prospect.instagram,


          description:
            prospect.description,


          opportunity_score:
            intelligence.score,


          notes:
            [
              `${intelligence.priority} priority. ${intelligence.reason}`,
              prospect.notes,
            ]
              .filter(Boolean)
              .join("\n"),


          status:
            "pending_review",


          review_status:
            "pending_review",

        });



    if (error) {

      console.error(
        "Sales Scout error:",
        error
      );

      throw new Error(
        error.message
      );

    }

  }



  revalidatePath(
    "/admin/ai-sales"
  );

}