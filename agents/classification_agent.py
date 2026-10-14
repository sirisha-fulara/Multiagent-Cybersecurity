from pathlib import Path

import joblib
import numpy as np
import pandas as pd


class ClassificationAgent:
    """Predict the attack category in network traffic."""

    def __init__(self, model_path=None, imputer_path=None):
        # Find project root
        project_root = Path(__file__).resolve().parents[1]

        # Default Random Forest model
        if model_path is None:
            model_path = (
                project_root / "results" / "classification" / "random_forest_attack.pkl"
            )

        # Matching imputer
        if imputer_path is None:
            imputer_path = (
                project_root
                / "results"
                / "classification"
                / "random_forest_attack_imputer.pkl"
            )

        self.model_path = Path(model_path)
        self.imputer_path = Path(imputer_path)

        # Check files
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")

        if not self.imputer_path.exists():
            raise FileNotFoundError(
                f"Imputer not found: {self.imputer_path}. "
                "Run models/classification/train_rf.py first."
            )

        # Load trained artifacts
        self.model = joblib.load(self.model_path)
        self.imputer = joblib.load(self.imputer_path)

        # Read expected features
        self.feature_names = getattr(self.model, "feature_names_in_", None)

        if self.feature_names is None:
            raise ValueError(
                "The model does not contain feature names. " "Check how it was trained."
            )

        self.feature_names = list(self.feature_names)

        print("Classification Agent initialized.")
        print(f"Model: {self.model_path.name}")
        print(f"Imputer: {self.imputer_path.name}")
        print(f"Expected features: {len(self.feature_names)}")
        print(f"Model classes: {list(self.model.classes_)}")

    def classify(self, network_data):
        """Classify one or multiple network flows."""

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
                "Target",
                "Label",
                "Attack_Category",
                "Anomaly",
            ],
            errors="ignore",
        )

        # Check required features
        missing = [
            feature for feature in self.feature_names if feature not in input_df.columns
        ]

        if missing:
            raise ValueError(f"Missing required features: {missing}")

        # Match feature order
        input_df = input_df.reindex(columns=self.feature_names)

        # Convert invalid values to missing values
        input_df = input_df.apply(pd.to_numeric, errors="coerce")

        input_df = input_df.replace([np.inf, -np.inf], np.nan)

        # Apply the imputer fitted during training
        input_df = pd.DataFrame(
            self.imputer.transform(input_df),
            columns=self.feature_names,
            index=input_df.index,
        )

        # Predict attack categories
        predictions = self.model.predict(input_df)

        results = []

        for prediction in predictions:
            if isinstance(prediction, np.generic):
                prediction = prediction.item()

            results.append(
                {
                    "status": "classified",
                    "prediction": prediction,
                }
            )

        return results


if __name__ == "__main__":
    agent = ClassificationAgent()
    print("Classification Agent is ready.")
