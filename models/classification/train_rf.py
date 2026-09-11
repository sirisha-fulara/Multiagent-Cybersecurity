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

rf_model = RandomForestClassifier(
    n_estimators=100, random_state=42, n_jobs=-1, class_weight="balanced"
)
rf_model.fit(X_train, y_train)

rf_pred = rf_model.predict(X_test)

print("RANDOM FOREST")
print("Accuracy:", accuracy_score(y_test, rf_pred))
print("Precision:", precision_score(y_test, rf_pred, average="macro", zero_division=0))
print("Recall:", recall_score(y_test, rf_pred, average="macro", zero_division=0))
print("F1:", f1_score(y_test, rf_pred, average="macro", zero_division=0))

print("\nClassification Report:")
print(classification_report(y_test, rf_pred, zero_division=0))

os.makedirs("../../results/classification", exist_ok=True)
joblib.dump(rf_model, "../../results/classification/random_forest_attack.pkl")
