PROJECT: ForestGuard AI, an ML-based forest fire RISK PREDICTION system.
It predicts Low / Medium / High / Extreme risk BEFORE ignition from weather + vegetation data, and shows early warnings on a dashboard.
Region: Uttarakhand, India (bbox W,S,E,N = 77.6,28.7,81.1,31.5).

ABSOLUTE RULE - FRONTEND LOOK IS FROZEN
The React frontend is already published. Do NOT change its design: layouts, colors, fonts, spacing, components, animations, navigation, page list, dark mode. Do NOT delete or restyle any existing page. You may only:
  (a) change the data sources/logic behind existing screens,
  (b) rename risk labels (Moderate->Medium, Critical->Extreme) keeping the same colors,
  (c) add new items (a "Model" page, small badges) built ONLY from existing components and styles.

DATA HONESTY
Never fabricate observations. If data cannot be downloaded, stop and tell me exactly why. Synthetic data is allowed only if the file name says "synthetic" and the UI labels it.

SECURITY
API keys only in backend/.env or ml/.env, never in VITE_ variables or frontend code. Commit only .env.example files with no values.

QUALITY
- Every ML claim must be backed by saved metrics in ml/reports/.
- Student-friendly, commented code, minimal dependencies, pinned versions.
- Reuse the same feature-building code (ml/features.py) for training and serving.
- After every change run the relevant build/tests and report the real output.

WORKFLOW
Use Planning mode. Before each phase produce an Implementation Plan artifact and wait for my approval. After each phase STOP, summarise what changed, show test/build output, and wait for "continue". Never skip phases or combine them.