import pandas as pd
import numpy as np
import joblib
import os

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

# Load Dataset
df = pd.read_csv("D:/MutiAgent Cybersecurity/data/processed/sampled_dataset.csv")

# Create Anomaly Label
# BENIGN = 0
# ATTACK = 1
df["Anomaly"] = df["Label"].apply(lambda x: 0 if x == "BENIGN" else 1)

X = df.drop(columns=["Label", "Anomaly"])
y = df["Anomaly"]

# Keep Numeric Features
X = X.select_dtypes(include=[np.number])

X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(X.median())

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

rf_model = RandomForestClassifier(
    n_estimators=100, random_state=42, n_jobs=-1, class_weight="balanced"
)

rf_model.fit(X_train, y_train)

# Prediction
rf_pred = rf_model.predict(X_test)

# Evaluation
print("\n" + "=" * 50)
print("RANDOM FOREST - ANOMALY DETECTION")
print("=" * 50)

print("Accuracy:", accuracy_score(y_test, rf_pred))
print("Precision:", precision_score(y_test, rf_pred, zero_division=0))
print("Recall:", recall_score(y_test, rf_pred, zero_division=0))
print("F1:", f1_score(y_test, rf_pred, zero_division=0))

print("\nClassification Report:")
print(
    classification_report(
        y_test, rf_pred, target_names=["Benign", "Anomaly"], zero_division=0
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, rf_pred))

# Save Model
os.makedirs("../../results/anomaly", exist_ok=True)
joblib.dump(rf_model, "../../results/anomaly/random_forest_anomaly.pkl")
print("\nModel saved to:")
print("../../results/anomaly/random_forest_anomaly.pkl")