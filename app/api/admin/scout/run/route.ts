import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {

  const { data, error } = await supabaseAdmin
    .from("scout_runs")
    .insert({
      status: "running",
      discoveries_found: 0,
      notes: "Manual AI Scout discovery run started"
    })
    .select()
    .single();


  if (error) {
    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 500
      }
    );
  }


  return NextResponse.json({
    success: true,
    run: data
  });

}