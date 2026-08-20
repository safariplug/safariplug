"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

type City = {
  id: string;
  name: string;
  country: string;
};

const categories = EVENT_CATEGORIES;

export default function SubmitEventPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    image_url: "",
    city_id: "",
    category: "",
    start_at: "",
    end_at: "",
    venue_name: "",
    venue_address: "",
    price: "",
    currency: "KES",
    booking_url: "",
    source_url: "",
    organizer_name: "",
    organizer_contact: "",
  });

  useEffect(() => {
    async function loadCities() {
      const { data, error } = await supabase
        .from("cities")
        .select("id,name,country")
        .eq("active", true)
        .order("name");

      if (error) {
        console.error(error);
      }

      setCities(data || []);
      setLoadingCities(false);
    }

    loadCities();
  }, []);

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      let imageUrl = "";

if (imageFile) {
  const fileExt =
    imageFile.name.split(".").pop();

  const filename =
    `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

  console.log("Uploading image:", filename);

  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from("event-images")
      .upload(filename, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    throw new Error(
      `Image upload failed: ${uploadError.message}`
    );
  }

  console.log("Upload successful:", uploadData);

  const { data: publicUrlData } =
    supabase.storage
      .from("event-images")
      .getPublicUrl(filename);

  imageUrl = publicUrlData.publicUrl;

  console.log("Public image URL:", imageUrl);
}

      const numericPrice = form.price
        ? Number(form.price)
        : null;
const slug = `${form.title
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")}-${Date.now()}`;
      const { error: insertError } =
        await supabase
          .from("events")
          .insert({slug,
            title: form.title,
            description: form.description || null,
            image_url: imageUrl || null,
            city_id: form.city_id || null,
            category: form.category,
            start_at: form.start_at,
            end_at: form.end_at || null,
            venue_name: form.venue_name,
            venue_address:
              form.venue_address || null,
            price: numericPrice,
            currency: form.currency,
            booking_url:
              form.booking_url || null,
            source_url:
              form.source_url || null,
            organizer_name:
              form.organizer_name,
            organizer_contact:
              form.organizer_contact || null,
            status: "pending",
          });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSuccess(true);

      setForm({
        title: "",
        description: "",
        image_url: "",
        city_id: "",
        category: "",
        start_at: "",
        end_at: "",
        venue_name: "",
        venue_address: "",
        price: "",
        currency: "KES",
        booking_url: "",
        source_url: "",
        organizer_name: "",
        organizer_contact: "",
      });

      setImageFile(null);
      setImagePreview("");

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit event."
      );

    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-950">

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black"
          >
            Safari<span className="text-orange-500">
              Plug
            </span>
          </Link>

          <Link
            href="/events"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Browse Events
          </Link>

        </div>
      </header>


      <section className="bg-slate-950 px-6 py-16 text-white">

        <div className="mx-auto max-w-5xl">

          <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-400">
            Event Organizers
          </p>

          <h1 className="mt-4 text-5xl font-black leading-tight">
            Put your experience in front of East Africa.
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            Submit concerts, nightlife, food experiences,
            adventures and events happening across the region.
          </p>

        </div>

      </section>
      <section className="mx-auto max-w-5xl px-6 py-12">

        {success && (
          <div className="mb-8 rounded-3xl border border-green-200 bg-green-50 p-6">

            <h2 className="text-xl font-black text-green-800">
              Event submitted successfully 🎉
            </h2>

            <p className="mt-2 text-green-700">
              Your event is now waiting for SafariPlug review.
            </p>

          </div>
        )}

        {error && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">
            {error}
          </div>
        )}


        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl"
        >

          <div className="space-y-8 p-6 md:p-10">


            <div>
              <h2 className="text-3xl font-black">
                Event details
              </h2>

              <p className="mt-2 text-slate-500">
                Tell people what makes your event special.
              </p>
            </div>


            <div>

              <label className="mb-2 block text-sm font-black">
                Event title *
              </label>

              <input
                required
                value={form.title}
                onChange={(e) =>
                  updateField("title", e.target.value)
                }
                placeholder="Example: Mombasa Beach Festival"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-orange-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm font-black">
                Event description
              </label>

              <textarea
                rows={5}
                value={form.description}
                onChange={(e) =>
                  updateField(
                    "description",
                    e.target.value
                  )
                }
                placeholder="Describe the experience..."
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-orange-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm font-black">
                Event cover image
              </label>


              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full rounded-xl border px-4 py-3"
              />


              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mt-5 h-64 w-full rounded-2xl object-cover"
                />
              )}

            </div>



            <div className="grid gap-6 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-black">
                  City *
                </label>

                <select
                  required
                  value={form.city_id}
                  onChange={(e) =>
                    updateField(
                      "city_id",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >

                  <option value="">
                    {loadingCities
                      ? "Loading cities..."
                      : "Select city"}
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
                  required
                  value={form.category}
                  onChange={(e) =>
                    updateField(
                      "category",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >

                  <option value="">
                    Select category
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



            <hr />

            <h2 className="text-3xl font-black">
              Date & Venue
            </h2>



            <div className="grid gap-6 md:grid-cols-2">

              <input
                required
                type="datetime-local"
                value={form.start_at}
                onChange={(e) =>
                  updateField(
                    "start_at",
                    e.target.value
                  )
                }
                className="rounded-xl border px-4 py-3"
              />


              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(e) =>
                  updateField(
                    "end_at",
                    e.target.value
                  )
                }
                className="rounded-xl border px-4 py-3"
              />

            </div>


            <input
              required
              value={form.venue_name}
              onChange={(e) =>
                updateField(
                  "venue_name",
                  e.target.value
                )
              }
              placeholder="Venue name"
              className="w-full rounded-xl border px-4 py-3"
            />


            <input
              value={form.venue_address}
              onChange={(e) =>
                updateField(
                  "venue_address",
                  e.target.value
                )
              }
              placeholder="Venue address"
              className="w-full rounded-xl border px-4 py-3"
            />



            <hr />


            <h2 className="text-3xl font-black">
              Pricing & Organizer
            </h2>


            <div className="grid gap-6 md:grid-cols-2">

              <input
                type="number"
                value={form.price}
                onChange={(e) =>
                  updateField(
                    "price",
                    e.target.value
                  )
                }
                placeholder="Ticket price"
                className="rounded-xl border px-4 py-3"
              />


              <select
                value={form.currency}
                onChange={(e) =>
                  updateField(
                    "currency",
                    e.target.value
                  )
                }
                className="rounded-xl border px-4 py-3"
              >

                <option value="KES">
                  KES
                </option>

                <option value="USD">
                  USD
                </option>

                <option value="TZS">
                  TZS
                </option>

              </select>

            </div>



            <input
              required
              value={form.organizer_name}
              onChange={(e) =>
                updateField(
                  "organizer_name",
                  e.target.value
                )
              }
              placeholder="Organizer / business name"
              className="w-full rounded-xl border px-4 py-3"
            />


            <input
              value={form.organizer_contact}
              onChange={(e) =>
                updateField(
                  "organizer_contact",
                  e.target.value
                )
              }
              placeholder="Phone / WhatsApp / Email"
              className="w-full rounded-xl border px-4 py-3"
            />


            <button
              disabled={submitting}
              className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-black text-white hover:bg-orange-600 disabled:opacity-50"
            >

              {submitting
                ? "Submitting..."
                : "Submit Event"}

            </button>


          </div>

        </form>

      </section>


      <footer className="border-t bg-white px-6 py-10">

        <div className="mx-auto max-w-7xl">

          <p className="font-black">
            Safari<span className="text-orange-500">
              Plug
            </span>
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Discover more. Experience more.
          </p>

        </div>

      </footer>


    </main>
  );
}