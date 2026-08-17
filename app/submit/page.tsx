"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

type City = {
  id: string;
  name: string;
  slug: string;
};

const categories = EVENT_CATEGORIES;

export default function SubmitEventPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    city_id: "",
    venue_name: "",
    venue_address: "",
    category: "",
    start_at: "",
    end_at: "",
    price: "",
    currency: "KES",
    booking_url: "",
    source_url: "",
    organizer_name: "",
    organizer_contact: "",
  });

  useEffect(() => {
    async function loadCities() {
      setLoadingCities(true);

      const { data, error } = await supabase
        .from("cities")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading cities:", error);
        setError("Unable to load cities. Please refresh and try again.");
      } else {
        setCities((data || []) as City[]);
      }

      setLoadingCities(false);
    }

    loadCities();
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function createSlug(title: string) {
    return (
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-") +
      "-" +
      Date.now()
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess(false);

    if (!form.title.trim()) {
      setError("Please enter an event title.");
      setSubmitting(false);
      return;
    }

    if (!form.city_id) {
      setError("Please select a city.");
      setSubmitting(false);
      return;
    }

    if (!form.category) {
      setError("Please select a category.");
      setSubmitting(false);
      return;
    }

    if (!form.start_at) {
      setError("Please select the event date and time.");
      setSubmitting(false);
      return;
    }

    if (!form.venue_name.trim()) {
      setError("Please enter the venue name.");
      setSubmitting(false);
      return;
    }

    if (!form.organizer_name.trim()) {
      setError("Please enter the organizer name.");
      setSubmitting(false);
      return;
    }

    const numericPrice =
      form.price.trim() === "" ? null : Number(form.price);

    if (
      numericPrice !== null &&
      (Number.isNaN(numericPrice) || numericPrice < 0)
    ) {
      setError("Please enter a valid price.");
      setSubmitting(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from("events")
        .insert({
          title: form.title.trim(),
          slug: createSlug(form.title),
          description: form.description.trim() || null,
          city_id: form.city_id,
          venue_name: form.venue_name.trim(),
          venue_address: form.venue_address.trim() || null,
          category: form.category,
          start_at: new Date(form.start_at).toISOString(),
          end_at: form.end_at
            ? new Date(form.end_at).toISOString()
            : null,
          price: numericPrice,
          currency: form.currency,
          booking_url: form.booking_url.trim() || null,
          source_url: form.source_url.trim() || null,
          organizer_name: form.organizer_name.trim(),
          organizer_contact: form.organizer_contact.trim() || null,
          status: "pending",
          featured: false,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSuccess(true);

      setForm({
        title: "",
        description: "",
        city_id: "",
        venue_name: "",
        venue_address: "",
        category: "",
        start_at: "",
        end_at: "",
        price: "",
        currency: "KES",
        booking_url: "",
        source_url: "",
        organizer_name: "",
        organizer_contact: "",
      });
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your event."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black tracking-tight"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

          <div className="flex items-center gap-3">

            <Link
              href="/events"
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Browse Events
            </Link>

            <Link
              href="/"
              className="hidden rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:block"
            >
              Home
            </Link>

          </div>

        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-14">

          <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
            For Event Organizers
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
            List Your Event
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-500">
            Put your event in front of people looking for something to do
            across East Africa.
          </p>

        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">

        {success && (
          <div className="mb-8 rounded-3xl border border-green-200 bg-green-50 p-6">

            <div className="flex gap-4">

              <div className="text-3xl">
                🎉
              </div>

              <div>

                <h2 className="text-xl font-black text-green-800">
                  Event submitted successfully!
                </h2>

                <p className="mt-2 leading-7 text-green-700">
                  Your event has been submitted to SafariPlug and is now
                  waiting for review. It will appear publicly once approved
                  by our team.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">

                  <Link
                    href="/events"
                    className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-black text-white hover:bg-green-800"
                  >
                    Browse Events
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="rounded-full border border-green-300 px-5 py-2.5 text-sm font-bold text-green-800 hover:bg-green-100"
                  >
                    Submit Another Event
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

        {error && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          <div className="border-b border-slate-200 p-6 md:p-8">

            <h2 className="text-2xl font-black">
              Event information
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Tell people what is happening.
            </p>

          </div>

          <div className="space-y-7 p-6 md:p-8">

            <div>

              <label className="mb-2 block text-sm font-black">
                Event title *
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  updateField("title", e.target.value)
                }
                placeholder="e.g. Nairobi Weekend Party"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                required
              />

            </div>

            <div>

              <label className="mb-2 block text-sm font-black">
                Description
              </label>

              <textarea
                value={form.description}
                onChange={(e) =>
                  updateField("description", e.target.value)
                }
                placeholder="Tell people what they can expect..."
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />

            </div>

            <div className="grid gap-6 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-black">
                  City *
                </label>

                <select
                  value={form.city_id}
                  onChange={(e) =>
                    updateField("city_id", e.target.value)
                  }
                  disabled={loadingCities}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                >

                  <option value="">
                    {loadingCities
                      ? "Loading cities..."
                      : "Select a city"}
                  </option>

                  {cities.map((city) => (
                    <option
                      key={city.id}
                      value={city.id}
                    >
                      {city.name}
                    </option>
                  ))}

                </select>

              </div>

              <div>

                <label className="mb-2 block text-sm font-black">
                  Category *
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    updateField("category", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                >

                  <option value="">
                    Select a category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}

                </select>

              </div>

            </div>

          </div>

          <div className="border-y border-slate-200 bg-slate-50 p-6 md:p-8">

            <h2 className="text-2xl font-black">
              Date & location
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Help people know when and where to find you.
            </p>

            <div className="mt-7 space-y-6">

              <div className="grid gap-6 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-black">
                    Start date & time *
                  </label>

                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) =>
                      updateField("start_at", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    required
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-black">
                    End date & time
                  </label>

                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) =>
                      updateField("end_at", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />

                </div>

              </div>

              <div className="grid gap-6 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-black">
                    Venue name *
                  </label>

                  <input
                    type="text"
                    value={form.venue_name}
                    onChange={(e) =>
                      updateField("venue_name", e.target.value)
                    }
                    placeholder="e.g. The Alchemist"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    required
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-black">
                    Venue address
                  </label>

                  <input
                    type="text"
                    value={form.venue_address}
                    onChange={(e) =>
                      updateField(
                        "venue_address",
                        e.target.value
                      )
                    }
                    placeholder="Street, area or landmark"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />

                </div>

              </div>

            </div>

          </div>

          <div className="border-b border-slate-200 p-6 md:p-8">

            <h2 className="text-2xl font-black">
              Pricing & booking
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Tell visitors how much it costs and where they can book.
            </p>

            <div className="mt-7 space-y-6">

              <div className="grid gap-6 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-black">
                    Price
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) =>
                      updateField("price", e.target.value)
                    }
                    placeholder="e.g. 1000"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-black">
                    Currency
                  </label>

                  <select
                    value={form.currency}
                    onChange={(e) =>
                      updateField("currency", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  >

                    <option value="KES">
                      KES — Kenyan Shilling
                    </option>

                    <option value="TZS">
                      TZS — Tanzanian Shilling
                    </option>

                    <option value="UGX">
                      UGX — Ugandan Shilling
                    </option>

                    <option value="RWF">
                      RWF — Rwandan Franc
                    </option>

                    <option value="USD">
                      USD — US Dollar
                    </option>

                  </select>

                </div>

              </div>

              <div>

                <label className="mb-2 block text-sm font-black">
                  Booking / ticket link
                </label>

                <input
                  type="url"
                  value={form.booking_url}
                  onChange={(e) =>
                    updateField("booking_url", e.target.value)
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-black">
                  Event website / source link
                </label>

                <input
                  type="url"
                  value={form.source_url}
                  onChange={(e) =>
                    updateField("source_url", e.target.value)
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

          </div>

          <div className="p-6 md:p-8">

            <h2 className="text-2xl font-black">
              Organizer information
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Give SafariPlug a way to contact you about your submission.
            </p>

            <div className="mt-7 grid gap-6 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-black">
                  Organizer / business name *
                </label>

                <input
                  type="text"
                  value={form.organizer_name}
                  onChange={(e) =>
                    updateField(
                      "organizer_name",
                      e.target.value
                    )
                  }
                  placeholder="e.g. SafariPlug Events"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-black">
                  Contact information
                </label>

                <input
                  type="text"
                  value={form.organizer_contact}
                  onChange={(e) =>
                    updateField(
                      "organizer_contact",
                      e.target.value
                    )
                  }
                  placeholder="Phone, WhatsApp or email"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

            <div className="mt-8 rounded-2xl border border-orange-100 bg-orange-50 p-5">

              <p className="text-sm leading-6 text-orange-800">
                <strong>Important:</strong> Submitting an event does not
                automatically publish it. Every event is reviewed by the
                SafariPlug team before it appears publicly.
              </p>

            </div>

            <button
              type="submit"
              disabled={submitting || loadingCities}
              className="mt-8 w-full rounded-2xl bg-orange-500 px-6 py-4 text-base font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Submitting Event..."
                : "Submit Event for Review"}
            </button>

          </div>

        </form>

      </section>

      <footer className="border-t border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-10 md:flex-row">

          <div>

            <Link
              href="/"
              className="text-xl font-black"
            >
              Safari<span className="text-orange-500">Plug</span>
            </Link>

            <p className="mt-2 text-sm text-slate-500">
              Discover more. Experience more.
            </p>

          </div>

          <p className="text-sm text-slate-400">
            © 2026 SafariPlug
          </p>

        </div>

      </footer>

    </main>
  );
}
