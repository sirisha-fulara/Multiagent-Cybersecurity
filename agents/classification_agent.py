
from pathlib import Path
import joblib
import pandas as pd
import numpy as np


class ClassificationAgent:
    def __init__(self, model_path):
        """Load the trained attack classification model."""
        self.model_path = Path(model_path)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model not found: {self.model_path}\n"
                "Please provide the path to the trained model."
            )

        self.model = joblib.load(self.model_path)

        # Feature names expected by the trained model
        self.feature_names = getattr(
            self.model, "feature_names_in_", None
        )

        # Classes learned during training
        self.classes = getattr(self.model, "classes_", None)

        print("Classification Agent initialized.")
        print(f"Model: {self.model_path.name}")

        if self.feature_names is not None:
            print(f"Expected features: {len(self.feature_names)}")

        if self.classes is not None:
            print(f"Model classes: {list(self.classes)}")

    def classify(self, network_data):
        """
        Classify network traffic using a dictionary or DataFrame.

        Returns the predicted attack category.
        """
        if isinstance(network_data, dict):
            input_df = pd.DataFrame([network_data])
        elif isinstance(network_data, pd.DataFrame):
            input_df = network_data.copy()
        else:
            raise TypeError(
                "Input must be a dictionary or pandas DataFrame."
            )

        # Exclude target/label columns from prediction input
        input_df = input_df.drop(
            columns=["Target", "Label", "Attack_Category"],
            errors="ignore"
        )

        # Match the feature order used during training
        if self.feature_names is not None:
            missing = [
                col for col in self.feature_names
                if col not in input_df.columns
            ]

            extra = [
                col for col in input_df.columns
                if col not in self.feature_names
            ]

            if missing:
                raise ValueError(
                    f"Missing required features: {missing}"
                )

            if extra:
                print(f"Ignoring extra features: {extra}")

            input_df = input_df.reindex(
                columns=self.feature_names
            )

        # Clean invalid numeric values
        input_df = input_df.replace(
            [np.inf, -np.inf], np.nan
        ).fillna(0)

        predictions = self.model.predict(input_df)

        results = []

        for i, prediction in enumerate(predictions):
            results.append({
                "prediction": prediction.item()
                if isinstance(prediction, np.generic)
                else prediction,
                "status": "classified"
            })

        return results


if __name__ == "__main__":
    MODEL_PATH = r"C:\Users\user\Downloads\random_forest_attack.pkl"

    agent = ClassificationAgent(MODEL_PATH)

    print("\nAgent is ready.")
    print("Model type:", type(agent.model).__name__)
    print("Model classes:", agent.model.classes_)
    print("Expected feature names:")
    print(agent.feature_names)  
