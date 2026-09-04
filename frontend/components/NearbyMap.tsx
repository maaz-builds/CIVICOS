"use client";

import { useEffect, useRef, useState } from "react";

// Leaflet is loaded lazily at runtime (see the mount effect) because it
// touches `window` - importing it at module scope would crash Next.js's
// server-side render of this page. Only its types + stylesheet are static.
import type * as LeafletNS from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  categoryOfIssue,
  formatDistance,
  statusLabel,
  STATUS_COLOR,
} from "@/lib/nearby";

/** One stored complaint rendered as a pin (backend row + distance). */
export interface NearbyMapItem {
  tracking_id: string;
  issue_type: string;
  severity: string | null;
  status: string;
  lat: number;
  lng: number;
  distance_m: number;
}

interface NearbyMapProps {
  center: { lat: number; lng: number };
  radiusM: number;
  items: NearbyMapItem[];
  /** When set, pan to this pin and open its popup (clicked in the list). */
  focusId?: string | null;
}

/** Escape untrusted AI text (issue types) before it lands in popup HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function NearbyMap({
  center,
  radiusM,
  items,
  focusId,
}: NearbyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const markerLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const circleRef = useRef<LeafletNS.Circle | null>(null);
  const markersRef = useRef<Map<string, LeafletNS.Marker>>(new Map());
  const [ready, setReady] = useState(false);

  // Create the map exactly once. Leaflet is fetched on demand so nothing
  // here runs on the server.
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 16,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.attributionControl.setPrefix(false);
      mapRef.current = map;
      LRef.current = L;
      markerLayerRef.current = L.layerGroup().addTo(map);
      // The container can be measured at 0 height on first paint (tab or
      // layout race) - ask the map to measure itself once laid out.
      window.setTimeout(() => map.invalidateSize(), 150);
      setReady(true);
    })();
    return () => {
      disposed = true;
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      circleRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync circle, pins, and view whenever location / radius / results /
  // focus change (skipped until the map exists).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!ready || !L || !map || !layer) return;

    // 1) Search-radius circle around the centre.
    if (circleRef.current) {
      circleRef.current.setLatLng([center.lat, center.lng]).setRadius(radiusM);
    } else {
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#3b82f6",
        weight: 1.5,
        dashArray: "6 6",
        fillColor: "#3b82f6",
        fillOpacity: 0.06,
      }).addTo(map);
    }

    // 2) Rebuild the pins from the current results.
    layer.clearLayers();
    markersRef.current.clear();
    const bounds = L.latLngBounds([[center.lat, center.lng]]);
    bounds.extend(circleRef.current.getBounds());

    for (const item of items) {
      const category = categoryOfIssue(item.issue_type);
      const resolved = (item.status ?? "").toLowerCase() === "resolved";
      // Pins are colour-coded by category and dimmed once resolved. divIcon
      // (not the default image icons) so the emoji/colour works offline of
      // Leaflet's asset pipeline.
      const icon = L.divIcon({
        className: "",
        html:
          `<div style="width:34px;height:34px;display:grid;place-items:center;` +
          `border-radius:9999px;background:${category.color};border:2px solid #fff;` +
          `box-shadow:0 2px 6px rgba(15,23,42,.45);font-size:16px;line-height:1;` +
          `${resolved ? "opacity:.55;filter:grayscale(.9)" : ""}">` +
          `${category.emoji}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });
      const marker = L.marker([item.lat, item.lng], {
        icon,
        title: item.issue_type,
      }).addTo(layer);

      const status = (item.status ?? "").toLowerCase();
      const statusColour = STATUS_COLOR[status] ?? "#94a3b8";
      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif;min-width:200px;color:#0f172a">` +
          `<div style="font-weight:700;font-size:14px">${escapeHtml(item.issue_type)}</div>` +
          `<div style="margin-top:6px;font-size:12px;color:#475569;line-height:1.7">` +
          `Severity: <b>${escapeHtml(item.severity || "—")}</b><br/>` +
          `Distance: <b>${formatDistance(item.distance_m)}</b> from you<br/>` +
          `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;` +
          `background:${statusColour};margin-right:5px;vertical-align:middle"></span>` +
          `<b>${statusLabel(item.status)}</b>` +
          `</div>` +
          `<a href="/track?tracking=${encodeURIComponent(item.tracking_id)}" ` +
          `style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;` +
          `color:#2563eb;text-decoration:none">Track ${escapeHtml(item.tracking_id)} →</a>` +
          `</div>`
      );
      markersRef.current.set(item.tracking_id, marker);
      bounds.extend([item.lat, item.lng]);
    }

    // 3) Frame the search area (circle + any pins), then honour a focus.
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    if (focusId) {
      const marker = markersRef.current.get(focusId);
      if (marker) {
        const target = marker.getLatLng();
        window.setTimeout(() => {
          map.flyTo(target, 17, { duration: 0.5 });
          marker.openPopup();
        }, 450);
      }
    }
  }, [center, radiusM, items, focusId, ready]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-2xl"
      aria-label="Map of nearby civic complaints"
    />
  );
}
