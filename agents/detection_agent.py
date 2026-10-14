from pathlib import Path

import joblib
import numpy as np
import pandas as pd


class DetectionAgent:
    """Detect benign or anomalous network traffic."""

    def __init__(self, model_path=None, imputer_path=None):
        # Find project root
        project_root = Path(__file__).resolve().parents[1]

        # Default model and imputer paths
        if model_path is None:
            model_path = (
                project_root / "results" / "anomaly" / "random_forest_anomaly.pkl"
            )

        if imputer_path is None:
            imputer_path = project_root / "results" / "anomaly" / "anomaly_imputer.pkl"

        self.model_path = Path(model_path)
        self.imputer_path = Path(imputer_path)

        # Check files
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")

        if not self.imputer_path.exists():
            raise FileNotFoundError(
                f"Imputer not found: {self.imputer_path}. "
                "Run models/anomaly/rf_anomaly.py first."
            )

        # Load trained artifacts
        self.model = joblib.load(self.model_path)
        self.imputer = joblib.load(self.imputer_path)

        # Get expected feature names
        self.feature_names = getattr(self.model, "feature_names_in_", None)

        if self.feature_names is None:
            raise ValueError("The saved model does not contain feature names.")

        self.feature_names = list(self.feature_names)

        print("Detection Agent initialized.")
        print(f"Model: {self.model_path.name}")
        print(f"Imputer: {self.imputer_path.name}")
        print(f"Expected features: {len(self.feature_names)}")

    def detect(self, network_data):
        """Detect anomalies in one or multiple network flows."""

        # Convert input to DataFrame
        if isinstance(network_data, dict):
            input_df = pd.DataFrame([network_data])

        elif isinstance(network_data, pd.DataFrame):
            input_df = network_data.copy()

        else:
            raise TypeError("Input must be a dictionary or pandas DataFrame.")

        if input_df.empty:
            raise ValueError("No network flows provided.")

        # Remove label columns
        input_df = input_df.drop(
            columns=[
                "Label",
                "Target",
                "Anomaly",
                "Attack_Category",
            ],
            errors="ignore",
        )

        # Check required features
        missing = [
            feature for feature in self.feature_names if feature not in input_df.columns
        ]

        if missing:
            raise ValueError(f"Missing required features: {missing}")

        # Arrange features in training order
        input_df = input_df.reindex(columns=self.feature_names)

        # Convert invalid numeric values to missing values
        input_df = input_df.apply(pd.to_numeric, errors="coerce")

        input_df = input_df.replace([np.inf, -np.inf], np.nan)

        # Use the imputer fitted during training
        input_df = pd.DataFrame(
            self.imputer.transform(input_df),
            columns=self.feature_names,
            index=input_df.index,
        )

        # Predict traffic class
        predictions = self.model.predict(input_df)

        probabilities = None
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(input_df)

        classes = list(self.model.classes_)
        results = []

        for i, prediction in enumerate(predictions):
            label = int(prediction)

            result = {
                "status": "success",
                "is_anomaly": label == 1,
                "prediction": ("ATTACK" if label == 1 else "BENIGN"),
                "anomaly_label": label,
            }

            if probabilities is not None and 1 in classes:
                result["attack_probability"] = float(probabilities[i][classes.index(1)])

            results.append(result)

        return results


if __name__ == "__main__":
    agent = DetectionAgent()
    print("Detection Agent is ready.")
