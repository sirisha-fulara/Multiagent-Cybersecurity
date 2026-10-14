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

# Keep attack traffic only
train_df = train_df[train_df["Label"] != "BENIGN"].copy()
test_df = test_df[test_df["Label"] != "BENIGN"].copy()


# Map original labels to broader attack categories
def map_attack_category(label):
    if label in ["FTP-Patator", "SSH-Patator"]:
        return "Brute Force"

    elif label in [
        "DoS Hulk",
        "DoS GoldenEye",
        "DoS slowloris",
        "DoS Slowhttptest",
    ]:
        return "DoS"

    elif label == "DDoS":
        return "DDoS"

    elif label == "PortScan":
        return "Port Scan"

    elif label == "Bot":
        return "Botnet"

    elif label in [
        "Web Attack - Brute Force",
        "Web Attack - XSS",
        "Web Attack - Sql Injection",
    ]:
        return "Web Attack"

    elif label == "Infiltration":
        return "Infiltration"

    elif label == "Heartbleed":
        return "HeartBleed"

    else:
        return "Unknown"


train_df["Attack_Category"] = train_df["Label"].apply(map_attack_category)
test_df["Attack_Category"] = test_df["Label"].apply(map_attack_category)

# Prepare input features and target labels
drop_columns = ["Label", "Target", "Attack_Category", "Anomaly"]

X_train = train_df.drop(columns=drop_columns, errors="ignore").select_dtypes(
    include=[np.number]
)

X_test = test_df.drop(columns=drop_columns, errors="ignore").select_dtypes(
    include=[np.number]
)

y_train = train_df["Attack_Category"]
y_test = test_df["Attack_Category"]

# Match feature names and order
X_test = X_test.reindex(columns=X_train.columns)

# Replace infinite values with missing values
X_train = X_train.replace([np.inf, -np.inf], np.nan)
X_test = X_test.replace([np.inf, -np.inf], np.nan)

# Fit imputer using training data only
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

# Train Random Forest classifier
rf_model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    n_jobs=-1,
    class_weight="balanced",
)

rf_model.fit(X_train, y_train)

# Evaluate on held-out test data
rf_pred = rf_model.predict(X_test)

print("\n" + "=" * 50)
print("RANDOM FOREST - ATTACK CLASSIFICATION")
print("=" * 50)

print("Training attack rows:", len(X_train))
print("Testing attack rows:", len(X_test))
print("Number of features:", X_train.shape[1])

print("Accuracy:", accuracy_score(y_test, rf_pred))
print(
    "Macro Precision:",
    precision_score(y_test, rf_pred, average="macro", zero_division=0),
)
print(
    "Macro Recall:",
    recall_score(y_test, rf_pred, average="macro", zero_division=0),
)
print(
    "Macro F1-score:",
    f1_score(y_test, rf_pred, average="macro", zero_division=0),
)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        rf_pred,
        labels=rf_model.classes_,
        zero_division=0,
    )
)

print("\nConfusion Matrix:")
print(
    confusion_matrix(
        y_test,
        rf_pred,
        labels=rf_model.classes_,
    )
)

# Save model and fitted imputer
model_dir = PROJECT_ROOT / "results" / "classification"
model_dir.mkdir(parents=True, exist_ok=True)

model_path = model_dir / "random_forest_attack.pkl"
imputer_path = model_dir / "random_forest_attack_imputer.pkl"

joblib.dump(rf_model, model_path)
joblib.dump(imputer, imputer_path)

print("\nModel saved to:", model_path)
print("Imputer saved to:", imputer_path)
print("Number of input features:", len(rf_model.feature_names_in_))
print("Attack classes:", list(rf_model.classes_))
