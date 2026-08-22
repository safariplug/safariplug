"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  city_id: string;
  venue_name: string | null;
  venue_address: string | null;
  category: string;
  start_at: string;
  end_at: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url: string | null;
  organizer_name: string | null;
  organizer_contact: string | null;
  status: string;
  featured: boolean;
  created_at: string;
};

type Filter = "all" | "pending" | "approved" | "rejected";

export default function AdminPage() {
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");

  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [actionId, setActionId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkAuthentication() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      if (mounted) {
        setCheckingAuth(false);
      }
    }

    checkAuthentication();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function loadEvents() {
    setLoading(true);
    setError("");

    try {
      let query = supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          city_id,
          venue_name,
          venue_address,
          category,
          start_at,
          end_at,
          price,
          currency,
          image_url,
          booking_url,
          organizer_name,
          organizer_contact,
          status,
          featured,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setEvents((data || []) as EventItem[]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checkingAuth) {
      loadEvents();
    }
  }, [filter, checkingAuth]);

  async function updateStatus(
    id: string,
    status: "approved" | "rejected"
  ) {
    setActionId(id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({
          status,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setMessage(
        status === "approved"
          ? "Event approved successfully."
          : "Event rejected successfully."
      );

      await loadEvents();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the event."
      );
    } finally {
      setActionId(null);
    }
  }

  async function toggleFeatured(
    id: string,
    currentFeatured: boolean
  ) {
    setActionId(id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({
          featured: !currentFeatured,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setMessage(
        !currentFeatured
          ? "Event is now featured."
          : "Event removed from featured events."
      );

      await loadEvents();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update featured status."
      );
    } finally {
      setActionId(null);
    }
  }

  async function deleteEvent(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this event?"
    );

    if (!confirmed) {
      return;
    }

    setActionId(id);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setMessage("Event deleted successfully.");

      await loadEvents();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the event."
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatPrice(
    price: number | null,
    currency: string | null
  ) {
    if (price === null || price === undefined) {
      return "Free";
    }

    return `${currency || "KES"} ${Number(price).toLocaleString()}`;
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">

        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Checking administrator access...
          </p>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5">

          <div>

            <Link
              href="/"
              className="text-2xl font-black tracking-tight"
            >
              Safari<span className="text-orange-500">Plug</span>
            </Link>

            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Administration
            </p>

          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">

            <Link
              href="/events"
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              View Public Events
            </Link>
              <Link
                href="/admin/ai-events"
                className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
              >
                AI Event Pipeline
              </Link>

              <Link
                href="/admin/ai-scout"
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                AI Scout
              </Link>


            <button
              onClick={handleLogout}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              Sign Out
            </button>

          </div>

        </div>

      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">

        <div className="mb-8">

          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
            SafariPlug Admin
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight">
            Event Management
          </h1>

          <p className="mt-3 max-w-2xl text-slate-500">
            Review submitted events, approve listings, manage featured
            events and remove listings that should not appear on SafariPlug.
          </p>

        </div>

        <div className="mb-6 flex flex-wrap gap-3">

          {(
            [
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
              ["all", "All Events"],
            ] as [Filter, string][]
          ).map(([value, label]) => (

            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
                filter === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>

          ))}

        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (

          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">

            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />

            <p className="mt-4 text-sm font-semibold text-slate-500">
              Loading events...
            </p>

          </div>

        ) : events.length === 0 ? (

          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">

            <div className="text-5xl">
              ðŸŽ‰
            </div>

            <h2 className="mt-5 text-2xl font-black">
              No events found
            </h2>

            <p className="mx-auto mt-3 max-w-md text-slate-500">
              There are currently no events matching this filter.
            </p>

          </div>

        ) : (

          <div className="space-y-5">
            {events.map((event) => (

              <article
                key={event.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >

                <div className="p-6 md:p-8">

                  <div className="flex flex-col justify-between gap-6 lg:flex-row">

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                            event.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : event.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {event.status}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {event.category}
                        </span>

                        {event.featured && (
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                            Featured
                          </span>
                        )}

                      </div>

                      <h2 className="mt-4 text-2xl font-black">
                        {event.title}
                      </h2>

                      {event.description && (
                        <p className="mt-3 max-w-3xl leading-7 text-slate-500">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">

                        <div className="rounded-2xl bg-slate-50 p-4">

                          <p className="font-bold text-slate-400">
                            DATE & TIME
                          </p>

                          <p className="mt-1 font-bold">
                            {formatDate(event.start_at)}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">

                          <p className="font-bold text-slate-400">
                            LOCATION
                          </p>

                          <p className="mt-1 font-bold">
                            {event.venue_name || "Venue not provided"}
                          </p>

                          {event.venue_address && (
                            <p className="mt-1 text-slate-500">
                              {event.venue_address}
                            </p>
                          )}

                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">

                          <p className="font-bold text-slate-400">
                            PRICE
                          </p>

                          <p className="mt-1 font-bold">
                            {formatPrice(
                              event.price,
                              event.currency
                            )}
                          </p>

                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">

                          <p className="font-bold text-slate-400">
                            ORGANIZER
                          </p>

                          <p className="mt-1 font-bold">
                            {event.organizer_name || "Not provided"}
                          </p>

                          {event.organizer_contact && (
                            <p className="mt-1 text-slate-500">
                              {event.organizer_contact}
                            </p>
                          )}

                        </div>

                      </div>

                      <div className="mt-5 text-xs text-slate-400">
                        Event ID: {event.id}
                      </div>

                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-52">

                      <Link
                        href={`/events/${event.id}`}
                        target="_blank"
                        className="rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        View Event
                      </Link>

                      {event.status !== "approved" && (

                        <button
                          onClick={() =>
                            updateStatus(
                              event.id,
                              "approved"
                            )
                          }
                          disabled={actionId === event.id}
                          className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionId === event.id
                            ? "Working..."
                            : "Approve Event"}
                        </button>

                      )}

                      {event.status !== "rejected" && (

                        <button
                          onClick={() =>
                            updateStatus(
                              event.id,
                              "rejected"
                            )
                          }
                          disabled={actionId === event.id}
                          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {actionId === event.id
                            ? "Working..."
                            : "Reject Event"}
                        </button>

                      )}

                      {event.status === "approved" && (

                        <button
                          onClick={() =>
                            toggleFeatured(
                              event.id,
                              event.featured
                            )
                          }
                          disabled={actionId === event.id}
                          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {event.featured
                            ? "Unfeature"
                            : "Feature Event"}
                        </button>

                      )}

                      <button
                        onClick={() =>
                          deleteEvent(event.id)
                        }
                        disabled={actionId === event.id}
                        className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete Event
                      </button>

                    </div>

                  </div>

                </div>

              </article>

            ))}

          </div>

        )}

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
            SafariPlug Administration
          </p>

        </div>

      </footer>

    </main>
  );
}

