import pandas as pd
import numpy as np
import joblib
from pathlib import Path

import xgboost as xgb

from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

# Project directory
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Load separate training and testing datasets
train_path = PROJECT_ROOT / "data" / "processed" / "train_dataset.csv"
test_path = PROJECT_ROOT / "data" / "processed" / "test_dataset.csv"

train_df = pd.read_csv(train_path)
test_df = pd.read_csv(test_path)

# Create binary anomaly labels
# BENIGN = 0
# ATTACK = 1
y_train = (train_df["Label"] != "BENIGN").astype(int)
y_test = (test_df["Label"] != "BENIGN").astype(int)

# Remove label columns from model inputs
drop_columns = ["Label", "Target", "Anomaly"]

X_train = train_df.drop(columns=drop_columns, errors="ignore").select_dtypes(
    include=[np.number]
)

X_test = test_df.drop(columns=drop_columns, errors="ignore").select_dtypes(
    include=[np.number]
)

# Keep exactly the same feature columns and order
X_test = X_test.reindex(columns=X_train.columns)

# Replace infinite values with missing values
X_train = X_train.replace([np.inf, -np.inf], np.nan)
X_test = X_test.replace([np.inf, -np.inf], np.nan)

# Fit imputer on training data only
imputer = SimpleImputer(strategy="median")

X_train = pd.DataFrame(
    imputer.fit_transform(X_train),
    columns=X_train.columns,
    index=X_train.index,
)

X_test = pd.DataFrame(
    imputer.transform(X_test),
    columns=X_train.columns,
    index=X_test.index,
)

# Calculate class weight from training data
negative_count = (y_train == 0).sum()
positive_count = (y_train == 1).sum()

scale_pos_weight = negative_count / positive_count

# Initialize XGBoost
xgb_model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    random_state=42,
    n_jobs=-1,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
)

# Train model
xgb_model.fit(X_train, y_train)

# Predict on the separate test dataset
xgb_pred = xgb_model.predict(X_test)

# Evaluation
print("\n" + "=" * 50)
print("XGBOOST - ANOMALY DETECTION")
print("=" * 50)

print("Training rows:", len(X_train))
print("Testing rows:", len(X_test))
print("Features:", X_train.shape[1])

print("Accuracy:", accuracy_score(y_test, xgb_pred))
print("Precision:", precision_score(y_test, xgb_pred, zero_division=0))
print("Recall:", recall_score(y_test, xgb_pred, zero_division=0))
print("F1-score:", f1_score(y_test, xgb_pred, zero_division=0))

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        xgb_pred,
        labels=[0, 1],
        target_names=["Benign", "Anomaly"],
        zero_division=0,
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, xgb_pred, labels=[0, 1]))

# Save model and fitted imputer
output_dir = PROJECT_ROOT / "results" / "anomaly"
output_dir.mkdir(parents=True, exist_ok=True)

model_path = output_dir / "xgboost_anomaly.pkl"
imputer_path = output_dir / "xgboost_anomaly_imputer.pkl"

joblib.dump(xgb_model, model_path)
joblib.dump(imputer, imputer_path)

print("\nModel saved to:", model_path)
print("Imputer saved to:", imputer_path)
