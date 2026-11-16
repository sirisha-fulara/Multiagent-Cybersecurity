from backend.database import SessionLocal
from backend.db_models import AnalysisHistory


def save_history(analysis_id, analysis_type, report_path, analysis, filename=None):
    session = SessionLocal()

    try:
        # Handle batch and PCAP analysis structures
        flow_result = analysis.get("flow_analysis", analysis)

        summary = flow_result.get("summary", {})
        findings = flow_result.get("rule_findings", [])

        total = summary.get("total_flows", 1 if analysis else 0)
        attacks = summary.get("attack_flows", 0)
        verdicts = summary.get("verdicts", {})

        # Handle single-flow results
        if not summary and isinstance(analysis, dict):
            verdict = str(analysis.get("verdict", "")).upper()

            if verdict.startswith("ATTACK"):
                attacks = 1
            elif verdict == "BENIGN":
                attacks = 0

        benign = verdicts.get("BENIGN", 0)

        # Collect detected attack names
        attack_types = set()

        for finding in findings:
            if finding.get("attack_type"):
                attack_types.add(finding["attack_type"])

        ml_labels = summary.get("ml_attack_labels", {})
        attack_types.update(ml_labels.keys())

        # Find highest reported severity
        severity_order = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        severity = None

        for finding in findings:
            current = finding.get("severity")
            if current and (
                severity is None
                or severity_order.get(current.lower(), 0)
                > severity_order.get(severity.lower(), 0)
            ):
                severity = current

        source_ip = findings[0].get("source") if findings else None
        target_ip = findings[0].get("target") if findings else None

        record = AnalysisHistory(
            analysis_id=analysis_id,
            analysis_type=analysis_type,
            filename=filename,
            total_flows=total,
            attack_flows=attacks,
            benign_flows=benign,
            attack_types=sorted(attack_types),
            severity=severity,
            source_ip=source_ip,
            target_ip=target_ip,
            report_path=str(report_path),
        )

        session.add(record)
        session.commit()

    except Exception:
        session.rollback()
        raise

    finally:
        session.close()
