import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
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

# Ensure the test features have exactly the training feature columns
X_test = X_test.reindex(columns=X_train.columns)

# Replace infinite values with missing values
X_train = X_train.replace([np.inf, -np.inf], np.nan)
X_test = X_test.replace([np.inf, -np.inf], np.nan)

# Fit imputation on training data only
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

# Train Random Forest
rf_model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    n_jobs=-1,
    class_weight="balanced",
)

rf_model.fit(X_train, y_train)

# Evaluate on the separate, held-out test set
rf_pred = rf_model.predict(X_test)

print("\n" + "=" * 50)
print("RANDOM FOREST - ANOMALY DETECTION")
print("=" * 50)

print("Training rows:", len(X_train))
print("Testing rows:", len(X_test))
print("Features:", X_train.shape[1])

print("Accuracy:", accuracy_score(y_test, rf_pred))
print("Precision:", precision_score(y_test, rf_pred, zero_division=0))
print("Recall:", recall_score(y_test, rf_pred, zero_division=0))
print("F1-score:", f1_score(y_test, rf_pred, zero_division=0))

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        rf_pred,
        labels=[0, 1],
        target_names=["Benign", "Anomaly"],
        zero_division=0,
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, rf_pred, labels=[0, 1]))

# Save model and its fitted imputer
output_dir = PROJECT_ROOT / "results" / "anomaly"
output_dir.mkdir(parents=True, exist_ok=True)

model_path = output_dir / "random_forest_anomaly.pkl"
imputer_path = output_dir / "anomaly_imputer.pkl"

joblib.dump(rf_model, model_path)
joblib.dump(imputer, imputer_path)

print("\nModel saved to:", model_path)
print("Imputer saved to:", imputer_path)
