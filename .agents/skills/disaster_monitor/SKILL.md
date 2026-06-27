---
name: disaster-monitor-dashboard
description: Fetches, filters, and displays recent global natural disasters (earthquakes, volcanoes, wildfires, severe storms, floods) over the past 24 hours, 7 days, and 30 days, mapping them on an interactive dashboard.
---

# Disaster Monitor Dashboard Skill

Use this skill to view, operate, and troubleshoot the Global Disaster & Event Dashboard ("Geo-Shield"). This dashboard fetches live data from the USGS (United States Geological Survey) and NASA EONET (Earth Observatory Natural Event Tracker) APIs, normalizes it, and visualizes it on a high-fidelity interactive map.

## Project Structure

The project files are located at:
- `index.html`: Main HTML file layout, CDNs, and UI containers. [index.html](file:///C:/Users/GokTen/Documents/GT-Docs/SKiLLS/EarthQuakeMonitor/index.html)
- `styles.css`: Dark-theme layout, glassmorphic panels, badge colors, and map animations. [styles.css](file:///C:/Users/GokTen/Documents/GT-Docs/SKiLLS/EarthQuakeMonitor/styles.css)
- `app.js`: Connects to APIs, maps coordinate structures, operates Leaflet widgets, and drives the feed. [app.js](file:///C:/Users/GokTen/Documents/GT-Docs/SKiLLS/EarthQuakeMonitor/app.js)

## Features Included
1. **Interactive Leaflet Map**: Uses CartoDB Dark Matter base layer for beautiful dark-mode visuals.
2. **Sync Live Data**: Queries live USGS & NASA EONET endpoints directly from the client side (bypasses CORS restrictions).
3. **Time-Range Queries**: Supported time windows:
   - **24 Hours**: Captures real-time activities; queries minor earthquakes (M2.0+) and near-instantaneous EONET reports.
   - **1 Week**: Fetches moderate earthquakes (M3.0+) and recent weekly events.
   - **1 Month**: Fetches significant earthquakes (M4.5+) and monthly event logs to limit map lag.
4. **Interactive Filters**: Toggle categories: Earthquakes, Volcanoes, Wildfires (forest fires), Severe Storms (tornadoes/cyclones), Floods, and other anomalies.
5. **Detailed Sidebar**: Real-time listing sorted chronologically, text-based search filtering, and click-to-fly map controls.

## How to Launch the Dashboard

To show the dashboard to the user, run the following PowerShell command in the terminal to open the file in the default web browser:

```powershell
Start-Process "C:\Users\GokTen\Documents\GT-Docs\SKiLLS\EarthQuakeMonitor\index.html"
```

## How to Fetch Data from the CLI (For Reports)

If you need to analyze the disaster feeds directly in the terminal, you can fetch raw data using these curl templates:

### USGS Earthquakes (e.g. Past 7 days, M3.0+):
```powershell
Invoke-RestMethod -Uri "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=$((Get-Date).AddDays(-7).ToString('yyyy-MM-dd'))&minmagnitude=3.0"
```

### NASA EONET Events (e.g. Past 7 days, open and closed events):
```powershell
Invoke-RestMethod -Uri "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=all&days=7"
```
