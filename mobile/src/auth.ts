import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const hasBrowserRuntime = typeof window !== "undefined";

const testStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => undefined,
  removeItem: async (_key: string) => undefined,
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: hasBrowserRuntime ? AsyncStorage : testStorage,
    autoRefreshToken: hasBrowserRuntime,
    persistSession: hasBrowserRuntime,
    detectSessionInUrl: false,
  },
});

export function hasMobileSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export type AuthSession = Session;
