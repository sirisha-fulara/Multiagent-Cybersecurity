import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
)

df = pd.read_csv("D:\MutiAgent Cybersecurity\data\processed\sampled_dataset.csv")
attack_df = df[df["Label"] != "BENIGN"].copy()


def map_attack_category(label):
    if label in ["FTP-Patator", "SSH-Patator"]:
        return "Brute Force"

    elif label in ["DoS Hulk", "DoS GoldenEye", "DoS slowloris", "SoS Slowhttptest"]:
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

    elif label == "HeartBleed":
        return "HeartBleed"

    else:
        return "Unknown"


attack_df["Attack_Category"] = attack_df["Label"].apply(map_attack_category)

X = attack_df.drop(columns=["Label", "Attack_Category"])
y = attack_df["Attack_Category"]

X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(0)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# xgboost expects numerical class fileds
encoder = LabelEncoder()
y_train_encoded = encoder.fit_transform(y_train)
y_test_encoded = encoder.transform(y_test)

xgb_model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    random_state=42,
    eval_metric="mlogloss",
    n_jobs=-1,
)

xgb_model.fit(X_train, y_train_encoded)
xgb_pred = encoder.inverse_transform(xgb_model.predict(X_test))

print("XGBOOST")
print("Accuracy:", accuracy_score(y_test, xgb_pred))
print("Precision:", precision_score(y_test, xgb_pred, average="macro", zero_division=0))
print("Recall:", recall_score(y_test, xgb_pred, average="macro", zero_division=0))
print("F1:", f1_score(y_test, xgb_pred, average="macro", zero_division=0))

print("\nClassification Report:")
print(classification_report(y_test, xgb_pred, zero_division=0))

os.makedirs("../../results/classification", exist_ok=True)
joblib.dump(xgb_model, "../../results/classification/xgboost_attack.pkl")
