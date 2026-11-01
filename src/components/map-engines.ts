"use client";
import type { DayStop } from "./day-map";

// The Today map: OpenStreetMap through Leaflet (free, no key), numbered pins joined by a line.

export type MapEngine = {
  /** Make this visit's pin stand out (gold, bigger) and center the map on it. */
  focus: (stop: DayStop | undefined) => void;
  destroy: () => void;
};

type Draw = { box: HTMLElement; stops: DayStop[]; onPin: (index: number) => void };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function drawDayMap({ box, stops, onPin }: Draw): Promise<MapEngine> {
  const L = await import("leaflet");
  const map = L.map(box, { zoomControl: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  const placed = stops.filter((s) => s.lat != null && s.lng != null);
  const points = placed.map((s) => L.latLng(s.lat!, s.lng!));
  if (points.length > 1) L.polyline(points, { color: "#c6a45e", weight: 4, dashArray: "8 8", opacity: 0.95 }).addTo(map);
  const markers = new Map<string, import("leaflet").Marker>();
  for (const s of placed) {
    const icon = L.divIcon({
      className: "",
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      html: `<div class="route-pin" data-stop="${esc(s.id)}"><span>${s.n}</span></div>`,
    });
    markers.set(s.id, L.marker([s.lat!, s.lng!], { icon, title: `${s.n}. ${s.client}`, keyboard: false })
      .on("click", () => onPin(stops.indexOf(s)))
      .addTo(map));
  }
  if (points.length === 1) map.setView(points[0], 14);
  else if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], paddingBottomRight: [40, 200] });
  else map.setView([37.56, -122.32], 10);
  return {
    focus(stop) {
      for (const [id, m] of markers) m.getElement()?.querySelector(".route-pin")?.classList.toggle("route-pin-active", id === stop?.id);
      if (stop?.lat != null && stop.lng != null) map.panTo([stop.lat, stop.lng], { animate: true });
    },
    destroy() {
      map.remove();
    },
  };
}
