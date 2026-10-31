import os
import sys
import json
import warnings
from typing import Optional, Dict, Any, List

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

# Silence harmless warnings during inference
warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Compatibility Shim for Scikit-Learn Model Unpickling
# Models trained with scikit-learn 1.6.1 require _RemainderColsList in
# sklearn.compose._column_transformer when loaded on newer versions.
# ---------------------------------------------------------------------------
import sklearn.compose._column_transformer as ct
if not hasattr(ct, "_RemainderColsList"):
    class _RemainderColsList(list):
        pass
    ct._RemainderColsList = _RemainderColsList

# ---------------------------------------------------------------------------
# Paths and Constants
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REG_PATH = os.path.join(BASE_DIR, "regression_model.pkl")
CLS_PATH = os.path.join(BASE_DIR, "classification_model.pkl")
META_PATH = os.path.join(BASE_DIR, "metadata.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")

PRICE_THRESHOLDS = {
    "Low_Max": 55.0,
    "Medium_Max": 93.0
}

# ---------------------------------------------------------------------------
# Model Loader with n_jobs=1 Optimization
# ---------------------------------------------------------------------------
models: Dict[str, Any] = {}
metadata: Dict[str, Any] = {}

def load_models_and_metadata():
    if not models.get("reg"):
        print("[INFO] Loading regression_model.pkl...")
        reg_model = joblib.load(REG_PATH)
        try:
            if hasattr(reg_model.named_steps.get("model", None), "regressor_"):
                reg_model.named_steps["model"].regressor_.n_jobs = 1
        except Exception:
            pass
        models["reg"] = reg_model

    if not models.get("clf"):
        print("[INFO] Loading classification_model.pkl...")
        clf_model = joblib.load(CLS_PATH)
        try:
            if hasattr(clf_model.named_steps.get("model", None), "n_jobs"):
                clf_model.named_steps["model"].n_jobs = 1
        except Exception:
            pass
        models["clf"] = clf_model
    
    if os.path.exists(META_PATH):
        with open(META_PATH, "r", encoding="utf-8") as f:
            metadata.update(json.load(f))
    else:
        prep = models["reg"].named_steps["prep"]
        cats = prep.named_transformers_["cat"].categories_
        locs = [str(x) for x in cats[0]]
        areas = [str(x) for x in cats[1]]
        classes = [str(c) for c in getattr(models["clf"], "classes_", ["Low", "Medium", "High"])]
        metadata["locations"] = sorted(locs, key=lambda x: (x == "other", x.lower()))
        metadata["area_types"] = sorted(areas)
        metadata["classes"] = classes
        metadata["default_location"] = "Whitefield" if "Whitefield" in locs else locs[0]
        metadata["default_area_type"] = areas[0]
        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

    print(f"[INFO] Ready with {len(metadata.get('locations', []))} locations and {len(metadata.get('area_types', []))} area types.")

# Load models and metadata
load_models_and_metadata()

app = FastAPI(
    title="Bengaluru House Price Prediction API",
    description="Dual-task ML Web Service (Regression for exact price + Classification for price tier)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request and Response Schemas
# ---------------------------------------------------------------------------
class HousePredictionRequest(BaseModel):
    total_sqft: float = Field(..., gt=100, lt=50000, description="Total property area in sq. ft.")
    bath: float = Field(..., ge=1, le=20, description="Number of bathrooms")
    bhk: float = Field(..., ge=1, le=20, description="Number of bedrooms (BHK)")
    location: str = Field(..., description="Neighbourhood location in Bengaluru")
    area_type: str = Field(..., description="Area type specification")


class PredictionResponse(BaseModel):
    predicted_price_lakhs: float
    formatted_inr: str
    price_per_sqft: float
    formatted_price_per_sqft: str
    predicted_category: str
    category_probabilities: Dict[str, float]
    sqft_per_bhk: float
    warnings: List[str]
    thresholds: Dict[str, float]
    input_received: Dict[str, Any]


def format_inr(lakhs: float) -> str:
    """Formats amount in Indian numbering format (Lakhs / Crores)."""
    if lakhs >= 100:
        cr = lakhs / 100
        return f"₹ {cr:.2f} Cr"
    return f"₹ {lakhs:.2f} Lakh"


# ---------------------------------------------------------------------------
# API Endpoints (Sync def allows threadpool execution for CPU-bound ML)
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": "reg" in models and "clf" in models,
        "locations_count": len(metadata.get("locations", []))
    }


