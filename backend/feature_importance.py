from pathlib import Path
import joblib
import pandas as pd

root = Path(__file__).resolve().parents[1]

model_path = root / "results" / "anomaly" / "random_forest_anomaly.pkl"

model = joblib.load(model_path)

importance = pd.DataFrame(
    {"Feature": model.feature_names_in_, "Importance": model.feature_importances_}
)

importance = importance.sort_values(by="Importance", ascending=False)

print("\n========== TOP 20 IMPORTANT FEATURES ==========")
print(importance.head(20).to_string(index=False))

print("\n========== MODEL DETAILS ==========")
print("Classes:", model.classes_)
print("Number of trees:", len(model.estimators_))
print("Number of features:", model.n_features_in_)
