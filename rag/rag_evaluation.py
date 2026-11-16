"""
Local evaluation harness for the project's Threat Intelligence RAG agent.

Run from the project root:
    python -m rag.evaluate_rag

The semantic metrics below are lightweight proxies, NOT official RAGAS scores.
Answer correctness is intentionally left for human review.
"""

import csv
import re
from pathlib import Path

import numpy as np
from sentence_transformers import util

from agents.threat_intelligence_agent import ThreatIntelligenceAgent


# Keep reference answers grounded in rag/data/cybersecurity.txt.
# Edit these if the knowledge base changes.
EVALUATION_CASES = [
    {
        "question": "What is a DDoS attack, and what impact can it have?",
        "attack_type": "DDoS",
        "reference": (
            "A distributed denial-of-service attack attempts to impair service "
            "availability using traffic or requests from multiple systems. "
            "It can cause increased latency, packet loss, dropped connections, "
            "resource exhaustion, and reduced availability."
        ),
    },
    {
        "question": "What is a DoS attack and what should be investigated?",
        "attack_type": "DoS",
        "reference": (
            "A denial-of-service attack attempts to make a system, application, "
            "or network resource unavailable by exhausting a finite resource. "
            "Investigation can include traffic volume, packet and connection "
            "rates, service latency, errors, and server resource pressure."
        ),
    },
    {
        "question": "What is port scanning and does it prove compromise?",
        "attack_type": "Port Scan",
        "reference": (
            "Port scanning systematically probes ports on one or more hosts "
            "to discover reachable services. It can be used for reconnaissance "
            "but is also performed by administrators and security scanners. "
            "A scan does not by itself prove exploitation, compromise, or "
            "malicious intent."
        ),
    },
    {
        "question": "What is a brute-force attack and how can it be reduced?",
        "attack_type": "Brute Force",
        "reference": (
            "A brute-force authentication attack repeatedly attempts credentials "
            "to gain access. Defensive measures include strong authentication, "
            "multi-factor authentication, rate limiting, account lockout or "
            "progressive delays, and monitoring repeated failed logins."
        ),
    },
    {
        "question": "What is a botnet and what network behavior may indicate one?",
        "attack_type": "Botnet",
        "reference": (
            "A botnet is a collection of bots coordinated by an operator through "
            "command-and-control or other mechanisms. Possible clues include "
            "repeated outbound connections, periodic communication, unusual DNS "
            "behavior, and correlated patterns across endpoints. These clues "
            "are not proof of a botnet on their own."
        ),
    },
    {
        "question": "What is SQL injection and how can it be prevented?",
        "attack_type": "SQL Injection",
        "reference": (
            "SQL injection is an attack in which untrusted input changes the "
            "intended structure of a database query. Defensive measures include "
            "parameterized queries, safe input handling, least-privilege database "
            "accounts, and secure application testing."
        ),
    },
    {
        "question": "What is cross-site scripting and what can reduce its risk?",
        "attack_type": "XSS",
        "reference": (
            "Cross-site scripting occurs when an application includes untrusted "
            "content in a page in a way that allows script execution in a user's "
            "browser. Output encoding, safe handling of untrusted input, and "
            "appropriate content security policies can reduce risk."
        ),
    },
    {
        "question": "What does infiltration or lateral movement mean?",
        "attack_type": "Infiltration",
        "reference": (
            "Infiltration describes unauthorized entry into a system or network. "
            "Lateral movement is activity in which an intruder attempts to move "
            "from an initially accessed system to other systems or resources. "
            "Investigation should correlate network, host, identity, and endpoint "
            "evidence."
        ),
    },
    {
        "question": "What is the Heartbleed vulnerability and what should defenders do?",
        "attack_type": "Heartbleed",
        "reference": (
            "Heartbleed is a vulnerability in the OpenSSL heartbeat extension "
            "that could expose memory contents from affected systems. Defenders "
            "should identify affected systems, apply corrected software, and "
            "consider whether exposed credentials or keys require replacement."
        ),
    },
]


def split_sentences(text):
    """Simple sentence splitter for lightweight semantic coverage checks."""
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    return [p.strip() for p in parts if len(p.strip().split()) >= 4]


def cosine_matrix(model, left_texts, right_texts):
    """Return cosine similarities for two lists of texts."""
    if not left_texts or not right_texts:
        return np.zeros((len(left_texts), len(right_texts)))
    left = model.encode(left_texts, convert_to_tensor=True, normalize_embeddings=True)
    right = model.encode(right_texts, convert_to_tensor=True, normalize_embeddings=True)
    return util.cos_sim(left, right).cpu().numpy()


