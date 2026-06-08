import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import mapImageUrl from "../map.png";
import selectedPinUrl from "./assets/selected.svg";
// import iconServices    from './assets/services.svg';
import iconCulinary from "./assets/culinary.svg";
import iconAutomatives from "./assets/automatives.svg";
import iconSponsors from "./assets/sponsors.svg";
import iconOthers from "./assets/others.svg";
import "./style.css";

fetch('/attractions.json')
  .then(r => r.json())
  .then(({ MAP_W, MAP_H, CATEGORY_META, attractions }) => {

// ─── MAP SETUP (CRS.Simple = treat image as flat coordinate space) ──────────
// In CRS.Simple, latLng = [y, x] in image pixels.
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: .9,
  maxZoom: 2,
  zoomSnap: 0.4,
  zoomDelta: 0.5,
  zoomControl: false,
  attributionControl: false,
  inertia: true,
  wheelPxPerZoomLevel: 60,
});

const bounds = [
  [0, 0],
  [MAP_H, MAP_W],
];
L.imageOverlay(mapImageUrl, bounds).addTo(map);
map.setMaxBounds([
  [0, 0],
  [MAP_H, MAP_W],
]);

// ≥1280px: fit map image width to viewport width; otherwise fit height to 100svh
const _cw = map.getContainer().clientWidth + 120;
const _ch = map.getContainer().clientHeight;
const initZoom = _cw >= 1280
  ? Math.max(Math.log2(_cw / MAP_W), Math.log2(_ch / MAP_H))
  : Math.log2(_ch / MAP_H);
map.setView([MAP_H / 2, MAP_W / 2], initZoom);

L.control.zoom({ position: "bottomright" }).addTo(map);

// ─── MARKER SCALE ON ZOOM ───────────────────────────────────────────────────
function updateMarkerScale() {
  const zoom = map.getZoom();
  // zoom 0 → scale 1.0, zoom -1 → 0.5, zoom -2 → 0.4 (clamped), zoom 1 → 1.5 (clamped)
  const scale = Math.min(1.5, Math.max(0.4, Math.pow(2, zoom)));
  document.documentElement.style.setProperty("--marker-scale", scale);
}
map.on("zoom", updateMarkerScale);
// updateMarkerScale();

// ─── map marker ─────────────────────────

const SPECIAL_ICONS = new Set([
  "shop",
  "stage",
  "guest",
  "lounge",
  "toilet",
  "shuttle",
  "firstAid",
]);

function iconClass(a) {
  return SPECIAL_ICONS.has(a.icon) ? ` marker-${a.icon}` : "";
}

