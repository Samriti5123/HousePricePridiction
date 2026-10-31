import sys
import main

# Ensure utf-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

print("Testing health_check...")
h = main.health_check()
print("Health:", h)
assert h["status"] == "healthy"

print("Testing get_metadata...")
meta = main.get_metadata()
print(f"Metadata: {len(meta['locations'])} locations, {len(meta['area_types'])} area types, {len(meta['presets'])} presets")
assert len(meta['locations']) == 241

print("Testing predict_house with Whitefield 2BHK...")
req = main.HousePredictionRequest(
    total_sqft=1200,
    bath=2,
    bhk=2,
    location="Whitefield",
    area_type="Super built-up  Area"
)
res = main.predict_house(req)
print("Prediction succeeded:")
print(" - Predicted Price:", res.predicted_price_lakhs, "Lakhs (", res.formatted_inr, ")")
print(" - Predicted Category:", res.predicted_category)
print(" - Category Probabilities:", res.category_probabilities)
print(" - Rate / SqFt:", res.formatted_price_per_sqft)
print(" - Warnings:", res.warnings)
assert res.predicted_price_lakhs > 0
assert res.predicted_category in ["Low", "Medium", "High"]

print("\nTesting outlier warning with cramped 500 sqft with 4 baths...")
req_outlier = main.HousePredictionRequest(
    total_sqft=500,
    bath=4,
    bhk=1,
    location="Indira Nagar",
    area_type="Super built-up  Area"
)
res_outlier = main.predict_house(req_outlier)
print("Outlier warnings received:")
for w in res_outlier.warnings:
    print(" *", w)
assert len(res_outlier.warnings) > 0

print("\nALL BACKEND & MODEL PREDICTION CHECKS PASSED WITH 100% SUCCESS!")
