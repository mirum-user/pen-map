import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import mapImageUrl from "../map.png";
import selectedAutomativesUrl from "./assets/selected-automatives.svg";
import selectedCulinaryUrl from "./assets/selected-culinary.svg";
import selectedSponsorsUrl from "./assets/selected-sponsors.svg";
import selectedServicesUrl from "./assets/selected-services.svg";
import selectedFirstAidUrl from "./assets/selected-firstAid.svg";
// import iconServices    from './assets/services.svg';
import iconCulinary from "./assets/culinary.svg";
import iconAutomatives from "./assets/automatives.svg";
import iconSponsors from "./assets/sponsors.svg";
import iconOthers from "./assets/others.svg";
import iconFirstAid from "./assets/firstAid.svg";
import "./style.css";

fetch('/attractions.json')
  .then(r => r.json())
  .then(({ MAP_W, MAP_H, CATEGORY_META, attractions }) => {

// ─── MAP SETUP (CRS.Simple = treat image as flat coordinate space) ──────────
// In CRS.Simple, latLng = [y, x] in image pixels.
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: window.innerWidth <= 767 ? 0.001 : 0.09,
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
const _cw = map.getContainer().clientWidth;
const _ch = map.getContainer().clientHeight;
const initZoom = _cw >= 1280
  ? Math.max(Math.log2(_cw / MAP_W), Math.log2(_ch / MAP_H))
  : .01;
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
      <div class="marker-avatar marker-${a.category}">${a.symbol}</div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ─── SELECTED PIN + DRAWER ──────────────────────────────────────────────────
const attractionById = new Map(attractions.map((a) => [a.id, a]));
let selectedPinMarker = null;
let selectedAttrId = null;

function makeSelectedPinIcon(a) {
  return L.divIcon({
    className: "selected-pin-wrapper",
    html: `<img src="${SELECTED_PIN_MAP[a.category]}" width="30" height="40" alt="" />`,
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
  const content = document.getElementById("drawerContent");
  content.innerHTML = '';
  a.booths.forEach(booth => {
    const card = document.createElement('div');
    card.className = 'drawer-booth';

    if (booth.img) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.className = 'drawer-thumb';
      img.src = booth.img;
      img.alt = booth.name;
      card.appendChild(img);
    }

    const drawerSubCat = document.createElement('span');
    drawerSubCat.className = 'drawer-cat';
    drawerSubCat.id = 'drawerCat';
    drawerSubCat.textContent = a.subCategory;

    const info = document.createElement('div');
    info.className = 'drawer-info';

    info.appendChild(drawerSubCat);

    const name = document.createElement('div');
    name.className = 'drawer-name';
    name.textContent = booth.name;
    info.appendChild(name);

    if (booth.locationName) {
      const loc = document.createElement('div');
      loc.className = 'drawer-location';
      const nameFrame = document.createElement('div');
      nameFrame.className = 'drawer-location-nameFrame';
      const locName = document.createElement('span');
      locName.className = 'drawer-location-name';
      locName.textContent = booth.locationName ?? '';
      nameFrame.appendChild(locName);
      loc.appendChild(nameFrame);
      info.appendChild(loc);
    }

    card.appendChild(info);
    content.appendChild(card);
  });

  const drawer = document.getElementById("drawer");
  const prevCat = [...drawer.classList].find(c => c.startsWith('cat-'));
  if (prevCat) drawer.classList.remove(prevCat);
  drawer.classList.add('open', `cat-${a.category}`);
  document.getElementById('listViewToggle').classList.add('hidden');
}

function closeDrawer() {
  const drawer = document.getElementById("drawer");
  const catClass = [...drawer.classList].find(c => c.startsWith('cat-'));
  if (catClass) drawer.classList.remove(catClass);
  drawer.classList.remove("open", "drawer--list");
  clearSelectedPin();
  document.getElementById('listViewToggle').classList.remove('hidden');
}

function selectAttraction(a) {
  clearSelectedPin();
  selectedAttrId = a.id;
  selectedPinMarker = L.marker([a.y, a.x], {
    icon: makeSelectedPinIcon(a),
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
  firstAid:    iconFirstAid,
};

const SELECTED_PIN_MAP = {
  services:    selectedServicesUrl,
  culinary:    selectedCulinaryUrl,
  automatives: selectedAutomativesUrl,
  sponsors:    selectedSponsorsUrl,
  firstAid:    selectedFirstAidUrl,
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
    const order = ["automatives", "sponsors", "culinary", "services", "firstAid"];
    return order.indexOf(a) - order.indexOf(b);
  }
);

let activeFilter = null;
const filterBar = document.getElementById("filterBar");

if (filterBar) {
  const urlParams = new URLSearchParams(window.location.search);
  const preview = urlParams.get('preview');
  if(preview) {
    filterBar.classList.add('preview');
  }
}

categories.forEach((cat) => {
  const chip = document.createElement("button");
  chip.className = "filter-chip";
  chip.dataset.category = cat;
  const label = categoryLabel(cat);
  chip.innerHTML = `<span class="chip-icon chip-icon-${cat}"></span>${label}`;
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
  const a = attractions.find((x) => x.booths.some(b => b.name.toLowerCase() === nameLower));
  if (!a) return;
  map.setView([a.y, a.x], Math.max(map.getZoom(), 1), { animate: false });
  selectAttraction(a);
}

openAttractionByHash(window.location.hash);
window.addEventListener("hashchange", () => openAttractionByHash(window.location.hash));

// ─── LIST VIEW ───────────────────────────────────────────────────────────────
function openListView() {
  const content = document.getElementById("drawerContent");
  content.innerHTML = '';

  const catOrder = ["automatives", "sponsors", "culinary", "services", "firstAid"];
  const byCategory = {};
  for (const a of attractions) {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  }

  // Insert sticky header with title + total count
  const totalCount = attractions.reduce((sum, a) => sum + a.booths.length, 0);
  const listHeader = document.createElement('div');
  listHeader.className = 'drawer-list-header';
  const listTitle = document.createElement('span');
  listTitle.className = 'drawer-list-header-title';
  listTitle.textContent = 'All Locations';
  const listCount = document.createElement('span');
  listCount.className = 'drawer-list-header-count';
  listCount.textContent = totalCount;
  listHeader.appendChild(listTitle);
  listHeader.appendChild(listCount);
  content.appendChild(listHeader);

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'drawer-list-scroll';

  catOrder.forEach(cat => {
    if (!byCategory[cat]) return;
    const section = document.createElement('div');
    section.className = 'drawer-list-section';

    byCategory[cat].forEach(a => {
      a.booths.forEach(booth => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'drawer-booth drawer-list-item';

        if (booth.img) {
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.className = 'drawer-thumb';
          img.src = booth.img;
          img.alt = booth.name;
          card.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'drawer-info';

        const catSpan = document.createElement('span');
        catSpan.className = 'drawer-cat';
        catSpan.textContent = a.subCategory;
        info.appendChild(catSpan);

        const name = document.createElement('div');
        name.className = 'drawer-name';
        name.textContent = booth.name;
        info.appendChild(name);

        if (booth.locationName) {
          const loc = document.createElement('div');
          loc.className = 'drawer-location';
          const nameFrame = document.createElement('div');
          nameFrame.className = 'drawer-location-nameFrame';
          const locName = document.createElement('span');
          locName.className = 'drawer-location-name';
          locName.textContent = booth.locationName;
          nameFrame.appendChild(locName);
          loc.appendChild(nameFrame);
          info.appendChild(loc);
        }

        card.appendChild(info);

        card.addEventListener('click', () => {
          const drawer = document.getElementById("drawer");
          drawer.classList.remove('drawer--list');
          map.panTo([a.y, a.x]);
          selectAttraction(a);
        });

        section.appendChild(card);
      });
    });

    scrollContainer.appendChild(section);
  });

  content.appendChild(scrollContainer);

  const drawer = document.getElementById("drawer");
  const prevCat = [...drawer.classList].find(c => c.startsWith('cat-'));
  if (prevCat) drawer.classList.remove(prevCat);
  drawer.classList.add('open', 'drawer--list');
  document.getElementById('listViewToggle').classList.add('hidden');
}

document.getElementById("listViewToggle").addEventListener("click", () => {
  const drawer = document.getElementById("drawer");
  if (drawer.classList.contains('open') && drawer.classList.contains('drawer--list')) {
    closeDrawer();
  } else {
    openListView();
  }
});

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