@app.get("/api/metadata")
def get_metadata():
    return {
        "locations": metadata.get("locations", []),
        "area_types": metadata.get("area_types", []),
        "classes": metadata.get("classes", ["Low", "Medium", "High"]),
        "default_location": metadata.get("default_location", "Whitefield"),
        "default_area_type": metadata.get("default_area_type", "Super built-up  Area"),
        "thresholds": PRICE_THRESHOLDS,
        "presets": [
            {
                "name": "Affordable 2 BHK - Electronic City",
                "description": "Standard budget apartment in tech hub",
                "data": {
                    "total_sqft": 1050,
                    "bhk": 2,
                    "bath": 2,
                    "location": "Electronic City Phase II",
                    "area_type": "Super built-up  Area"
                }
            },
            {
                "name": "Spacious 3 BHK - Whitefield",
                "description": "Family home in prominent residential corridor",
                "data": {
                    "total_sqft": 1650,
                    "bhk": 3,
                    "bath": 3,
                    "location": "Whitefield",
                    "area_type": "Super built-up  Area"
                }
            },
            {
                "name": "Premium 4 BHK Villa - Indiranagar",
                "description": "Luxury standalone plot area in central Bengaluru",
                "data": {
                    "total_sqft": 3200,
                    "bhk": 4,
                    "bath": 4,
                    "location": "Indira Nagar",
                    "area_type": "Plot  Area"
                }
            },
            {
                "name": "Compact 1 BHK - HSR Layout",
                "description": "Urban starter home near startups and dining",
                "data": {
                    "total_sqft": 650,
                    "bhk": 1,
                    "bath": 1,
                    "location": "HSR Layout",
                    "area_type": "Super built-up  Area"
                }
            }
        ]
    }


@app.post("/api/predict", response_model=PredictionResponse)
def predict_house(payload: HousePredictionRequest):
    if "reg" not in models or "clf" not in models:
        load_models_and_metadata()

    loc = payload.location.strip()
    available_locs = metadata.get("locations", [])
    if loc not in available_locs:
        match = next((l for l in available_locs if l.lower() == loc.lower()), None)
        loc = match if match else "other"

    area = payload.area_type.strip()
    available_areas = metadata.get("area_types", [])
    if area not in available_areas:
        match_area = next((a for a in available_areas if a.strip().lower() == area.lower()), None)
        area = match_area if match_area else available_areas[0]

    input_df = pd.DataFrame([{
        "total_sqft": float(payload.total_sqft),
        "bath": float(payload.bath),
        "bhk": float(payload.bhk),
        "location": loc,
        "area_type": area
    }])

    # 1. Regression
    try:
        raw_reg = float(models["reg"].predict(input_df)[0])
        pred_lakhs = max(round(raw_reg, 2), 1.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regression error: {str(e)}")

    # 2. Classification
    try:
        pred_category = str(models["clf"].predict(input_df)[0])
        category_probs = {}
        if hasattr(models["clf"], "predict_proba"):
            probs = models["clf"].predict_proba(input_df)[0]
            classes = [str(c) for c in models["clf"].classes_]
            for c, p in zip(classes, probs):
                category_probs[c] = round(float(p) * 100, 1)
        else:
            category_probs[pred_category] = 100.0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification error: {str(e)}")

    price_per_sqft = (pred_lakhs * 100000.0) / payload.total_sqft
    sqft_per_bhk = payload.total_sqft / payload.bhk

    # Notebook outlier rules
    warnings_list: List[str] = []
    if sqft_per_bhk < 300:
        warnings_list.append(
            f"Average room size ({sqft_per_bhk:.0f} sq.ft/BHK) is under 300 sq.ft/BHK (outlier threshold in notebook)."
        )
    if payload.bath > payload.bhk + 2:
        warnings_list.append(
            f"Bathrooms ({int(payload.bath)}) exceed BHK ({int(payload.bhk)}) by more than 2 (outlier rule in notebook)."
        )
    if payload.location.strip() not in available_locs and loc == "other":
        warnings_list.append(
            f"Locality '{payload.location}' was not in 240 primary training areas; mapped to 'other'."
        )

    return PredictionResponse(
        predicted_price_lakhs=pred_lakhs,
        formatted_inr=format_inr(pred_lakhs),
        price_per_sqft=round(price_per_sqft, 2),
        formatted_price_per_sqft=f"₹ {round(price_per_sqft):,} / sq.ft",
        predicted_category=pred_category,
        category_probabilities=category_probs,
        sqft_per_bhk=round(sqft_per_bhk, 1),
        warnings=warnings_list,
        thresholds=PRICE_THRESHOLDS,
        input_received={
            "total_sqft": payload.total_sqft,
            "bath": payload.bath,
            "bhk": payload.bhk,
            "location": loc,
            "area_type": area
        }
    )


# Mount static
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"message": "Bengaluru House Price Prediction API is live."})


if __name__ == "__main__":
    import uvicorn
    print("\nStarting Bengaluru House Price Prediction Server on http://127.0.0.1:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
