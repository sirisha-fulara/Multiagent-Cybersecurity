from pathlib import Path

import joblib
import numpy as np
import pandas as pd


class DetectionAgent:
    """Detect benign or anomalous network traffic."""

    def __init__(self, model_path=None):
        project_root = Path(__file__).resolve().parents[1]

        if model_path is None:
            model_path = (
                project_root
                / "results"
                / "anomaly"
                / "random_forest_anomaly.pkl"
            )

        self.model_path = Path(model_path)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model not found: {self.model_path}"
            )

        self.model = joblib.load(self.model_path)

        self.feature_names = getattr(
            self.model, "feature_names_in_", None
        )

        if self.feature_names is None:
            raise ValueError(
                "The saved model does not contain feature names."
            )

        self.feature_names = list(self.feature_names)

        print("Detection Agent initialized.")
        print(f"Model: {self.model_path.name}")
        print(f"Expected features: {len(self.feature_names)}")

    def detect(self, network_data):
        """Accept a dictionary or DataFrame of network flows."""

        if isinstance(network_data, dict):
            input_df = pd.DataFrame([network_data])
        elif isinstance(network_data, pd.DataFrame):
            input_df = network_data.copy()
        else:
            raise TypeError(
                "Input must be a dictionary or pandas DataFrame."
            )

        if input_df.empty:
            raise ValueError("No network flows provided.")

        # Remove target and label columns.
        input_df = input_df.drop(
            columns=[
                "Label",
                "Target",
                "Anomaly",
                "Attack_Category",
            ],
        errors="ignore",
        )

        # The model was trained using a column named "Target".
        # It is the label to predict, not a network feature.
        feature_names = self.feature_names

        # Validate and order features.
        missing = [
            col for col in self.feature_names
            if col not in input_df.columns
        ]

        if missing:
            raise ValueError(
                f"Missing required features: {missing}"
            )
        if missing:
            raise ValueError(
            f"Missing required features: {missing}"
        )

        input_df = input_df.reindex(columns=feature_names)

        input_df = input_df.reindex(
            columns=self.feature_names
        )

        input_df = input_df.apply(
            pd.to_numeric, errors="raise"
        )

        values = input_df.to_numpy(dtype=float)

        if not np.isfinite(values).all():
            raise ValueError(
                "Input contains missing or infinite values. "
                "Apply the same preprocessing used in training."
            )

        predictions = self.model.predict(input_df)

        probabilities = None
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(input_df)

        results = []

        classes = list(self.model.classes_)

        for i, prediction in enumerate(predictions):
            label = int(prediction)

            result = {
                "status": "success",
                "is_anomaly": label == 1,
                "prediction": "ATTACK" if label == 1 else "BENIGN",
                "anomaly_label": label,
            }

            if probabilities is not None and 1 in classes:
                result["attack_probability"] = float(
                    probabilities[i][classes.index(1)]
                )

            results.append(result)

        return results


if __name__ == "__main__":
    agent = DetectionAgent()
    print("Detection Agent is ready.")
    id="2xd1gf"