function markerBase(a) {
  return L.divIcon({
    className: "marker-base-wrapper",
    html: `<div class="marker-base-circle">
      <div class="marker-avatar marker-${a.avatar}${iconClass(a)}"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ─── SELECTED PIN + DRAWER ──────────────────────────────────────────────────
const attractionById = new Map(attractions.map((a) => [a.id, a]));
let selectedPinMarker = null;
let selectedAttrId = null;

function makeSelectedPinIcon() {
  return L.divIcon({
    className: "selected-pin-wrapper",
    html: `<img src="${selectedPinUrl}" width="30" height="40" alt="" />`,
    iconSize: [30, 40],
    // tip of the teardrop is at y≈43 in the SVG → aligns with the marker's coordinate
    iconAnchor: [15, 40],
  });
}

function clearSelectedPin() {
  if (selectedPinMarker) {
    map.removeLayer(selectedPinMarker);
    selectedPinMarker = null;
  }
  selectedAttrId = null;
}

function openDrawer(a) {
  // Thumb image
  const thumb = document.getElementById("drawerThumb");
  if (a.img) {
    thumb.src = a.img;
    thumb.alt = a.name;
    thumb.hidden = false;
  } else {
    thumb.hidden = true;
  }

  // Category label (i18n)
  document.getElementById("drawerCat").textContent = categoryLabel(a.category);

  // Name
  document.getElementById("drawerName").textContent = a.name;

  // Location row
  const locRow = document.getElementById("drawerLocation");
  if (a.locationName || a.locationHref) {
    document.getElementById("drawerLocationName").textContent = a.locationName ?? "";
    // const cta = document.getElementById("drawerLocationCta");
    // cta.href = a.locationHref ?? "#";
    locRow.hidden = false;
  } else {
    locRow.hidden = true;
  }

  document.getElementById("drawer").classList.add("open");
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  clearSelectedPin();
}

function selectAttraction(a) {
  clearSelectedPin();
  selectedAttrId = a.id;
  selectedPinMarker = L.marker([a.y, a.x], {
    icon: makeSelectedPinIcon(),
    zIndexOffset: 1000,
    interactive: false,
  }).addTo(map);
  openDrawer(a);
}

document.getElementById("drawerClose").addEventListener("click", closeDrawer);

// ─── MARKERS ────────────────────────────────────────────────────────────────
const markerById = new Map();
let ignoreMapClick = false;

for (const a of attractions) {
  // CRS.Simple: latLng = [y, x]
  const marker = L.marker([a.y, a.x], {
    icon: markerBase(a),
    title: a.name,
    alt: a.name,
    riseOnHover: true,
  });
  marker.on("click", () => {
    ignoreMapClick = true;
    selectAttraction(a);
    map.panTo([a.y, a.x]);
    setTimeout(() => {
      ignoreMapClick = false;
    }, 0);
  });
  markerById.set(a.id, marker);
  map.addLayer(marker);
}

map.on("click", () => {
  if (!ignoreMapClick) closeDrawer();
});

// ─── FILTER BAR ─────────────────────────────────────────────────────────────
const CATEGORY_ICON_URL = {
  services:    iconOthers,
  culinary:    iconCulinary,
  automatives: iconAutomatives,
  sponsors:    iconSponsors,
};

// Derive locale from first URL path segment: /{locale}/...
const _locale = window.location.pathname.split('/')[1];
const _labelKey = (_locale === 'zh-TW' || _locale === 'tc') ? 'label_tc'
                : (_locale === 'zh-CN' || _locale === 'sc') ? 'label_sc'
                : 'label';
function categoryLabel(cat) {
  return CATEGORY_META[cat]?.[_labelKey] ?? cat;
}


const categories = [...new Set(attractions.map((a) => a.category))].sort(
  // sort order: automatives, sponsors, culinary, services
  (a, b) => {
    const order = ["automatives", "sponsors", "culinary", "services"];
    return order.indexOf(a) - order.indexOf(b);
  }
);

let activeFilter = null;
const filterBar = document.getElementById("filterBar");

categories.forEach((cat) => {
  const chip = document.createElement("button");
  chip.className = "filter-chip";
  chip.dataset.category = cat;
  const iconUrl = CATEGORY_ICON_URL[cat];
  const label = categoryLabel(cat);
  chip.innerHTML = iconUrl
    ? `<img src="${iconUrl}" class="chip-icon" alt="" aria-hidden="true" />${label}`
    : label;
  filterBar.appendChild(chip);
});

filterBar.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;

  // Toggle off if already active → show all
  if (chip.classList.contains("active")) {
    chip.classList.remove("active");
    activeFilter = null;
  } else {
    filterBar
      .querySelectorAll(".filter-chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.category;
  }

  for (const [id, marker] of markerById) {
    const a = attractionById.get(id);
    if (activeFilter === null || a.category === activeFilter) {
      if (!map.hasLayer(marker)) map.addLayer(marker);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  }

  // Close drawer if the selected attraction is now filtered out
  if (selectedAttrId !== null) {
    const sel = attractionById.get(selectedAttrId);
    if (activeFilter !== null && sel.category !== activeFilter) closeDrawer();
  }
});

// ─── DEEP-LINK via URL hash ──────────────────────────────────────────────────
function openAttractionByHash(hash) {
  if (!hash) return;
  const name = decodeURIComponent(hash.replace(/^#/, "")).trim();
  if (!name) return;
  const nameLower = name.toLowerCase();
  const a = attractions.find((x) => x.name.toLowerCase() === nameLower);
  if (!a) return;
  map.setView([a.y, a.x], Math.max(map.getZoom(), 1), { animate: false });
  selectAttraction(a);
}

openAttractionByHash(window.location.hash);
window.addEventListener("hashchange", () => openAttractionByHash(window.location.hash));

}); // end fetch

// ─── CRAWLABLE LIST → click to zoom/open ────────────────────────────────────
document.querySelectorAll("[data-attraction-id]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    const id = Number(el.dataset.attractionId);
    const a = attractionById.get(id);
    const m = markerById.get(id);
    if (!m || !a) return;
    map.flyTo(m.getLatLng(), 1, { duration: 0.6 });
    selectAttraction(a);
  });
});

// // Hide intro hint after a few seconds
// setTimeout(() => document.getElementById('hint')?.classList.add('hidden'), 4000);
