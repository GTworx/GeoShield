// Geo-Shield Global Disaster & Event Dashboard Application Logic

// Global state
let map;
let allEvents = []; // Holds all normalized events fetched from APIs
let activeFilters = {
  earthquakes: true,
  volcanoes: true,
  wildfires: true,
  severeStorms: true,
  floods: true,
  other: true
};
let currentTimeRange = '7d'; // '24h', '7d', '30d'
let markersMap = new Map(); // EventID -> Marker Instance

// Layer Groups
let earthquakesClusterGroup;
let otherLayersGroup;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  fetchData();
});

// 1. Initialize Map
function initMap() {
  // Center map on a centered perspective, zoom 2
  map = L.map('map', {
    center: [20, 0],
    zoom: 2.3,
    minZoom: 1.5,
    maxZoom: 18,
    worldCopyJump: true
  });

  // Load a sleek CartoDB Dark Matter tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Initialize Marker Clusters for Earthquakes (which can be numerous)
  earthquakesClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: function (cluster) {
      const childCount = cluster.getChildCount();
      return L.divIcon({
        html: `<div class="custom-cluster custom-cluster-eq"><span>${childCount}</span></div>`,
        className: 'marker-cluster-custom',
        iconSize: [40, 40]
      });
    }
  }).addTo(map);

  // Layer group for all other disaster markers
  otherLayersGroup = L.layerGroup().addTo(map);

  // Add custom styled legend to map
  addMapLegend();
}

// Add Custom Map Legend
function addMapLegend() {
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <div class="legend-title">Hazard Legend</div>
      <div class="legend-item"><span class="legend-color" style="background-color: var(--color-eq)"></span>Earthquake</div>
      <div class="legend-item"><span class="legend-color" style="background-color: var(--color-vol)"></span>Volcano</div>
      <div class="legend-item"><span class="legend-color" style="background-color: var(--color-fire)"></span>Wildfire</div>
      <div class="legend-item"><span class="legend-color" style="background-color: var(--color-storm)"></span>Severe Storm</div>
      <div class="legend-item"><span class="legend-color" style="background-color: var(--color-flood)"></span>Flood</div>
      <div class="legend-item"><span class="legend-color" style="background-color: var(--color-other)"></span>Other Events</div>
    `;
    return div;
  };
  legend.addTo(map);
}

// 2. Set Up Event Listeners
function setupEventListeners() {
  // Time Range Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentTimeRange = e.target.dataset.range;
      fetchData();
    });
  });

  // Refresh Button
  document.getElementById('refreshBtn').addEventListener('click', fetchData);

  // Search Input
  document.getElementById('searchInput').addEventListener('input', filterAndRender);

  // Category Badges Toggle Filters
  document.querySelectorAll('.filter-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      const badgeEl = e.currentTarget;
      const category = badgeEl.dataset.category;
      activeFilters[category] = !activeFilters[category];
      
      if (activeFilters[category]) {
        badgeEl.classList.add('active');
      } else {
        badgeEl.classList.remove('active');
      }
      
      filterAndRender();
    });
  });

  // Toggle All Filters Button
  document.getElementById('toggleAllFilters').addEventListener('click', () => {
    const allActive = Object.values(activeFilters).every(v => v === true);
    const targetState = !allActive;
    
    Object.keys(activeFilters).forEach(key => {
      activeFilters[key] = targetState;
      const badge = document.querySelector(`.filter-badge.${getShortCategory(key)}`);
      if (badge) {
        if (targetState) badge.classList.add('active');
        else badge.classList.remove('active');
      }
    });
    
    filterAndRender();
  });

  // Close Detail Panel Button
  document.getElementById('closeDetailBtn').addEventListener('click', () => {
    document.getElementById('detailPanel').style.display = 'none';
    document.querySelectorAll('.event-card').forEach(card => card.classList.remove('selected'));
  });
}

// Helper to get short category class name
function getShortCategory(cat) {
  if (cat === 'earthquakes') return 'eq';
  if (cat === 'volcanoes') return 'vol';
  if (cat === 'wildfires') return 'fire';
  if (cat === 'severeStorms') return 'storm';
  if (cat === 'floods') return 'flood';
  return 'other';
}

// 3. Fetch Data from APIs
async function fetchData() {
  toggleLoadingState(true);
  
  // Clear existing markers mapping and overlays
  markersMap.clear();
  earthquakesClusterGroup.clearLayers();
  otherLayersGroup.clearLayers();
  document.getElementById('detailPanel').style.display = 'none';

  // Calculate USGS Earthquakes date offsets & EONET days parameter
  let usgsUrl = '';
  let eonetDays = 7;
  const now = new Date();
  
  if (currentTimeRange === '24h') {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    // 24h: fetch Earthquakes with min magnitude of 2.0 to filter background noise
    usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${oneDayAgo}&minmagnitude=2.0`;
    eonetDays = 1;
  } else if (currentTimeRange === '7d') {
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // 1 week: fetch M3.0+ to keep map snappy
    usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${oneWeekAgo}&minmagnitude=3.0`;
    eonetDays = 7;
  } else if (currentTimeRange === '30d') {
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // 1 month: fetch M4.5+ for significant events only (otherwise 10,000+ items load)
    usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${oneMonthAgo}&minmagnitude=4.5`;
    eonetDays = 30;
  }

  // EONET API URL
  const eonetUrl = `https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=all&days=${eonetDays}`;

  try {
    const [usgsRes, eonetRes] = await Promise.allSettled([
      fetch(usgsUrl).then(res => res.ok ? res.json() : null),
      fetch(eonetUrl).then(res => res.ok ? res.json() : null)
    ]);

    const usgsData = usgsRes.status === 'fulfilled' ? usgsRes.value : null;
    const eonetData = eonetRes.status === 'fulfilled' ? eonetRes.value : null;

    if (!usgsData && !eonetData) {
      throw new Error('Both data sources failed to load.');
    }

    normalizeAndStoreEvents(usgsData, eonetData);
    updateStatsOverview();
    filterAndRender();
  } catch (error) {
    console.error('Error fetching data:', error);
    document.getElementById('eventList').innerHTML = `
      <div class="no-events" style="color: var(--color-eq)">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
        <br>Failed to retrieve live disaster feeds. Please try syncing again.
      </div>
    `;
  } finally {
    toggleLoadingState(false);
  }
}

