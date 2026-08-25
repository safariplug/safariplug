import { NextResponse } from "next/server";
import { runSalesScout } from "@/app/admin/ai-sales/actions/run-sales-scout";


export async function POST(
  request: Request
) {

  try {

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


  } catch (error: any) {


    console.error(
      "SALES SCOUT ERROR:",
      error
    );


    return NextResponse.json(

      {
        error:
          error.message ||
          "Sales Scout failed",
      },

      {
        status: 500,
      }

    );

  }

}