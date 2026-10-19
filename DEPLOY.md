# Deploying ForestGuard AI to Render (Free Tier)

This guide walks you through deploying the single-server **ForestGuard AI** system to a free web service on [Render](https://render.com).

---

## 1. Important Architecture Notes

### Free Disk is Temporary (Ephemeral)
Render's free web service instances run on **ephemeral (temporary) storage**. Any files written to the local disk during runtime are discarded whenever the instance restarts or spins down after inactivity.
- **Backend Audit:** ForestGuard AI is architected so that **the backend writes zero files at runtime**. All runtime caching (e.g. Open-Meteo forecasts, FIRMS rate-limiting cooldowns) is handled in memory via `cachetools.TTLCache`.
- An audit of the runtime backend codebase (`backend/main.py`, `backend/weather_service.py`, `backend/model_service.py`) confirms that no write calls (`open(..., "w")` or `.write()`) occur during request serving.

### Refresh the Fallback Forecast Before Deploying
Because Render instances sleep after 15 minutes of inactivity, the server relies on the pre-generated static cache in `backend/cache/forecast_latest.json` for instant cold-start responses and offline fallback.
**Immediately before each deploy**, the project owner should refresh this cache with live forecasts:
```bash
# 1. Ensure you have an active internet connection
# 2. Run the forecast exporter from the project root
python -m backend.export_static_forecast

# 3. Verify the updated cache file
git status backend/cache/forecast_latest.json

# 4. Commit and push
git add backend/cache/forecast_latest.json
git commit -m "chore(cache): refresh 7-day forecast cache"
git push origin main
```

---

## 2. Step-by-Step Deployment (Blueprint)

### Step 1: Create a Render Account
1. Visit [render.com](https://render.com) and click **Get Started for Free**.
2. Sign up using your GitHub account (recommended for seamless repository access).

### Step 2: Create a New Blueprint Instance
1. In the Render Dashboard, click the **New +** button in the top navigation bar.
2. Select **Blueprint** from the dropdown menu.
3. Choose **Connect a repository** and select your `ForestGuard-AI` GitHub repository.
4. Render will detect the [`render.yaml`](render.yaml) file at the root of the repository.
5. Click **Connect**.

### Step 3: Enter Optional Secrets
Render reads the `envVars` declared in `render.yaml`. Because `FIRMS_MAP_KEY` is configured with `sync: false`, Render will prompt you for its value:
- **`FIRMS_MAP_KEY`**: Paste your NASA FIRMS Map Key (if you have one). If you don't have a key, leave it blank; the app will safely run in fallback mode with historical fire observations.
- Click **Apply** to start provisioning.

### Step 4: Monitor the Build
Render will clone your repository and execute the build command:
```bash
pip install -r requirements-serve.txt
```
The build typically finishes in 40–70 seconds. Watch the build logs until you see:
```text
==> Running 'uvicorn backend.main:app --host 0.0.0.0 --port $PORT'
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
```
Render automatically checks `GET /health` (`healthCheckPath: /health`). Once the health check returns HTTP 200, the deployment is marked **Live**.

### Step 5: Open the URL
Render assigns your service a public URL, for example:
`https://forestguard-ai.onrender.com`
Click the link at the top of the service page in your dashboard to open the application.

---

## 3. Post-Deployment Verification

Verify that the application is operating correctly:
1. **Health Check:** Open `https://your-service.onrender.com/health` in your browser. Verify you receive a JSON response showing `"status": "ok"` or `"status": "degraded"` (if weather cache is older than 24h) and `"model_loaded": true`.
2. **Dashboard:** Open the root URL (`https://your-service.onrender.com/`). The dashboard should load with KPI cards, risk levels for Uttarakhand districts, and recent fire detections.
3. **Model Page:** Click **Model** in the sidebar. Verify that validation metrics (F1 score, precision, recall) and report charts render properly.
4. **Automated Smoke Test:** Run the included smoke test script locally against your live deployment:
   ```bash
   python scripts/smoke_test.py https://your-service.onrender.com
   ```
   All 7 checks (health, 13 zones, 3-day forecast date attribution, model metrics, HTML root, SPA fallback, and security blocks) should display `[PASS]`.

---

## 4. How to Redeploy After Updates

- **Automatic Deploys:** Whenever you push new commits to your connected GitHub branch (e.g. `git push origin main`), Render triggers an automatic build and zero-downtime redeployment.
- **Manual Deploys:** In the Render Dashboard, open your `forestguard-ai` service, click **Manual Deploy** in the top right, and select **Deploy latest commit** (or **Clear build cache & deploy** if troubleshooting dependencies).

---

## 5. Troubleshooting & Common Failures

### 1. Python Version Configuration & Fallback
- **Exact Syntax:** According to official Render documentation ([Setting Your Python Version](https://render.com/docs/python-version)), specifying a Python version via environment variable requires a fully qualified version (major, minor, and patch, e.g. `3.13.2`):
  ```yaml
  envVars:
    - key: PYTHON_VERSION
      value: 3.13.2
  ```
- **What happens if the version is unavailable:** If a specified `PYTHON_VERSION` is invalid or not yet built in Render's environment, the build will halt with an error indicating the unsupported version.
- **Fallback (`.python-version`):** The repository includes a [`.python-version`](.python-version) file at the root containing `3.13`. Render reads `.python-version` as a fallback, and allows omitting the patch version; Render will automatically resolve and install the latest available patch release for Python 3.13.

### 2. Build Failure on `shapely` or C-extensions
If a build fails compiling C extensions, verify that `requirements-serve.txt` pins `shapely==2.2.0` and `scikit-learn==1.8.0`. These packages have pre-compiled binary wheels (`manylinux`) on PyPI for Python 3.13, so no native C toolchain or `gcc` is required on the host.

### 3. Out of Memory (OOM 512 MB)
Render's free tier provides 512 MB of RAM. ForestGuard AI has been profiled under live 6-thread Open-Meteo fetches, polygon filtering, and model inference at **~193 MB peak working set**, comfortably below 512 MB.
If your service ever encounters memory pressure:
- Ensure uvicorn runs with a single worker (default in startCommand). Do not add `--workers` > 1 on the free tier.
- Avoid large in-memory batch arrays; ForestGuard processes Uttarakhand's 13 districts sequentially or with a small 6-thread pool.

### 4. Port Binding Failure
Render assigns an arbitrary port via the `$PORT` environment variable (typically 10000). The start command in `render.yaml` must bind to `--host 0.0.0.0 --port $PORT`. Do not hardcode port 8000 in `startCommand`.

### 5. Cold Starts (30–60 Second Delay)
On the free plan, Render spins down web services after 15 minutes of inactivity. When a user visits a sleeping service:
- The first HTTP request wakes up the container, which takes 30–60 seconds.
- ForestGuard's frontend handles this gracefully: after 2.5 seconds, the UI automatically displays `"Waking up the server (this may take up to 10 seconds)..."` and `"Connecting to cold-started FastAPI backend instance..."`. Once awake, all subsequent requests are fast.
