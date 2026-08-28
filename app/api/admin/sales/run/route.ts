import { NextResponse } from "next/server";
import { runSalesScout } from "@/app/admin/ai-sales/actions/run-sales-scout";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";


export async function POST(
  request: Request
) {

  try {

    await requireAdmin();

    const body =
      await request.json();



    const formData =
      new FormData();



    formData.append(
      "city",
      body.city || "Nairobi"
    );


    formData.append(
      "category",
      body.category || "Hotels"
    );



    await runSalesScout(
      formData
    );



    return NextResponse.json({

      success: true,

      message:
        "Sales Scout completed successfully.",

    });


  } catch (error: unknown) {

    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }


    console.error(
      "SALES SCOUT ERROR:",
      error
    );


    return NextResponse.json(

      {
        error: error instanceof Error ? error.message : "Sales Scout failed",
      },

      {
        status: 500,
      }

    );

  }

}