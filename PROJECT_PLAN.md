# ForestGuard AI — implementation plan

## Goal

Create and deliver a complete, responsive React/Vite frontend for **ForestGuard AI – Forest Fire Monitoring & Response Dashboard**, a 5th-semester engineering project with straightforward code suitable for explaining in a viva. It will use real public sources wherever available, identify simulated operational details clearly, and never fabricate fire, weather, vegetation, or boundary observations. All eleven requested pages will be navigable and functional, including usable local fallbacks and honest loading, empty, and error states.

The managed Webdev project was initialized as **ForestGuard AI** in `/home/ubuntu/forestguard`; implementation will continue in that project after plan approval. It is configured as a frontend-only Web project without a custom server or database. No login credentials or external data-source credentials were supplied.

## Product and data decisions

- **Region assumption:** Use Uttarakhand, India, because the brief leaves the state/region unspecified. Make the region and bounding box centralized configuration so it can be changed easily. Initial FIRMS/Overpass box: approximately west 77.6, south 28.7, east 81.1, north 31.5. Label the selected region and box in the interface/settings and README, and note they are assumptions for the demo, not official forest boundaries.
- **Missing supplied datasets:** The brief says the user will provide `fires_history.csv`, `zones.geojson`, `fire_stations.geojson`, and `ndvi.csv`, but none were attached. Include valid empty CSV/GeoJSON fallbacks with schemas, do not fabricate records or boundaries, and show contextual empty states. Fire-station results can still load live from Overpass; Open-Meteo remains live where the API responds.
- **NASA FIRMS credential:** Read optional `VITE_FIRMS_KEY` from `.env` for the requested client-side fetch. The key is browser-visible in a Vite client; document that it must be treated as a public client credential, provide `.env.example`, and never commit a real key. Without a configured key or usable response, use bundled history fallback and visibly mark source status. No proxy/backend will be added because the brief explicitly requires frontend only.
- **Data truthfulness:** Live data are timestamped and marked by source; cached/fallback data are identified. Missing measures remain unavailable rather than silently replaced with random, invented, or falsely precise values. Any station readiness, crew, water level, response-time estimates, and generated operational response measures are labelled **Simulated**.
- **Risk score:** Keep the requested weights (0.35 fire frequency + 0.25 inverse humidity + 0.20 wind + 0.20 dryness), normalize each factor to a documented 0–100 scale before applying weights, cap wind and fire frequency using explicit, documented ranges, derive dryness transparently from available NDVI/soil-moisture values, and normalize the resulting weighted score to 0–100. Show unavailable/incomplete-factor handling and formula on Vulnerable Areas; do not imply an evidence-backed score if required measurements are missing. For Period A/B comparison, normalize both windows to the same maximum zone fire count across the selected pair.
- **Forest health:** Use a separate transparent five-input health index requiring NDVI, soil moisture, humidity, temperature and current precipitation. Weights are NDVI 0.30, soil moisture 0.25, humidity 0.20, temperature-comfort 0.15 and rainfall 0.10; missing inputs leave the score unavailable. State that this educational index is not a forest survey.
- **Fire spread:** Use a documented deterministic elliptical approximation, not ML. Compute major/minor radii from elapsed hours and an explainable base spread rate modulated by wind speed/direction and fuel dryness; project the ellipse along the wind bearing using geospatial distance calculations. Area is the ellipse area converted to hectares. Settlement intersections are derived from available OSM point features. Explain that this is an educational simulation, not an operational forecast.
- **Authentication:** Mock role selection only (Admin / Forest Officer), saved in localStorage. It is not secure authentication and will be identified as a demonstration login.
- **Publishing:** Build and run the Preview for delivery; do not enable automatic publication or publish publicly unless separately requested.

## Design system

- **Design movement:** Editorial environmental intelligence dashboard—precise operational UI softened with field-guide cues, not a generic SaaS template.
- **Core principles:** (1) real-world provenance is visible; (2) risk states are legible at a glance; (3) dense information stays calm and organized; (4) controls remain usable across field and desk devices.
- **Color philosophy:** Forest green `#14532d` and leaf green `#16a34a` convey stewardship and safe conditions; amber `#f59e0b`, fire orange `#ea580c`, and danger red `#dc2626` communicate progressively urgent risk; warm pale `#f8faf7` backgrounds and white surfaces preserve clarity. Apply low/moderate/high/critical colors consistently and provide labels/icons so meaning does not depend on color alone.
- **Layout paradigm:** Persistent desktop navigation rail beside an operational workbench; map-and-feed split views where geography is central; mobile navigation collapses to a drawer and data-heavy layouts become stacked cards or horizontally scrollable tables with contained overflow.
- **Signature elements:** Topographic contour accents on map/context panels; a compact risk-color legend and source/freshness footers; a distinctive forest-canopy/shield mark for the brand.
- **Interaction philosophy:** Direct, reversible action flows with keyboard access, visible focus, clear confirmation/toast feedback, useful filters, and honest disabled states when source data is unavailable.
- **Animation:** Restrained Framer Motion for short page/drawer transitions and hotspot spread playback only; `useReducedMotion` suppresses page, hero, dialog, drawer, toast and simulation motion for users whose system requests reduced motion; no decorative continuous motion.
- **Typography:** Inter throughout, with tabular numerals for KPIs/tables. Clear hierarchy: compact uppercase overlines, strong page titles, concise section headings, readable body copy, and subdued provenance metadata.
- **Brand essence:** A student-built, source-transparent forest fire monitoring workspace for regional response teams; **grounded, vigilant, explainable**.
- **Brand voice:** Direct, calm, operational microcopy. Examples: “Monitor the signal. Focus the response.” and “No verified boundary data loaded for this zone yet.” Avoid claims of predictive certainty.
- **Wordmark/logo:** A compact custom canopy formed by three leaf/contour strokes over a shield/map-pin silhouette, paired with a bold ForestGuard wordmark.
- **Signature brand color:** Forest green `#14532d`.

