# ForestGuard AI — Team Guide

## Option A: Use the live link

**Live dashboard:** `https://forestguard-ai-n78g.onrender.com`

Open the link in any modern browser. No installation needed.

> **Note on Free-Tier Wake-Up:** The cloud server automatically sleeps after 15 minutes of inactivity. When opening the app for the first time, it may take 30–60 seconds to wake up (the dashboard will display *"Waking up the server..."*). Once awake, pages respond immediately.

---

## Option B: Run locally (Windows)

**Requirements:** Python 3.13 — download from [python.org/downloads](https://python.org/downloads/) and tick *"Add Python to PATH"* during setup. No Node.js, no Docker.

1. Unzip **ForestGuard-AI-share.zip** (e.g., right-click → *Extract All*). `run.bat` and `run.sh` are located directly at the top level of the extracted folder.
2. Double-click **`run.bat`** (or run it in a terminal).
   - It creates a `.venv`, installs packages (~1 min first time, fast after), and opens **http://127.0.0.1:8000** automatically.
3. The terminal window must stay open while you use the app. Close it or press **Ctrl+C** to stop.

**macOS / Linux:** open a terminal in the extracted folder and run `chmod +x run.sh && ./run.sh`.

---

## What the pages show

| Page | What it does |
|---|---|
| **Dashboard** | Live KPI cards — today's forecast risk per district, cache age, weather source. |
| **Map / Vulnerable areas** | District risk map; click a district for detail. |
| **7-Day Forecast** | Daily risk predictions for all 13 Uttarakhand districts. |
| **Model** | ML model metrics, calibration chart, feature importances. |
| **Analytics / History** | Charts and a searchable log of past fire detections. |
| **Simulation** | Educational spread ellipse — not an operational prediction. |

---

## "Stale" or "Expired forecast" warning

The forecast is generated from live Open-Meteo weather data. If the server cannot reach the internet (or the cache is older than 24 h), the header shows **"Stale"** or **"Cached"**. The risk numbers are still from the ML model — only the input weather data is older. Restart the server with internet access to refresh.

---

## Live-fires layer (off by default)

The satellite fire-detection layer (NASA FIRMS / VIIRS) requires a free **NASA FIRMS Map Key**. Without a key the layer shows historical fallback data labelled "Fallback". To enable live detections:

1. Register at [firms.modaps.eosdis.nasa.gov](https://firms.modaps.eosdis.nasa.gov/api/area/).
2. Add `FIRMS_MAP_KEY=your_key_here` to `backend/.env`.
3. Restart the server.

---

## Port 8000 is already in use?

- **Windows:** open Task Manager → Details → find a process using port 8000: `netstat -ano | findstr :8000`, then `taskkill /PID <pid> /F`.
- **macOS/Linux:** `lsof -ti :8000 | xargs kill -9`.
- Or just restart your computer — then run `run.bat` again.

---

*This is a student ML project — not an operational emergency-dispatch system.*
