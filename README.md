# ForestGuard AI — ML-Based Forest Fire Risk Prediction System

**AI-Based Forest Fire Risk Prediction System** is an intelligent ML solution that analyzes historical daily weather, evaporative demand, and soil moisture observations with machine learning to predict pre-ignition fire risk as Low, Medium, High, or Extreme, providing early warnings through a user-friendly dashboard so authorities can take preventive measures.

> **Environment Requirements:** Python `3.13` (strictly required for Docker builds, CI, and Render/cloud deployments to ensure binary compatibility with scikit-learn `1.8.0`, numpy `2.4.1`, and joblib `1.5.3` model artifacts; see `.python-version`), Node.js 22+ and npm 10+ (for frontend).
> **Vegetation Representation:** Vegetation dryness is represented strictly by topsoil volumetric moisture (`soil_moisture_0_to_7cm_mean`) and FAO-56 Penman-Monteith reference evapotranspiration (`et0`) proxies from ERA5-Land/Open-Meteo. Satellite NDVI is not ingested.
> Live observations, cached responses and fallback files remain distinguishable. Empty files stay empty. Fire-engine readiness, crew, water and response metrics are simulated and labelled; the app is not a public-safety or emergency-dispatch system.

## Quick start

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
cp .env.example .env
npm run dev
```

Vite prints a local address (normally `http://localhost:5173`). The server listens on `0.0.0.0` in this project so it works in managed preview environments. Build and serve the static output with:

```bash
npm run build
npm run preview
```

The project uses pinned versions in `package.json` and `package-lock.json`. `npm run check` runs the production build.

## Optional environment configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_FIRMS_KEY` | empty | Optional NASA FIRMS Map Key for `VIIRS_SNPP_NRT` fire observations over the configured bounding box. |
| `VITE_REGION_NAME` | `Uttarakhand, India` | Display name for the selected study region. |
| `VITE_FIRMS_BBOX` | `77.6,28.7,81.1,31.5` | FIRMS / Overpass order: west,south,east,north. |

**Credential warning:** values prefixed with `VITE_` are compiled into browser code and visible to site visitors. Use only a key intended for public client-side use; never put private credentials in `.env`, source control, or a public deployment. No key was provided for this project, so the bundled FIRMS history is an empty, header-only fallback. Without your own data or key, fire-specific metrics correctly show unavailable/empty states.

The default region is a provisional choice because the original brief used a `[YOUR STATE / REGION]` placeholder. It is not an official forest boundary. For another study area, change the name and bounding box, replace the supplied zone GeoJSON, and consider provider coverage and tile/API terms.

## Pages

All eleven page routes are declared in [`public/manus-routes.json`](public/manus-routes.json) and linked from the sidebar.

1. **Project overview / demo login** (`/login`) — generated forest hero, how-it-works, data readiness, provisional region, and mock Admin / Forest Officer role selection. This is not authentication.
2. **Dashboard** (`/dashboard`) — source-aware KPI cards, fire/map context, current weather, fire trend, alert feed, risk summary and quick links. Missing source evidence appears as missing, not as an invented zero.
3. **Fire engine** (`/fire-engine`) — OpenStreetMap fire-station locations; readiness, crew and water are explicitly simulated; nearest-station straight-line recommendation and dispatch interface.
4. **Forest health** (`/forest-health`) — supplied monthly NDVI plus per-zone Open-Meteo measurements, five-input health index, NDVI trend, moisture/dryness view, comparison and detail drawer.
5. **Vulnerable areas** (`/vulnerable-areas`) — zone risk map/table, ranked areas, filters and factor explanation when genuine boundaries and complete observations are available.
6. **Hotspot simulation** (`/simulation`) — choose an ignition point, tune wind/humidity/temperature/dryness, apply live weather where available, play or instantly show an educational ellipse, view affected loaded OSM settlements, save locally.
7. **Risk change detection** (`/change-detection`) — user-selected A/B windows, same fire-frequency normalization basis for both periods, map swipe, deltas and honest incomplete-data states. Historical weather is not inferred.
8. **Alert center** (`/alerts`) — real loaded detections only, editable confidence/FRP thresholds, severity/state filters and acknowledgement, resolution and dispatch flows.
9. **Analytics** (`/analytics`) — charts and CSV/print actions from available records. Any operational response-time trend is labelled simulated.
10. **History** (`/history`) — filterable, searchable, sortable and paginated source-record view with detection details and CSV export.
11. **Audit log & settings** (`/audit-settings`) — actual in-app actions in browser-local storage; profile, thresholds, active notification preferences, appearance and data source status.

