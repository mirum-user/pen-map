import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import mapImageUrl from '../dummy_map.jpg';
import { attractions, MAP_W, MAP_H } from './attractions.js';
import './style.css';

// ─── MAP SETUP (CRS.Simple = treat image as flat coordinate space) ──────────
// In CRS.Simple, latLng = [y, x] in image pixels.
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 2,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  zoomControl: false,
  attributionControl: false,
  inertia: true,
  wheelPxPerZoomLevel: 120,
});

const bounds = [[0, 0], [MAP_H, MAP_W]];
L.imageOverlay(mapImageUrl, bounds).addTo(map);
map.setMaxBounds([[-100, -100], [MAP_H + 100, MAP_W + 100]]);
map.fitBounds(bounds);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// ─── PIN ICON FACTORY ───────────────────────────────────────────────────────
function makePinIcon(a) {
  return L.divIcon({
    className: 'pin-icon-wrapper',
    html: `<div class="pin-circle" style="background:${a.color}">${a.id}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function thumbDataUri(a) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='72'>
    <defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' style='stop-color:${a.thumbBg}'/>
      <stop offset='100%' style='stop-color:${a.color}'/>
    </linearGradient></defs>
    <rect width='90' height='72' fill='url(#g)' rx='8'/>
    <text x='45' y='44' text-anchor='middle' font-size='32'
      font-family='Segoe UI Emoji,Apple Color Emoji,sans-serif'>${a.icon}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function popupHtml(a) {
  return `<div class="pop">
    <img class="pop-thumb" src="${thumbDataUri(a)}" alt="${a.name}" />
    <div class="pop-body">
      <div class="pop-cat">${a.category}</div>
      <div class="pop-title">${a.name}</div>
    </div>
  </div>`;
}

// ─── CLUSTER LAYER ──────────────────────────────────────────────────────────
const cluster = L.markerClusterGroup({
  maxClusterRadius: 60,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  iconCreateFunction: (c) => L.divIcon({
    className: 'cluster-icon-wrapper',
    html: `<div class="cluster-circle">${c.getChildCount()}</div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  }),
});

const markerById = new Map();

for (const a of attractions) {
  // CRS.Simple: latLng = [y, x]
  const marker = L.marker([a.y, a.x], {
    icon: makePinIcon(a),
    title: a.name,
    alt: a.name,
    riseOnHover: true,
  }).bindPopup(popupHtml(a), { offset: [0, -10], maxWidth: 320 });
  markerById.set(a.id, marker);
  cluster.addLayer(marker);
}
map.addLayer(cluster);

// ─── CRAWLABLE LIST → click to zoom/open ────────────────────────────────────
document.querySelectorAll('[data-attraction-id]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const id = Number(el.dataset.attractionId);
    const m = markerById.get(id);
    if (!m) return;
    map.flyTo(m.getLatLng(), 1, { duration: 0.6 });
    cluster.zoomToShowLayer(m, () => m.openPopup());
  });
});

// Hide intro hint after a few seconds
setTimeout(() => document.getElementById('hint')?.classList.add('hidden'), 4000);
