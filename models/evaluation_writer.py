"""Save real ML evaluation metrics for the Model Insights dashboard."""

import json
from datetime import datetime, timezone
from pathlib import Path

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]

EVALUATION_FILE = PROJECT_ROOT / "frontend" / "src" / "data" / "evaluation.json"


def save_model_evaluation(
    model_key,
    model_name,
    y_true,
    y_pred,
    labels,
    average=None,
):
    """Calculate and save metrics from held-out test predictions."""

    labels = list(labels)

    if not labels:
        raise ValueError("Evaluation labels cannot be empty.")

    kwargs = {"zero_division": 0}

    if average is not None:
        kwargs["average"] = average

    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, **kwargs)),
        "recall": float(recall_score(y_true, y_pred, **kwargs)),
        "f1": float(f1_score(y_true, y_pred, **kwargs)),
        "confusionMatrix": {
            "labels": [str(label) for label in labels],
            "matrix": confusion_matrix(
                y_true,
                y_pred,
                labels=labels,
            )
            .astype(int)
            .tolist(),
        },
        "model": model_name,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "testSamples": int(len(y_true)),
    }

    EVALUATION_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if EVALUATION_FILE.exists():
        try:
            data = json.loads(EVALUATION_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
    else:
        data = {}

    data.setdefault("models", {})
    data["models"][model_key] = metrics

    data.setdefault(
        "rag",
        {
            "evaluatedCases": None,
            "faithfulness": None,
            "answerRelevancy": None,
            "contextPrecision": None,
            "contextRecall": None,
            "answerSimilarity": None,
        },
    )

    temporary_file = EVALUATION_FILE.with_suffix(".json.tmp")

    temporary_file.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )

    temporary_file.replace(EVALUATION_FILE)

    print("\nEvaluation results saved successfully!")
    print("Model:", model_name)
    print("Test samples:", len(y_true))
    print("Accuracy:", metrics["accuracy"])
    print("Precision:", metrics["precision"])
    print("Recall:", metrics["recall"])
    print("F1-score:", metrics["f1"])
    print("File:", EVALUATION_FILE)
