"use server";

import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EVENT_CATEGORIES } from "@/lib/constants/events";
import { revalidatePath } from "next/cache";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";

// Existing file content retained; model selection is centralized so production
// does not depend on an internal/non-public model identifier.