// 4. Normalize API response data into a unified schema
function normalizeAndStoreEvents(usgsData, eonetData) {
  allEvents = [];

  // Parse Earthquakes
  if (usgsData && usgsData.features) {
    usgsData.features.forEach(feat => {
      const props = feat.properties;
      const geom = feat.geometry;
      if (!geom || !geom.coordinates) return;

      allEvents.push({
        id: feat.id || `eq-${props.time}`,
        title: props.place || 'Unknown Location',
        category: 'earthquakes',
        time: new Date(props.time),
        magnitude: props.mag ? props.mag.toFixed(1) : 'M?',
        magnitudeVal: props.mag || 0,
        coordinates: [geom.coordinates[1], geom.coordinates[0]], // [lat, lon]
        url: props.url || '#',
        source: 'USGS Earthquake Program',
        details: {
          depth: `${geom.coordinates[2] ? geom.coordinates[2].toFixed(1) : '?'} km`,
          feltReports: props.felt || 0,
          tsunami: props.tsunami ? 'Yes' : 'No',
          alert: props.alert || 'None',
          status: props.status || 'Verified'
        }
      });
    });
  }

  // Parse EONET (Volcanoes, Wildfires, Storms, Floods, Landslides, etc.)
  if (eonetData && eonetData.features) {
    eonetData.features.forEach(feat => {
      const props = feat.properties;
      const geom = feat.geometry;
      if (!geom || !geom.coordinates) return;

      // Category Mapping
      let category = 'other';
      let mainCat = props.categories && props.categories[0] ? props.categories[0].id : '';

      if (mainCat === 'volcanoes') category = 'volcanoes';
      else if (mainCat === 'wildfires') category = 'wildfires';
      else if (mainCat === 'severeStorms') category = 'severeStorms';
      else if (mainCat === 'floods') category = 'floods';

      // Grab coordinates. If it's a Polygon, get centroid or start point
      let coords = [];
      if (geom.type === 'Point') {
        coords = [geom.coordinates[1], geom.coordinates[0]];
      } else if (geom.type === 'Polygon') {
        // Simple fallback to the first point of the polygon outer ring
        const pt = geom.coordinates[0][0];
        coords = [pt[1], pt[0]];
      } else {
        return; // Ignore other geometry formats to avoid errors
      }

      // Extrapolate magnitude details if available
      let magStr = 'Active';
      let magVal = 0;
      if (props.magnitudeValue) {
        magStr = `${props.magnitudeValue} ${props.magnitudeUnit || ''}`;
        magVal = parseFloat(props.magnitudeValue) || 0;
      }

      // Check if closed
      const isClosed = props.closed ? true : false;

      allEvents.push({
        id: props.id || `eonet-${Math.random()}`,
        title: props.title || 'Natural Event',
        category: category,
        time: geom.date ? new Date(geom.date) : (props.closed ? new Date(props.closed) : new Date()),
        magnitude: magStr,
        magnitudeVal: magVal,
        coordinates: coords,
        url: props.link || '#',
        source: props.sources && props.sources[0] ? props.sources[0].id : 'NASA EONET',
        details: {
          status: isClosed ? 'Closed / Historical' : 'Active Event',
          eonetCategory: props.categories ? props.categories.map(c => c.title).join(', ') : 'Unknown',
          description: props.description || 'No extended description available from EONET.',
          sources: props.sources ? props.sources.map(s => `<a href="${s.url}" target="_blank" class="detail-link">${s.id}</a>`).join(', ') : 'NASA'
        }
      });
    });
  }

  // Sort events chronologically (newest first)
  allEvents.sort((a, b) => b.time - a.time);
}

