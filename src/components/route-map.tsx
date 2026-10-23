"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// The day's stops on a map: numbered pins in visit order, joined by a dashed line.
// OpenStreetMap tiles through Leaflet: free, no key.

export type MapStop = { id: string; n: number; lat: number; lng: number; name: string; time: string; done: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function RouteMap({ stops }: { stops: MapStop[] }) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(stops);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current) return;
      map = L.map(box.current, { zoomControl: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      const points = stops.map((s) => L.latLng(s.lat, s.lng));
      if (points.length > 1) {
        L.polyline(points, { color: "#0a84cc", weight: 3, dashArray: "8 8", opacity: 0.9 }).addTo(map);
      }
      for (const s of stops) {
        const icon = L.divIcon({
          className: "",
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -36],
          html: `<div class="route-pin${s.done ? " route-pin-done" : ""}"><span>${s.n}</span></div>`,
        });
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(`<a href="/appointments/${s.id}" class="route-pop"><b>${s.n}. ${esc(s.name)}</b><br>${esc(s.time)}</a>`)
          .addTo(map);
      }
      if (points.length === 1) map.setView(points[0], 13);
      else map.fitBounds(L.latLngBounds(points), { padding: [36, 36] });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={box} className="relative isolate z-0 h-72 w-full overflow-hidden rounded-[var(--radius-card)] border border-line" role="img" aria-label="Map of the day's stops" />;
}
