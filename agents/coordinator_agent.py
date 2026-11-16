import numpy as np
import pandas as pd

from agents.detection_agent import DetectionAgent
from agents.classification_agent import ClassificationAgent
from agents.rule_detector import analyze_flows

METADATA_KEYS = [
    "Flow ID",
    "Source IP",
    "Source Port",
    "Destination IP",
    "Destination Port",
]

def _is_thin_flow(row_or_df):
    """A one-way, zero-duration flow gives no info to ML model, so skip it"""
    return (row_or_df["Total Backward Packets"] == 0) & (
        row_or_df["Flow Duration"] == 0
    )

class CoordinatorAgent:
    """Coordinate rule detection, ML detection, classification and threat intel."""

    def __init__(self, ml_confidence_threshold=0.6, rule_config=None):
        self.detection_agent = DetectionAgent()
        self.classification_agent = ClassificationAgent(
            confidence_threshold=ml_confidence_threshold
        )
        self.threat_agent = None  # Load only when needed because it is heavy
        self.rule_config = rule_config
        self._threat_cache = {}  # stores previously generated intelligence reports.

        print("Coordinator Agent initialized.")

    # ------------------------------------------------------------------
    

    # handles single row of data
    def process(self, network_data):
        """Analyse one network flow (used by the Flask API)."""

        detection_result = self.detection_agent.detect(network_data)[0]
        result = {
            "detection": detection_result,
            "classification": None,
            "threat_intelligence": None,
        }

        # skip furthur if traffic if benign
        if not detection_result["is_anomaly"]:
            result["message"] = "Traffic predicted benign."
            return result

        # move furthur if traffic is malicious
        classification_result = self.classification_agent.classify(network_data)[0]
        result["classification"] = classification_result
        attack_type = classification_result["prediction"]

        # flag low confidence prediction
        if classification_result.get("low_confidence"):
            result["warning"] = (
                "Attack category has low confidence; treat it as a hint only."
            )

        result["threat_intelligence"] = self._investigate(attack_type)
        # pass op to next agent
        result["message"] = "Traffic analysis completed."
        return result

    # handles multiple flows
    def process_dataframe(self, flows_df, max_flow_reports=None):
        """Analyse many flows efficiently (batch ML + cross-flow rules)."""

        if not isinstance(flows_df, pd.DataFrame):
            raise TypeError("Input must be a pandas DataFrame.")
        if flows_df.empty:
            raise ValueError("No network flows provided.")

        flows_df = flows_df.reset_index(drop=True)
        total = len(flows_df)
        print(f"Analysing {total} flows...")

        # Layer 1: cross-flow rules
        findings, rule_flagged = [], {}
        try:
            findings, rule_flagged = analyze_flows(flows_df, self.rule_config)
        except ValueError as error:
            print("Rule detector skipped:", error)

        # Layer 2: ML (one batched call per model)
        detections = self.detection_agent.detect(flows_df)
        thin = _is_thin_flow(flows_df).to_numpy()

        ml_attack_idx = [
            i for i, d in enumerate(detections) if d["is_anomaly"] and not thin[i]
        ]
        classifications = {}
        if ml_attack_idx:
            results = self.classification_agent.classify(flows_df.iloc[ml_attack_idx])
            classifications = dict(zip(ml_attack_idx, results))

        # Per-flow verdicts(results)
        verdict_counts = {}
        flow_reports = []

        for i in range(total):
            det = detections[i]
            cls = classifications.get(i)
            rule_attack = rule_flagged.get(i)

            if rule_attack:
                verdict = "ATTACK (rule)"
                attack_type = rule_attack
            elif det["is_anomaly"] and not thin[i]:
                verdict = "ATTACK (ml)"
                attack_type = cls["prediction"] if cls else None
            elif thin[i]:
                verdict = "INSUFFICIENT_EVIDENCE"  # when not enough data is present
                attack_type = None
            else:
                verdict = "BENIGN"
                attack_type = None

            verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1

            # Preserve every flow verdict, not just attacks.
            if max_flow_reports is None or len(flow_reports) < max_flow_reports:
                row = flows_df.iloc[i]

                flow_reports.append(
                    {
                        "flow_index": i,
                        "verdict": verdict,
                        "attack_type": attack_type,
                        "ml_attack_probability": det.get("attack_probability"),
                        "classification": cls,
                        "rule_attack": rule_attack,
                        "flow_metadata": {
                            k: row[k].item() if hasattr(row[k], "item") else row[k]
                            for k in METADATA_KEYS
                            if k in flows_df.columns
                        },
                    }
                )

        # ---- Threat intelligence: once per distinct attack type ----------
        attack_types = {f["attack_type"] for f in findings}
        for c in classifications.values():
            if not c.get("low_confidence"):
                attack_types.add(c["prediction"])
        threat_reports = {
            t: self._investigate(t) for t in sorted(map(str, attack_types))
        }

        ml_labels = pd.Series(
            [c["prediction"] for c in classifications.values()], dtype=object
        ).value_counts()

        return {
            "summary": {
                "total_flows": total,
                "verdicts": verdict_counts,
                "attack_flows": sum(
                    v for k, v in verdict_counts.items() if k.startswith("ATTACK")
                ),
                "insufficient_evidence_flows": verdict_counts.get(
                    "INSUFFICIENT_EVIDENCE", 0
                ),
                "ml_attack_labels": ml_labels.to_dict(),
                "ml_low_confidence_flows": int(
                    sum(1 for c in classifications.values() if c.get("low_confidence"))
                ),
            },
            "rule_findings": findings,
            "threat_intelligence": threat_reports,
            "flow_reports": flow_reports,
            "flow_reports_truncated": (
                max_flow_reports is not None and total > len(flow_reports)
            ),
        }

    def process_batch(self, flows_df):
        """Backward-compatible alias for process_dataframe."""
        return self.process_dataframe(flows_df)

    def _investigate(self, attack_type):
            """Threat intelligence"""
            key = str(attack_type)
            if key in self._threat_cache:
                return self._threat_cache[key]
    
            try:
                if self.threat_agent is None:
                    from agents.threat_intelligence_agent import ThreatIntelligenceAgent
                    self.threat_agent = ThreatIntelligenceAgent()
    
                result = self.threat_agent.investigate(attack_type)
            except Exception as error:
                result = {"status": "error", "message": str(error)}
                print("Threat intelligence could not complete:", error)
    
            self._threat_cache[key] = result
            return result


if __name__ == "__main__":
    coordinator = CoordinatorAgent()
    print("\nCoordinator is ready!")
    print("Use coordinator.process() for one flow.")
    print("Use coordinator.process_dataframe() for many flows.")
