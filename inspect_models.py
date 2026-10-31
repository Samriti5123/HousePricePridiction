import warnings
warnings.filterwarnings("ignore")

import sys
import json
import joblib
import pandas as pd
import numpy as np

# Compatibility shim for scikit-learn version differences (e.g., pickled with 1.6.1, loaded on 1.9.0)
import sklearn.compose._column_transformer as ct
if not hasattr(ct, "_RemainderColsList"):
    class _RemainderColsList(list):
        pass
    ct._RemainderColsList = _RemainderColsList

print("Loading models...")
reg = joblib.load("regression_model.pkl")
clf = joblib.load("classification_model.pkl")

print("Regression model loaded:", type(reg))
print("Classification model loaded:", type(clf))

# Extract feature names & categories
prep = reg.named_steps["prep"]
cat_trans = prep.named_transformers_["cat"]
categories = cat_trans.categories_

locations = [str(x) for x in categories[0]]
area_types = [str(x) for x in categories[1]]

print(f"Number of locations: {len(locations)}")
print("Area types:", area_types)

# Test regression & classification with a test house
test_house = pd.DataFrame([{
    "total_sqft": 1200.0,
    "bath": 2.0,
    "bhk": 2.0,
    "location": "Whitefield" if "Whitefield" in locations else locations[0],
    "area_type": area_types[0]
}])

pred_price = float(reg.predict(test_house)[0])
pred_class = str(clf.predict(test_house)[0])

probs = {}
if hasattr(clf, "predict_proba"):
    clf_probs = clf.predict_proba(test_house)[0]
    classes = [str(c) for c in clf.classes_]
    probs = {c: round(float(p) * 100, 2) for c, p in zip(classes, clf_probs)}

print("Test sample house:", test_house.to_dict(orient="records")[0])
print(f"Predicted price: {pred_price:.2f} lakhs")
print(f"Predicted class: {pred_class}")
print(f"Class probabilities: {probs}")

metadata = {
    "locations": sorted(locations, key=lambda x: (x == "other", x.lower())),
    "area_types": sorted(area_types),
    "classes": [str(c) for c in getattr(clf, "classes_", ["Low", "Medium", "High"])],
    "default_location": "Whitefield" if "Whitefield" in locations else locations[0],
    "default_area_type": area_types[0]
}

with open("metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)

print("metadata.json generated successfully!")