def safe_mean(values):
    return float(np.mean(values)) if values else 0.0


def evaluate_case(model, case, result, threshold=0.35):
    answer = result.get("analysis", "") or ""
    contexts = result.get("retrieved_context", []) or []
    context_texts = [str(x) for x in contexts if str(x).strip()]
    ref_sentences = split_sentences(case["reference"])
    answer_sentences = split_sentences(answer)

    # Faithfulness proxy: fraction of answer sentences semantically supported
    # by at least one retrieved chunk.
    answer_context_sim = cosine_matrix(model, answer_sentences, context_texts)
    faithfulness = (
        float(np.mean(np.max(answer_context_sim, axis=1) >= threshold))
        if answer_context_sim.size else 0.0
    )

    # Answer relevancy proxy: semantic similarity between question and answer.
    q_answer = cosine_matrix(model, [case["question"]], [answer])
    answer_relevancy = float(q_answer[0][0]) if q_answer.size else 0.0

    # Context precision proxy: fraction of retrieved chunks relevant to reference.
    context_ref_sim = cosine_matrix(model, context_texts, [case["reference"]])
    context_precision = (
        float(np.mean(context_ref_sim[:, 0] >= threshold))
        if context_ref_sim.size else 0.0
    )

    # Context recall proxy: fraction of reference sentences covered by retrieved chunks.
    ref_context_sim = cosine_matrix(model, ref_sentences, context_texts)
    context_recall = (
        float(np.mean(np.max(ref_context_sim, axis=1) >= threshold))
        if ref_context_sim.size else 0.0
    )

    # Answer similarity proxy: cosine similarity between answer and reference.
    ans_ref = cosine_matrix(model, [answer], [case["reference"]])
    answer_similarity = float(ans_ref[0][0]) if ans_ref.size else 0.0

    return {
        "question": case["question"],
        "attack_type": case["attack_type"],
        "status": result.get("status", ""),
        "evidence_available": result.get("evidence_available", False),
        "retrieved_context_count": len(context_texts),
        "faithfulness_proxy": faithfulness,
        "answer_relevancy_proxy": answer_relevancy,
        "context_precision_proxy": context_precision,
        "context_recall_proxy": context_recall,
        "answer_similarity_proxy": answer_similarity,
        # Do not pretend an embedding score establishes factual correctness.
        "answer_correctness_manual": "",
        "reference_answer": case["reference"],
        "generated_answer": answer,
        "retrieved_context": "\n\n--- RETRIEVED CHUNK ---\n\n".join(context_texts),
    }


def main():
    output_dir = Path(__file__).resolve().parent / "results"
    output_dir.mkdir(parents=True, exist_ok=True)
    details_path = output_dir / "rag_evaluation_details.csv"
    summary_path = output_dir / "rag_evaluation_summary.csv"

    print("Initializing the existing Threat Intelligence Agent...")
    agent = ThreatIntelligenceAgent()

    rows = []
    for number, case in enumerate(EVALUATION_CASES, start=1):
        print(f"\n[{number}/{len(EVALUATION_CASES)}] Evaluating {case['attack_type']}...")
        try:
            result = agent.investigate(case["attack_type"])
            row = evaluate_case(agent.embedding_model, case, result)
            rows.append(row)
            print("  Retrieved chunks:", row["retrieved_context_count"])
            print("  Evidence available:", row["evidence_available"])
            print("  Faithfulness proxy:", round(row["faithfulness_proxy"], 3))
            print("  Answer relevancy proxy:", round(row["answer_relevancy_proxy"], 3))
        except Exception as exc:
            print(f"  ERROR: {exc}")

    if not rows:
        raise RuntimeError("No evaluation cases completed. Check the agent setup.")

    # Save per-question outputs for inspection and manual correctness scoring.
    with details_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    metric_columns = [
        "faithfulness_proxy",
        "answer_relevancy_proxy",
        "context_precision_proxy",
        "context_recall_proxy",
        "answer_similarity_proxy",
    ]
    summary = [{
        "metric": metric.replace("_proxy", "").replace("_", " ").title(),
        "mean_score_0_to_1": round(safe_mean([r[metric] for r in rows]), 4),
        "cases_evaluated": len(rows),
    } for metric in metric_columns]

    with summary_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(summary[0].keys()))
        writer.writeheader()
        writer.writerows(summary)

    print("\nEvaluation completed.")
    print("Detailed results:", details_path)
    print("Summary results:", summary_path)

if __name__ == "__main__":
    main()
