from pathlib import Path
from agents.detection_agent import DetectionAgent
from agents.classification_agent import ClassificationAgent
from agents.threat_intelligence_agent import ThreatIntelligenceAgent


class CoordinatorAgent:
    """coordinate all 3 agents"""

    def __init__(self):
        self.detection_agent = DetectionAgent()
        self.classification_agent = ClassificationAgent()
        self.threat_agent = None  # loading only when needed as its heavy
        print("coordinator agent initialized")

    def process(self, network_data):
        """analyse one nw flow and return combined report"""

        # detect
        detection_result = self.detection_agent.detect(network_data)[0]
        result = {
            "detection": detection_result,
            "classification": None,
            "threat_intelligence": None,
        }

        print("\nStep 1: Detection done")
        print("Detection result: ", detection_result["prediction"])

        # stop if traffic is predicted benign.
        if not detection_result["is_anomaly"]:
            result["message"] = "Traffic predicted benign."

            print("Traffic is predicted benign.")
            print("Further analysis skipped.")

            return result

        # classification
        classification_result = self.classification_agent.classify(network_data)[0]
        result["classification"] = classification_result
        attack_type = classification_result["prediction"]

        print("\nStep 2: Classification completed.")
        print("Predicted attack:", attack_type)

        #threat intelligence 
        try:
            if self.threat_agent is None:
                from agents.threat_intelligence_agent import (ThreatIntelligenceAgent)
                self.threat_agent = ThreatIntelligenceAgent()

            intelligence_result = self.threat_agent.investigate(attack_type)
            result["threat_intelligence"] = intelligence_result

            print("\nStep 3: Threat intelligence completed.")

        except Exception as error:
            # keep earlier results if threat intelligence fails.
            result["threat_intelligence"] = {
                "status": "error",
                "message": str(error),
            }

            print("\nThreat intelligence could not complete.")
            print("Error:", error)

        # return all results.
        result["message"] = "Traffic analysis completed."
        return result


if __name__ == "__main__":
    coordinator = CoordinatorAgent()

    print("\nCoordinator is ready!")
    print("Pass one network flow to coordinator.process().")
