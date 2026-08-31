"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PartnerSignupPage() {

  const router = useRouter();

  

  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    business_name: "",
    business_type: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  setLoading(true);
  setMessage("");

  try {

    const {
      data,
      error
    } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });


    if (error) throw error;


    const user = data.user;


    if (!user) {
      throw new Error("Unable to create account");
    }


    const {
      error: profileError
    } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        user_type: "partner",
      });


    if (profileError) throw profileError;


    const {
      error: businessError
    } = await supabase
      .from("businesses")
      .insert({
        owner_id: user.id,
        name: form.business_name,
        slug: form.business_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now(),
        business_type: form.business_type,
        phone: form.phone,
        whatsapp: form.phone,
        email: form.email,
        status: "ACTIVE",
        verified: false,
        claimed: false,
      });


    if (businessError) throw businessError;


    setMessage(
      "Partner account created successfully."
    );


    router.push("/partner/dashboard");


  } catch (err) {

    setMessage(
      err instanceof Error
        ? err.message
        : "Signup failed"
    );

  } finally {

    setLoading(false);

  }
}

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">

      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <Link
            href="/"
            className="text-2xl font-black"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>
        </div>
      </header>


      <section className="mx-auto max-w-xl px-6 py-12">

        <div className="rounded-3xl bg-white p-8 shadow-sm">

          <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
            Partner Registration
          </p>

          <h1 className="mt-3 text-3xl font-black">
            List your experiences on SafariPlug
          </h1>

          <p className="mt-3 text-slate-500">
            Create your partner account and start submitting events,
            activities and experiences across East Africa.
          </p>


          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4"
          >

            <input
  required
  placeholder="Full name"
  value={form.full_name}
  onChange={(e) =>
    setForm({
      ...form,
      full_name: e.target.value,
    })
  }
  className="w-full rounded-xl border px-4 py-3"
/>

            <input
  required
  type="email"
  placeholder="Email address"
  value={form.email}
  onChange={(e) =>
    setForm({
      ...form,
      email: e.target.value,
    })
  }
  className="w-full rounded-xl border px-4 py-3"
/>

            <input
  required
  placeholder="Phone / WhatsApp number"
  value={form.phone}
  onChange={(e) =>
    setForm({
      ...form,
      phone: e.target.value,
    })
  }
  className="w-full rounded-xl border px-4 py-3"
/>

            <input
  required
  placeholder="Business name"
  value={form.business_name}
  onChange={(e) =>
    setForm({
      ...form,
      business_name: e.target.value,
    })
  }
  className="w-full rounded-xl border px-4 py-3"
/>


            <select
  required
  value={form.business_type}
  onChange={(e) =>
    setForm({
      ...form,
      business_type: e.target.value,
    })
  }
  className="w-full rounded-xl border px-4 py-3"
>
  <option value="">
    Select business type
  </option>

  <option value="Restaurant">
    Restaurant
  </option>

  <option value="Hotel">
    Hotel
  </option>

  <option value="Tour Operator">
    Tour Operator
  </option>

  <option value="Event Organizer">
    Event Organizer
  </option>

  <option value="Experience Provider">
    Experience Provider
  </option>

</select>


            <input
  required
  type="password"
  placeholder="Password"
  value={form.password}
  onChange={(e) =>
    setForm({
      ...form,
      password: e.target.value,
    })
  }
  className="w-full rounded-xl border px-4 py-3"
/>

{message && (
  <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">
    {message}
  </div>
)}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 py-3 font-black text-white hover:bg-orange-600"
            >
              {loading
                ? "Creating account..."
                : "Create Partner Account"}
            </button>

          </form>


          <p className="mt-6 text-center text-sm text-slate-500">
            Already a partner?{" "}
            <Link
              href="/partner/login"
              className="font-bold text-orange-500"
            >
              Sign in
            </Link>
          </p>

        </div>

      </section>

    </main>
  );
}
