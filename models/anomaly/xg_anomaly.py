import pandas as pd
import numpy as np
import joblib
import os

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

import xgboost as xgb

df = pd.read_csv("D:/MutiAgent Cybersecurity/data/processed/sampled_dataset.csv")

# Create Anomaly Label
# BENIGN = 0
# ATTACK = 1
df["Anomaly"] = df["Label"].apply(lambda x: 0 if x == "BENIGN" else 1)

X = df.drop(columns=["Label", "Anomaly"])
y = df["Anomaly"]

X = X.select_dtypes(include=[np.number])

X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(X.median())

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)


# =========================
# Calculate Class Weight
# =========================

scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()

xgb_model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    random_state=42,
    n_jobs=-1,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
)

xgb_model.fit(X_train, y_train)

# Prediction
xgb_pred = xgb_model.predict(X_test)

# Evaluation
print("\n" + "=" * 50)
print("XGBOOST - ANOMALY DETECTION")
print("=" * 50)

print("Accuracy:", accuracy_score(y_test, xgb_pred))
print("Precision:", precision_score(y_test, xgb_pred, zero_division=0))
print("Recall:", recall_score(y_test, xgb_pred, zero_division=0))
print("F1:", f1_score(y_test, xgb_pred, zero_division=0))

print("\nClassification Report:")
print(
    classification_report(
        y_test, xgb_pred, target_names=["Benign", "Anomaly"], zero_division=0
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, xgb_pred))

# Save Model
os.makedirs("../../results/anomaly", exist_ok=True)
joblib.dump(xgb_model, "../../results/anomaly/xgboost_anomaly.pkl")
print("\nModel saved to:")
print("../../results/anomaly/xgboost_anomaly.pkl")
