# Bengaluru House Price Prediction - Full Stack Web Application

A machine learning web application to predict residential real estate valuations and market price tiers across Bengaluru, India.

## Features

- **Dual-Engine Machine Learning**:
  - **Regression (Random Forest)**: Predicts exact valuation in Lakhs of INR (and Crores), rate per sq. ft., and BHK area density. Trained on `log(price)` with automatic inverse transformation (`expm1`).
  - **Classification (Random Forest)**: Predicts price tier category (**Low**: $\le 55$ Lakhs, **Medium**: $55 - 93$ Lakhs, **High**: $> 93$ Lakhs) with confidence probability breakdowns.
- **Robust Model Loading**:
  - Includes compatibility shim (`_RemainderColsList`) to load pipelines across scikit-learn versions without errors.
  - Automatically loads and matches all 241 localities and 4 area types extracted directly from the fitted `OneHotEncoder`.
  - Sets `n_jobs=1` for single-sample inference latency under 0.4 seconds.
- **Modern Responsive Frontend**:
  - **Searchable Autocomplete Combobox**: Search through all 241 Bengaluru localities.
  - **Presets Quick Picks**: One-click test scenarios (Electronic City, Whitefield, Indiranagar, HSR Layout).
  - **Interactive Area & Room Controls**: Synced sliders, stepper buttons, and segmented controls.
  - **Data Outlier & Rule Advisory**: Automatically checks room density ($< 300\text{ sq.ft/BHK}$) and bathroom anomalies based on notebook rules.
- **FastAPI REST Backend**:
  - CORS-enabled REST endpoints for `/api/predict`, `/api/metadata`, `/api/health`.

---

## Quick Start

### 1. Launch the Application
Run:
```bash
python run.py
```
Or double-click `run.bat`.

The server starts on `http://127.0.0.1:8000` and automatically opens in your default browser.

---

## File Structure

```
d:\house prediction\
├── main.py                    # FastAPI application & ML inference endpoints
├── run.py                     # Launcher script with auto-browser opening
├── run.bat                    # One-click Windows batch runner
├── requirements.txt           # Dependencies
├── regression_model.pkl       # Fitted Random Forest Regressor Pipeline
├── classification_model.pkl   # Fitted Random Forest Classifier Pipeline
├── metadata.json              # Extracted categories (241 locations & 4 area types)
├── verify_endpoints.py        # Automated test suite
├── static\
│   ├── index.html             # UI layout and structure
│   ├── css\
│   │   └── style.css          # Dark slate glassmorphism theme & styles
│   └── js\
│       └── app.js             # Autocomplete combobox, API interaction & animations
└── README.md
```