// 5. Update Statistics Panel
function updateStatsOverview() {
  document.getElementById('stat-total').textContent = allEvents.length;

  // Max Earthquake magnitude
  const earthquakes = allEvents.filter(e => e.category === 'earthquakes');
  if (earthquakes.length > 0) {
    const maxEq = Math.max(...earthquakes.map(e => e.magnitudeVal));
    document.getElementById('stat-max-eq').textContent = maxEq.toFixed(1);
  } else {
    document.getElementById('stat-max-eq').textContent = '-';
  }

  // Active Volcanoes (EONET Volcanoes that are active)
  const volcanoesCount = allEvents.filter(e => e.category === 'volcanoes').length;
  document.getElementById('stat-active-vo').textContent = volcanoesCount;

  // Update counts on filter badges
  const counts = {
    earthquakes: 0,
    volcanoes: 0,
    wildfires: 0,
    severeStorms: 0,
    floods: 0,
    other: 0
  };

  allEvents.forEach(e => {
    if (counts.hasOwnProperty(e.category)) {
      counts[e.category]++;
    }
  });

  document.getElementById('count-eq').textContent = counts.earthquakes;
  document.getElementById('count-vol').textContent = counts.volcanoes;
  document.getElementById('count-fire').textContent = counts.wildfires;
  document.getElementById('count-storm').textContent = counts.severeStorms;
  document.getElementById('count-flood').textContent = counts.floods;
  document.getElementById('count-other').textContent = counts.other;
}

