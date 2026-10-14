import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)
from xgboost import XGBClassifier

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

# Prepare features and labels
drop_columns = ["Label", "Target", "Anomaly", "Attack_Category"]

X_train = train_df.drop(columns=drop_columns, errors="ignore").select_dtypes(
    include=[np.number]
)

X_test = test_df.drop(columns=drop_columns, errors="ignore").select_dtypes(
    include=[np.number]
)

y_train = train_df["Attack_Category"]
y_test = test_df["Attack_Category"]

# Align test features with training features
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

# Encode attack categories as numbers
encoder = LabelEncoder()
y_train_encoded = encoder.fit_transform(y_train)

# Verify that every test category exists in the training categories
unknown_test_labels = set(y_test.unique()) - set(encoder.classes_)
if unknown_test_labels:
    raise ValueError(
        "These attack categories occur in the test set but not the training set: "
        f"{sorted(unknown_test_labels)}. Adjust the split or collect more examples."
    )

y_test_encoded = encoder.transform(y_test)

# Train XGBoost
xgb_model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    random_state=42,
    eval_metric="mlogloss",
    n_jobs=-1,
)

xgb_model.fit(X_train, y_train_encoded)

# Predict and decode category names
predicted_encoded = xgb_model.predict(X_test).astype(int)
xgb_pred = encoder.inverse_transform(predicted_encoded)

# Evaluate
print("\n" + "=" * 50)
print("XGBOOST - ATTACK CLASSIFICATION")
print("=" * 50)

print("Training attack rows:", len(X_train))
print("Testing attack rows:", len(X_test))
print("Number of features:", X_train.shape[1])

print("Accuracy:", accuracy_score(y_test, xgb_pred))
print(
    "Macro Precision:",
    precision_score(y_test, xgb_pred, average="macro", zero_division=0),
)
print(
    "Macro Recall:",
    recall_score(y_test, xgb_pred, average="macro", zero_division=0),
)
print(
    "Macro F1-score:",
    f1_score(y_test, xgb_pred, average="macro", zero_division=0),
)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        xgb_pred,
        labels=encoder.classes_,
        zero_division=0,
    )
)

print("\nConfusion Matrix:")
print(
    confusion_matrix(
        y_test,
        xgb_pred,
        labels=encoder.classes_,
    )
)

# Save model, imputer, and encoder
model_dir = PROJECT_ROOT / "results" / "classification"
model_dir.mkdir(parents=True, exist_ok=True)

model_path = model_dir / "xgboost_attack.pkl"
imputer_path = model_dir / "xgboost_attack_imputer.pkl"
encoder_path = model_dir / "xgboost_attack_encoder.pkl"

joblib.dump(xgb_model, model_path)
joblib.dump(imputer, imputer_path)
joblib.dump(encoder, encoder_path)

print("\nModel saved to:", model_path)
print("Imputer saved to:", imputer_path)
print("Label encoder saved to:", encoder_path)
print("Attack classes:", list(encoder.classes_))
