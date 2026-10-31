import sys
import time
import requests
from fastapi.testclient import TestClient
from main import app

print("Initializing TestClient...")
with TestClient(app) as client:
    # 1. Health check
    res_health = client.get("/api/health")
    print("Health Status:", res_health.status_code, res_health.json())
    assert res_health.status_code == 200

    # 2. Metadata check
    res_meta = client.get("/api/metadata")
    print("Metadata Status:", res_meta.status_code)
    meta = res_meta.json()
    print(f"Loaded {len(meta['locations'])} locations and {len(meta['area_types'])} area types.")
    assert len(meta['locations']) > 200

    # 3. Predict check - standard 2 BHK Whitefield
    payload = {
        "total_sqft": 1200,
        "bath": 2,
        "bhk": 2,
        "location": "Whitefield",
        "area_type": "Super built-up  Area"
    }
    res_predict = client.post("/api/predict", json=payload)
    print("Prediction Status:", res_predict.status_code)
    pred_data = res_predict.json()
    print("Prediction Result:")
    print(" - Price:", pred_data["predicted_price_lakhs"], "Lakhs (", pred_data["formatted_inr"], ")")
    print(" - Tier:", pred_data["predicted_category"])
    print(" - Probabilities:", pred_data["category_probabilities"])
    print(" - Rate / sqft:", pred_data["formatted_price_per_sqft"])
    assert res_predict.status_code == 200

    # 4. Check index page serving
    res_index = client.get("/")
    print("Index Page Status:", res_index.status_code)
    assert res_index.status_code == 200
    assert "Bengaluru House Price" in res_index.text

print("\nALL BACKEND AND FRONTEND CHECKS PASSED PERFECTLY!")