## Data sources and attribution

Every live request has loading/empty/error handling and the relevant local fallback. Session cache entries keep their original source/fallback error; cached live data are labelled `Cached`, while a cached fallback remains `Fallback`.

| Source | Use | Terms / notes |
| --- | --- | --- |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | Recent VIIRS `VIIRS_SNPP_NRT` fire observations | Requires the user's optional Map Key. Cite NASA FIRMS as the source. The bundled `public/data/fires_history.csv` contains a header only. |
| [Open-Meteo](https://open-meteo.com/) | Current/hourly temperature, humidity, precipitation, wind and soil moisture at the region/zone centroids | Public API, no key in this app. Open-Meteo asks for attribution under [CC BY 4.0](https://open-meteo.com/en/terms); retain the source labels shown in the UI. |
| [OpenStreetMap Overpass](https://overpass-api.de/) | Real fire stations and village/town points | Public query service; coverage/response depends on OSM tagging, CORS and server load. OSM data is [ODbL](https://www.openstreetmap.org/copyright); the map displays attribution. `public/data/fire_stations.geojson` is empty until user data is supplied. |
| [OpenHikingMap / OpenMaps.fr tiles](https://openmaps.fr/tile-usage-policy.html) | OSM-derived forest/outdoor raster basemap | Selected because standard OSM tiles were blocked in the managed preview. OpenMaps.fr states non-commercial use, low volume (rule of thumb under 400,000 tiles/month), no SLA, valid browser Referer and visible OpenHikingMap, donation-link and OpenStreetMap attribution. Read the provider policy before changing the endpoint or using it outside this educational low-volume project. |
| `public/data/zones.geojson` | User's forest/administrative zone polygons | Empty valid GeoJSON FeatureCollection; not an official boundary dataset. |
| `public/data/ndvi.csv` | User's monthly vegetation observations | Empty header-only CSV; no NDVI is fabricated. |
| `public/data/weather.json` | Offline weather fallback | Explicitly empty. No weather observations are fabricated. |

### Accepted input schemas

- **FIRMS history CSV:** standard NASA FIRMS columns; required for a plotted record are `latitude` and `longitude`; date/time, `confidence`, `frp`, `satellite`, `instrument`, and `daynight` enrich it. The bundled template preserves the VIIRS standard headers.
- **Zones:** a GeoJSON `FeatureCollection` with Polygon/MultiPolygon geometries. Include `properties.name` (or `zone`, `district`, or `division`) so weather, NDVI and map rows can be matched.
- **NDVI CSV:** header `zone,month,ndvi`; `zone` must match the zone label, `month` should sort as `YYYY-MM`, and `ndvi` should be numeric.
- **Station fallback:** a GeoJSON `FeatureCollection` of Point features. `properties.name` is recommended; a missing `properties.type` defaults to a station.
- **Weather fallback:** the bundled file has `current: null` and no hourly records; live Open-Meteo is used where reachable.

## Explainable indices and simulation

### Zone risk score

Each factor is normalized to 0–100:

- Fire frequency = `zone fire count / maximum zone fire count × 100` (0 when loaded counts are all zero; unavailable when the fire source is not usable).
- Inverse humidity = `100 − relative humidity (%)`.
- Wind = `wind speed (m/s) / 20 × 100`, capped at 100.
- Dryness = `100 − soil moisture (%)`; if soil moisture is missing, use `100 − NDVI (% scale)`.

`risk = 0.35 × frequency + 0.25 × inverse humidity + 0.20 × wind + 0.20 × dryness`.

A score is shown only when all four factors are real/available; missing input is not treated as a neutral or harmless reading. For Period A/B, fire frequency uses the **same maximum zone count across both chosen windows**, so frequency normalization cannot change merely because the denominator was recomputed independently. The comparison intentionally reuses current weather/vegetation values in both periods; it is not a historical reconstruction.

### Forest-health index

The separate forest-health score requires **all five** measured inputs: supplied NDVI, Open-Meteo soil moisture, humidity, temperature and current precipitation. They are normalized and combined as:

`health = 0.30 × NDVI support + 0.25 × soil moisture + 0.20 × humidity + 0.15 × temperature comfort + 0.10 × rainfall support`.

Temperature comfort is `clamp(100 − 3 × |temperature °C − 20|)`; current rainfall support is `clamp(mm / 10 × 100)`. Each factor is bounded to 0–100. The index is a transparent student-project heuristic, not a forestry survey or validated ecological assessment. If any required factor is missing, the health score stays unavailable.

### Elliptical spread demonstration

For wind speed `w` (m/s), fuel dryness `d` (%), humidity `h` (%), temperature `t` (°C), and duration `H` (hours):

```text
moistureFactor = clamp(1 + (50 − h)/150 + (t − 25)/250, 0.55, 1.35)
baseRateMMin   = (0.2 + 0.04 × w + 0.003 × d) × moistureFactor
majorRadiusM   = baseRateMMin × H × 60 × (1 + w/20)
minorRadiusM   = majorRadiusM / (1 + w/10)
areaHa         = π × majorRadiusM × minorRadiusM / 10,000
```

The ellipse is oriented downwind; displayed affected settlements are loaded OSM village/town points inside that geometric approximation. It is deterministic and explicitly educational—not machine learning, a validated fire model, an agency forecast, or emergency-response guidance.

## App behavior and limitations

- The project has **no custom backend or database**. Mock roles, preferences, alert statuses, saved scenarios, and audit records live in this browser only and can be edited by the user; they do not provide access control or cross-device synchronization.
- Actual source records are distinguished from simulated operational values. The audit log writes real app interactions only; it does not fabricate operational events.
- `VITE_FIRMS_KEY` is browser-visible. A production service should proxy a provider key on a secured server if its terms allow it; this project intentionally remains frontend-only.
- Live APIs and tile services can be offline, rate-limited, blocked or changed. Tile style/service uptime is best-effort; a missing basemap does not make the fire/health calculations valid. Check each source badge and last-updated time.
- OpenStreetMap/OpenHikingMap labels, coverage and settlement/station completeness depend on mapping. “Nearest station” uses straight-line distance, not road-network routing. Station availability/crew/water remain simulated.
- This project is a student demonstration, not an operational wildfire monitoring or dispatch tool.

## Project structure

```text
public/
  data/                 # Empty schemas/fallback data, never fabricated observations
  forestguard-hero.webp # Generated landing-page hero image bundled locally
  forestguard-mark.svg  # Site mark
  manus-routes.json     # All 11 page routes for Webdev route discovery
src/
  components/           # Leaflet map, nav, cards, modals, drawers and toasts
  context/              # Demo auth, data loading, theme and alert state
  data/                 # Central configurable region/bounds
  pages/                # One implementation per requested route
  services/             # FIRMS, weather, OSM, risk, spread simulation, audit and cache
  utils/                # Storage, geo, CSV, formatters and zone weather hook
  App.jsx               # Route definitions and shared responsive shell
  main.jsx              # Router/providers/app mounting
  index.css             # Design system, controls and responsive styles
README.md               # This setup, source, formula and viva guide
TODO.md                 # Outcome checklist
app.config.ts           # Manus project logo metadata
```

## Viva quick answers

**Why is the app frontend-only?** The brief explicitly asks for a frontend-only project with no sensor/IoT implementation or custom backend; public APIs and local files cover the demonstration.

**Where does fire data come from?** NASA FIRMS `VIIRS_SNPP_NRT` for the configured bounding box, if a Map Key is supplied. Otherwise the app reads the bundled/user FIRMS-format history file and shows its true fallback status.

**How does the risk score work?** It normalizes fire frequency, inverse humidity, wind and dryness to 0–100, applies weights 0.35/0.25/0.20/0.20, and withholds the score if any required factor is unavailable.

**How is the spread area calculated?** A deterministic heuristic estimates a wind-stretched ellipse from a documented spread rate; the area is `π × major radius × minor radius`. It is explicitly not an operational prediction.

**Are engine status and response values real?** No. They are marked simulated; only mapped station positions are from OpenStreetMap.

**Why are some charts empty?** No FIRMS key, fire history, forest boundaries, NDVI observations or offline weather were supplied. The app intentionally does not invent them; populate the documented files or configure the optional public client key.

**Is the login secure?** No. It is local demo-role selection only. There is no user database, backend or authentication boundary.
