"use client";

import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

type MapEvent = {
  id: string;
  title: string;
  category: string | null;
  venue_name: string | null;
  start_at: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type SafariMapProps = {
  events?: MapEvent[];
  center?: {
    lat: number;
    lng: number;
  };
  city?: string;
};

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Nairobi: {
    lat: -1.286389,
    lng: 36.817223,
  },

  Mombasa: {
    lat: -4.043477,
    lng: 39.668206,
  },

  Diani: {
    lat: -4.277,
    lng: 39.594,
  },

  Mtwapa: {
    lat: -3.9407,
    lng: 39.745,
  },

  Kilifi: {
    lat: -3.6305,
    lng: 39.8499,
  },

  Malindi: {
    lat: -3.2192,
    lng: 40.1169,
  },

  Watamu: {
    lat: -3.355,
    lng: 40.018,
  },

  Lamu: {
    lat: -2.2717,
    lng: 40.902,
  },

  Zanzibar: {
    lat: -6.1659,
    lng: 39.2026,
  },

  Nakuru: {
    lat: -0.3031,
    lng: 36.080,
  },

  Kisumu: {
    lat: -0.0917,
    lng: 34.768,
  },
};

const DEFAULT_CENTER = {
  lat: -1.286389,
  lng: 36.817223,
};

export default function SafariMap({
  events = [],
  center,
  city,
}: SafariMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [selectedEvent, setSelectedEvent] =
    useState<MapEvent | null>(null);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [locationMessage, setLocationMessage] =
    useState("");

  const destinationCenter =
    city && CITY_CENTERS[city]
      ? CITY_CENTERS[city]
      : center || DEFAULT_CENTER;

  useEffect(() => {
    setSelectedEvent(null);
    setLocationMessage("");
  }, [city]);

  const mappedEvents = events.filter(
    (event) =>
      event.latitude !== null &&
      event.latitude !== undefined &&
      event.longitude !== null &&
      event.longitude !== undefined
  );

  function findNearby() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location services are not available on this device."
      );
      return;
    }

    setLocationMessage("Finding your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(location);
        setLocationMessage("Showing experiences near you.");
      },
      () => {
        setLocationMessage(
          "We couldn't access your location. Check your browser permissions."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  if (!apiKey) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-[32px] bg-slate-950 p-8 text-center text-white">
        <div className="max-w-md">
          <div className="text-5xl">⌖</div>

          <h3 className="mt-5 text-2xl font-black">
            SafariPlug Map
          </h3>

          <p className="mt-3 text-sm leading-6 text-white/50">
            The interactive map will appear here once Google Maps
            is configured.
          </p>
        </div>
      </div>
    );
  }

  const activeCenter = userLocation || destinationCenter;

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl">
      <APIProvider apiKey={apiKey}>
        <div className="relative h-[560px] w-full">
          <Map
            center={activeCenter}
            defaultZoom={city ? 12 : 6}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapId="safariplug-map"
          >
            {mappedEvents.map((event) => (
              <AdvancedMarker
                key={event.id}
                position={{
                  lat: Number(event.latitude),
                  lng: Number(event.longitude),
                }}
                onClick={() => setSelectedEvent(event)}
              />
            ))}

            {userLocation && (
              <AdvancedMarker position={userLocation}>
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-blue-500 shadow-lg">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              </AdvancedMarker>
            )}

            {selectedEvent &&
              selectedEvent.latitude !== null &&
              selectedEvent.latitude !== undefined &&
              selectedEvent.longitude !== null &&
              selectedEvent.longitude !== undefined && (
                <InfoWindow
                  position={{
                    lat: Number(selectedEvent.latitude),
                    lng: Number(selectedEvent.longitude),
                  }}
                  onCloseClick={() =>
                    setSelectedEvent(null)
                  }
                >
                  <div className="min-w-[230px] p-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">
                      {selectedEvent.category ||
                        "Experience"}
                    </p>

                    <h3 className="mt-1 text-base font-black text-slate-950">
                      {selectedEvent.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {selectedEvent.venue_name ||
                        "Location TBA"}
                    </p>

                    {selectedEvent.start_at && (
                      <p className="mt-2 text-xs font-bold text-slate-600">
                        {new Date(
                          selectedEvent.start_at
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
          </Map>

          {/* MAP HEADER */}

          <div className="absolute left-5 top-5">
            <div className="rounded-2xl bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">
                SafariPlug
              </p>

              <p className="mt-0.5 text-sm font-black text-slate-950">
                {city
                  ? `Explore ${city}`
                  : "Explore East Africa"}
              </p>
            </div>
          </div>

          {/* DISCOVERY COUNT */}

          <div className="absolute right-5 top-5 rounded-full bg-slate-950/90 px-4 py-2.5 text-xs font-black text-white shadow-lg">
            {mappedEvents.length}{" "}
            {mappedEvents.length === 1
              ? "discovery"
              : "discoveries"}
          </div>

          {/* BOTTOM CONTROLS */}

          <div className="absolute bottom-5 left-5 right-5">
            <div className="flex flex-col gap-3 rounded-[24px] bg-slate-950/90 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-400">
                  Location discovery
                </p>

                <p className="mt-1 text-sm font-bold text-white">
                  {city
                    ? `What's happening around ${city}?`
                    : "Find experiences around you."}
                </p>

                {locationMessage && (
                  <p className="mt-1 text-xs text-white/50">
                    {locationMessage}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={findNearby}
                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-600"
              >
                📍 Explore near me
              </button>
            </div>
          </div>
        </div>
      </APIProvider>
    </div>
  );
}