"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAIROBI_CITY_ID = "09cd6144-c353-45e0-aebc-d9a842e9abfb";

const categories = [
  "Nightlife",
  "Music",
  "Festival",
  "Comedy",
  "Food",
  "Culture",
  "Sports",
  "Adventure",
  "Wellness",
  "Family",
  "Other",
];

function createSlug(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") +
    "-" +
    Date.now().toString().slice(-6)
  );
}

export default function SubmitEventPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Nightlife");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [imageUrl, setImageUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerContact, setOrganizerContact] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (!title.trim()) {
      setError("Please enter an event title.");
      return;
    }

    if (!date || !startTime) {
      setError("Please enter the event date and start time.");
      return;
    }

    setSubmitting(true);

    try {
      const startAt = new Date(`${date}T${startTime}`);

      const endAt =
        endTime && date
          ? new Date(`${date}T${endTime}`)
          : null;

      if (Number.isNaN(startAt.getTime())) {
        throw new Error("The event date or start time is invalid.");
      }

      if (endAt && Number.isNaN(endAt.getTime())) {
        throw new Error("The event end time is invalid.");
      }

      const { error: insertError } = await supabase
        .from("events")
        .insert({
          title: title.trim(),
          slug: createSlug(title),
          description: description.trim() || null,

          city_id: NAIROBI_CITY_ID,

          venue_name: venueName.trim() || null,
          venue_address: venueAddress.trim() || null,

          category,

          start_at: startAt.toISOString(),
          end_at: endAt ? endAt.toISOString() : null,

          price: price ? Number(price) : null,
          currency,

          image_url: imageUrl.trim() || null,
          booking_url: bookingUrl.trim() || null,

          organizer_name: organizerName.trim() || null,
          organizer_contact: organizerContact.trim() || null,

          status: "pending",
          featured: false,
        });

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        throw new Error(insertError.message);
      }

      setSuccess(true);

      setTitle("");
      setDescription("");
      setCategory("Nightlife");
      setVenueName("");
      setVenueAddress("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setPrice("");
      setCurrency("KES");
      setImageUrl("");
      setBookingUrl("");
      setOrganizerName("");
      setOrganizerContact("");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while submitting your event."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
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

            <Link
              href="/events"
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
            >
              All Events
            </Link>

          </div>
        </header>

        <section className="mx-auto max-w-3xl px-6 py-20">

          <div className="rounded-3xl border border-green-200 bg-white p-10 text-center shadow-sm">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
              ✓
            </div>

            <p className="mt-7 text-sm font-bold uppercase tracking-widest text-green-600">
              Submission received
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Your event has been submitted.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-500">
              Thank you for submitting your event to SafariPlug.
              Our team will review it before it appears publicly.
            </p>

            <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-left">

              <p className="font-bold">
                What happens next?
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your event is currently marked as pending review.
                Once approved, it will become available to people
                discovering events on SafariPlug.
              </p>

            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">

              <Link
                href="/events"
                className="rounded-full bg-orange-500 px-7 py-3.5 font-bold text-white"
              >
                Browse Events
              </Link>

              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="rounded-full border border-slate-200 px-7 py-3.5 font-bold text-slate-700"
              >
                Submit Another Event
              </button>

            </div>

          </div>

        </section>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black tracking-tight"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

          <nav className="flex items-center gap-5">

            <Link
              href="/events"
              className="hidden text-sm font-semibold text-slate-600 hover:text-orange-500 sm:block"
            >
              All Events
            </Link>

            <Link
              href="/"
              className="text-sm font-semibold text-slate-600 hover:text-orange-500"
            >
              Home
            </Link>

          </nav>

        </div>

      </header>

      {/* HERO */}

      <section className="bg-slate-950">

        <div className="mx-auto max-w-4xl px-6 py-14 md:py-16">

          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
            Event organizers
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
            List your event on SafariPlug.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Put your event in front of people actively looking for
            something to do across East Africa.
          </p>

        </div>

      </section>

      {/* FORM */}

      <section className="mx-auto max-w-4xl px-6 py-12">

        <form
          onSubmit={handleSubmit}
          className="space-y-8"
        >

          {/* EVENT INFORMATION */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              Step 1
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Event information
            </h2>

            <div className="mt-7 space-y-6">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Event title *
                </label>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Nairobi Weekend Party"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Category *
                </label>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people what they can expect..."
                  rows={6}
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

          </div>

          {/* LOCATION */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              Step 2
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Location
            </h2>

            <div className="mt-7 space-y-6">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  City
                </label>

                <input
                  value="Nairobi"
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 font-semibold text-slate-600"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Nairobi is currently the first available SafariPlug city.
                </p>

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Venue name
                </label>

                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g. KICC"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Venue address
                </label>

                <input
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Street, neighborhood or location details"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

          </div>

          {/* DATE */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              Step 3
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Date and time
            </h2>

            <div className="mt-7 grid gap-6 md:grid-cols-3">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Date *
                </label>

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Start time *
                </label>

                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  End time
                </label>

                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

          </div>

          {/* PRICE */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              Step 4
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Pricing
            </h2>

            <div className="mt-7 grid gap-6 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Price
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Leave blank if the event is free.
                </p>

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Currency
                </label>

                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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

          </div>

          {/* ONLINE INFORMATION */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              Step 5
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Online information
            </h2>

            <div className="mt-7 space-y-6">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Event image URL
                </label>

                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Image uploading will be added later.
                </p>

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Ticket / booking URL
                </label>

                <input
                  type="url"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

          </div>

          {/* ORGANIZER */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              Step 6
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Organizer information
            </h2>

            <div className="mt-7 grid gap-6 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Organizer name
                </label>

                <input
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  placeholder="Your name or company"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Phone / email
                </label>

                <input
                  value={organizerContact}
                  onChange={(e) => setOrganizerContact(e.target.value)}
                  placeholder="+254... or email@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

              </div>

            </div>

          </div>

          {/* ERROR */}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* SUBMIT */}

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">

            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

              <div>

                <h2 className="text-xl font-black">
                  Ready to submit?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Your event will be reviewed before it is published.
                </p>

              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-orange-500 px-8 py-4 font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Your Event"}
              </button>

            </div>

          </div>

        </form>

      </section>

      {/* FOOTER */}

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

          <div className="text-sm text-slate-500">
            © 2026 SafariPlug
          </div>

        </div>

      </footer>

    </main>
  );
}