// 6. Filter Events & Plot on Map and List Feed
function filterAndRender() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  
  // Filter events
  const filteredEvents = allEvents.filter(e => {
    const matchesFilter = activeFilters[e.category];
    const matchesSearch = e.title.toLowerCase().includes(searchQuery) || 
                          e.source.toLowerCase().includes(searchQuery) ||
                          e.category.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  // Update showing label
  document.getElementById('feed-stats').textContent = `Showing ${filteredEvents.length} of ${allEvents.length} events`;

  renderFeedList(filteredEvents);
  plotMarkers(filteredEvents);
}

// 7. Render Event List Sidebar
function renderFeedList(events) {
  const feedList = document.getElementById('eventList');
  
  if (events.length === 0) {
    feedList.innerHTML = `<div class="no-events">No disasters match the search or filter criteria.</div>`;
    return;
  }

  feedList.innerHTML = '';
  events.forEach(e => {
    const card = document.createElement('div');
    card.className = `event-card ${getShortCategory(e.category)}`;
    card.dataset.id = e.id;

    // Format human-friendly time ago
    const timeAgoStr = timeAgo(e.time);
    
    // Choose appropriate icon
    const iconClass = getIconClass(e.category);
    
    // Check if earthquake has a warning magnitude
    let magnitudeBadge = '';
    if (e.category === 'earthquakes') {
      magnitudeBadge = `<span class="card-magnitude">M ${e.magnitude}</span>`;
    } else {
      magnitudeBadge = `<span class="card-magnitude">${e.magnitude}</span>`;
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${e.title}</div>
        <div class="card-time">${timeAgoStr}</div>
      </div>
      <div class="card-footer">
        <div class="card-type"><i class="${iconClass}"></i> ${getHumanCategory(e.category)}</div>
        ${magnitudeBadge}
      </div>
    `;

    card.addEventListener('click', () => selectEvent(e.id));
    feedList.appendChild(card);
  });
}

// 8. Plot Markers on Leaflet Map
function plotMarkers(events) {
  // Clear previous markers
  earthquakesClusterGroup.clearLayers();
  otherLayersGroup.clearLayers();
  markersMap.clear();

  events.forEach(e => {
    let marker;

    if (e.category === 'earthquakes') {
      // Circle Marker scaled by magnitude
      const radius = Math.max(5, e.magnitudeVal * 2.8);
      const color = getEarthquakeColor(e.magnitudeVal);

      marker = L.circleMarker(e.coordinates, {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.65
      });
    } else {
      // DivIcon for other event categories with animated pulse and matching FontAwesome icon
      const iconClass = getIconClass(e.category);
      
      const customIcon = L.divIcon({
        html: `
          <div class="pulse-marker" style="position: absolute; width: 32px; height: 32px; margin: -6px 0 0 -6px; background-color: var(--color-${getShortCategory(e.category)}); opacity: 0.2;"></div>
          <div class="map-marker-pin ${getShortCategory(e.category)}" style="width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; background: var(--color-${getShortCategory(e.category)}); border: 1.5px solid #ffffff; font-size: 9px; box-shadow: 0 0 6px rgba(0,0,0,0.5);">
            <i class="${iconClass}"></i>
          </div>
        `,
        className: 'custom-disaster-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      marker = L.marker(e.coordinates, { icon: customIcon });
    }

    // Add standard Leaflet Popup
    const popupContent = `
      <div class="popup-title">${e.title}</div>
      <div style="font-size: 0.8rem; line-height: 1.5;">
        <strong>Type:</strong> ${getHumanCategory(e.category)}<br>
        <strong>Magnitude/Status:</strong> ${e.magnitude}<br>
        <strong>Time:</strong> ${e.time.toLocaleString()}<br>
        <strong>Coordinates:</strong> ${e.coordinates[0].toFixed(4)}, ${e.coordinates[1].toFixed(4)}
      </div>
    `;
    marker.bindPopup(popupContent, { closeButton: false });

    // Store in mapping and add to correct layer group
    markersMap.set(e.id, marker);

    if (e.category === 'earthquakes') {
      earthquakesClusterGroup.addLayer(marker);
    } else {
      otherLayersGroup.addLayer(marker);
    }

    // Marker click event
    marker.on('click', () => {
      selectEvent(e.id, false); // Don't fly to it again since user clicked it
    });
  });
}

// 9. Select Event (Fly to it, open details card, highlight list card)
function selectEvent(eventId, fly = true) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;

  // Highlight in sidebar list
  document.querySelectorAll('.event-card').forEach(card => card.classList.remove('selected'));
  const card = document.querySelector(`.event-card[data-id="${eventId}"]`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Open Details Overlay Panel
  showEventDetails(event);

  // Zoom/Fly on map
  const marker = markersMap.get(eventId);
  if (marker) {
    if (fly) {
      const zoom = event.category === 'earthquakes' ? Math.max(6, Math.min(10, event.magnitudeVal + 3)) : 7;
      map.flyTo(event.coordinates, zoom, {
        animate: true,
        duration: 1.2
      });
      
      // Delay opening popup slightly until fly completes
      setTimeout(() => {
        marker.openPopup();
      }, 1200);
    } else {
      marker.openPopup();
    }
  }
}

// Populate Details Card
function showEventDetails(e) {
  const detailPanel = document.getElementById('detailPanel');
  const detailTitle = document.getElementById('detailTitle');
  const detailContent = document.getElementById('detailContent');

  detailTitle.textContent = getHumanCategory(e.category);
  
  let additionalDetailsHTML = '';
  if (e.category === 'earthquakes') {
    additionalDetailsHTML = `
      <div class="detail-row">
        <span class="detail-label">Magnitude:</span>
        <span class="detail-value" style="font-weight: 700; color: var(--color-eq)">M ${e.magnitude}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Depth:</span>
        <span class="detail-value">${e.details.depth}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Felt Reports:</span>
        <span class="detail-value">${e.details.feltReports} reports</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Tsunami Threat:</span>
        <span class="detail-value" style="${e.details.tsunami === 'Yes' ? 'color: var(--color-eq); font-weight:700' : ''}">${e.details.tsunami}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${e.details.status}</span>
      </div>
    `;
  } else {
    // NASA Event Details
    additionalDetailsHTML = `
      <div class="detail-row">
        <span class="detail-label">Properties:</span>
        <span class="detail-value" style="font-weight: 700; color: var(--color-${getShortCategory(e.category)})">${e.magnitude}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${e.details.status}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Categories:</span>
        <span class="detail-value">${e.details.eonetCategory}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data Sources:</span>
        <span class="detail-value">${e.details.sources}</span>
      </div>
      <div class="detail-row" style="margin-top: 10px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
        <span class="detail-value" style="font-style: italic; color: var(--text-muted);">${e.details.description}</span>
      </div>
    `;
  }

  detailContent.innerHTML = `
    <div style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 12px; line-height: 1.3;">
      ${e.title}
    </div>
    <div class="detail-row">
      <span class="detail-label">Time (UTC):</span>
      <span class="detail-value">${e.time.toUTCString()}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Local Time:</span>
      <span class="detail-value">${e.time.toLocaleString()}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Coordinates:</span>
      <span class="detail-value">${e.coordinates[0].toFixed(5)}, ${e.coordinates[1].toFixed(5)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Metadata By:</span>
      <span class="detail-value">${e.source}</span>
    </div>
    ${additionalDetailsHTML}
    <a href="${e.url}" target="_blank" class="btn-link">
      <i class="fa-solid fa-square-arrow-up-right"></i>
      View Primary Report
    </a>
  `;

  detailPanel.style.display = 'block';
}

// 10. Utility Helpers
function toggleLoadingState(isLoading) {
  const refreshBtn = document.getElementById('refreshBtn');
  const spinIcon = refreshBtn.querySelector('i');
  const labelText = refreshBtn.querySelector('span');

  if (isLoading) {
    spinIcon.classList.add('spinning');
    labelText.textContent = 'Syncing...';
    refreshBtn.disabled = true;
    document.getElementById('eventList').innerHTML = `
      <div class="no-events">
        <i class="fa-solid fa-spinner spinning" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-primary)"></i>
        <br>Connecting to USGS & NASA servers...
      </div>
    `;
  } else {
    spinIcon.classList.remove('spinning');
    labelText.textContent = 'Sync/Reload';
    refreshBtn.disabled = false;
  }
}

// Time range formatter
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// Icon mapping according to category
function getIconClass(cat) {
  switch (cat) {
    case 'earthquakes': return 'fa-solid fa-house-crack';
    case 'volcanoes': return 'fa-solid fa-volcano';
    case 'wildfires': return 'fa-solid fa-fire';
    case 'severeStorms': return 'fa-solid fa-wind';
    case 'floods': return 'fa-solid fa-cloud-showers-heavy';
    default: return 'fa-solid fa-triangle-exclamation';
  }
}

// Human readable category mapping
function getHumanCategory(cat) {
  switch (cat) {
    case 'earthquakes': return 'Earthquake';
    case 'volcanoes': return 'Active Volcano';
    case 'wildfires': return 'Wildfire';
    case 'severeStorms': return 'Severe Storm';
    case 'floods': return 'Flooding';
    default: return 'Geological/Severe Event';
  }
}

// Earthquakes colors based on Richter Magnitude
function getEarthquakeColor(mag) {
  if (mag >= 7.0) return '#ef4444'; // Red-critical
  if (mag >= 6.0) return '#f43f5e'; // Deep Rose
  if (mag >= 5.0) return '#f97316'; // Orange-major
  if (mag >= 4.0) return '#f59e0b'; // Amber-moderate
  if (mag >= 3.0) return '#eab308'; // Yellow-minor
  return '#84cc16'; // Green-micro
}