## Implementation approach

1. Establish the Vite React app, Tailwind, router, shared design tokens, iconography, chart/map dependencies, responsive shell, and route manifest. Keep configuration in a small region/settings module.
2. Create organized data services for FIRMS, Open-Meteo, OSM, zone risk, simulation, and audit. Use sessionStorage caches with timestamps, bounded fetch timeouts, robust response/CSV validation, and local fallback status that remains distinguishable from cached live data. Use Papaparse for FIRMS/history/NDVI CSV parsing. Use GeoJSON for zones/stations and Leaflet with an OSM-derived tile style, provider-required attribution, and map empty/error states. Standard OSM tiles were blocked in the managed preview; the selected OpenHikingMap service is intended for non-commercial, low-volume use and must show visible OpenHikingMap, donation, and OpenStreetMap attribution.
3. Implement app contexts for demo role, theme, and alerts/settings; persist demo role/theme, editable alert thresholds, notification preferences, scenarios, acknowledgement state, and actual audit events in localStorage. Apply the chosen thresholds to alert generation. Do not record synthetic events in the audit log.
4. Build shared UI components (sidebar, navbar, stat card, map, risk badge, alert card, data table, modal/drawer, chart card, loaders/empty/error states, toasts) before feature pages.
5. Implement all eleven routes: (1) Login/Landing; (2) Dashboard; (3) Fire Engine; (4) Forest Health; (5) Vulnerable Areas; (6) Hotspot Simulation; (7) Risk Change Detection; (8) Alert Center; (9) Analytics; (10) History; (11) Audit Log & Settings. Each route has complete page content, responsive states and working navigation; no placeholder or “coming soon” pages.
6. Add valid, empty fallback files under `public/data`, `.env.example`, and a thorough README containing overview, setup, env instructions, source/license/status table, assumptions and unavailable datasets, formulas and limits, page-by-page feature list, and a concise viva Q&A.
7. Install dependencies, run development/build checks, resolve errors, verify all route declarations and key interaction/service paths, package the complete project as a ZIP in the workspace, and run the dev server for the Webdev Preview. Do not deploy publicly absent an explicit request.

## Project structure

```text
/home/ubuntu/forestguard/
  public/
    data/
      fires_history.csv        # Valid header-only fallback until real user data is supplied
      zones.geojson            # Valid empty FeatureCollection until zone boundaries are supplied
      fire_stations.geojson    # Valid empty FeatureCollection fallback
      ndvi.csv                 # Valid header-only fallback until real measurements are supplied
    manus-routes.json          # Complete static route manifest
  src/
    components/                # Sidebar, Navbar, StatCard, MapView, RiskBadge,
                               # AlertCard, DataTable, Modal, Drawer, ChartCard,
                               # Loader, EmptyState, ErrorState, Toast
    context/                    # Theme, Auth (demo roles), Alerts/settings
    data/                       # Region and field/schema configuration
    pages/                      # One complete view per requested route
    services/                   # firms, weather, osm, risk, simulation, audit
    utils/                      # formatters, geo helpers, csv export, storage
    App.jsx                     # Router and shared shell
    main.jsx
    index.css
  .env.example
  README.md
  package.json
  vite.config.js
```

## Verification and delivery

- Confirm `npm install`, development startup, and a production build succeed; resolve actionable diagnostics/build failures.
- Confirm the static `/manus-routes.json` returns JSON and exactly matches all implemented page routes.
- Inspect service paths for cache/live/fallback behavior and ensure failures reach explicit empty/error UI; check empty files contain headers/schema only and no observations are fabricated.
- Confirm all 11 sidebar destinations render substantive pages; test major interactions including role/theme persistence, data filters, alert state transitions and threshold application, station dispatch suggestion, simulation controls, period comparison, search/sort/pagination, CSV export, audit persistence, settings, and mobile navigation.
- Check desktop/tablet/mobile layouts for horizontal overflow, keyboard-accessible controls, readable contrast, and theme consistency; verify chart/map states do not crash when datasets are empty.
- Deliver the running Preview URL, README, and project ZIP. State the Uttarakhand assumption, missing user datasets, any unavailable live sources/credentials, and the simulation/mock-login limitations.

## Assumptions and open risks

- Uttarakhand is a provisional choice made because the request used `[YOUR STATE / REGION]`; changing the region may require a new bounding box and region-specific zone files.
- No real history, boundary, station fallback, NDVI CSV, or FIRMS key was included. The page framework and integrations can be complete, but fire history, official zone comparisons and vegetation charts may legitimately show empty/incomplete states until data/key are supplied.
- Open-Meteo and Overpass are public services with availability/rate-limit/CORS dependencies; local fallback and source-status UI cover outages. NASA FIRMS uses a user-configured key and the direct client-side request exposes that key to visitors.
- A client-only app cannot keep user actions/audit logs synchronized across browsers or provide secure role enforcement; the requested localStorage demo behavior is not production access control.
- Risk and spread calculations are transparent educational approximations, not validated agency tools or emergency-response advice.
