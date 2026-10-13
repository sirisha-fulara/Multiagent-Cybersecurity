
from agents.threat_intelligence import (
    ThreatIntelligenceAgent,
)

def main():
    agent = ThreatIntelligenceAgent()

    for attack in ["DDoS", "Port Scan", "Brute Force"]:
        result = agent.investigate(attack)

        print("\n" + "=" * 45)
        print("Agent:", result["agent"])
        print("Attack:", result["attack_type"])
        print("Evidence available:", result["evidence_available"])
        print("Status:", result["status"])
        print("\nThreat analysis:")
        print(result["analysis"])


if __name__ == "__main__":
    main()
