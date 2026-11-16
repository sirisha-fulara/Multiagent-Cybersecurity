"""Rule-based, cross-flow detector."""

import numpy as np
import pandas as pd

DEFAULTS = {
    "scan_min_ports": 100,
    "scan_max_avg_packets": 6,
    "flood_min_flows": 300,
    "flood_min_rate": 100.0,
    "ddos_min_sources": 50,
    "reflect_min_flows": 300,
    "reflect_min_share": 0.5,
    "reflect_min_sources": 50,
    "beacon_min_flows": 10,
    "beacon_max_cv": 0.25,
    "beacon_min_period": 1.0,
}

# This is a helper function that creates a standardized security alert.
def _finding(attack, severity, confidence, src, dst, evidence):
    return {
        "attack_type": attack,
        "severity": severity,
        "confidence": round(float(confidence), 3),
        "source": src,
        "target": dst,
        "evidence": evidence,
        "detector": "rule",
    }


def analyze_flows(flows_df, config=None):
    """Return findings and a dictionary mapping flagged flow indices to attacks."""

    cfg = {**DEFAULTS, **(config or {})}
    required = [
        "Source IP",
        "Destination IP",
        "Destination Port",
        "Start Time",
    ]

    missing = [c for c in required if c not in flows_df.columns]
    if missing:
        raise ValueError(f"Rule detector needs columns: {missing}")

    df = flows_df.copy()

    # Convert numeric columns BEFORE applying any detection rules.
    numeric_columns = [
        "Destination Port",
        "Total Fwd Packets",
        "Total Backward Packets",
        "SYN Flag Count",
        "ACK Flag Count",
        "RST Flag Count",
        "Flow Duration",
        "Flow Packets/s",
        "Flow Bytes/s",
        "Start Time",
    ]

    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Calculate packet totals after conversion.
    df["_pkts"] = df["Total Fwd Packets"] + df["Total Backward Packets"]

    df["_synack_only"] = (
        (df["SYN Flag Count"] >= 1)
        & (df["ACK Flag Count"] >= 1)
        & (df["Total Backward Packets"] == 0)
        & (df["_pkts"] <= 2)
    )

    findings = []
    flagged = {}

    def mark(indices, attack):
        for i in indices:
            flagged.setdefault(i, attack)

    # 1. SYN-ACK reflection detection
    #rules- At least 300 flows must target the same destination IP.
    #rules- At least 50% of flows must contain SYN and ACK flags but have zero backward packets and at most 2 total packets.
    #rules- At least 50 distinct source IPs must be involved.
    for dst, g in df.groupby("Destination IP"):
        if len(g) < cfg["reflect_min_flows"]:
            continue

        share = g["_synack_only"].mean()
        n_src = g["Source IP"].nunique()

        if share >= cfg["reflect_min_share"] and n_src >= cfg["reflect_min_sources"]:
            span = max(
                g["Start Time"].max() - g["Start Time"].min(),
                1e-3,
            )

            findings.append(
                _finding(
                    "SYN-ACK Reflection DDoS",
                    "high",
                    min(1.0, 0.6 + 0.4 * share),
                    f"{n_src} distinct sources",
                    dst,
                    {
                        "flows": int(len(g)),
                        "unsolicited_synack_share": round(float(share), 3),
                        "unique_sources": int(n_src),
                        "flows_per_second": round(float(len(g) / span), 1),
                    },
                )
            )

            mark(g.index, "SYN-ACK Reflection DDoS")

    # 2. Port scan detection
    #rule- single source IP must contact at least 100 different destination ports on the same destination IP.
    #rule- Average packets per flow must be 6 or less.
    for (src, dst), g in df.groupby(["Source IP", "Destination IP"]):
        ports = g["Destination Port"].nunique()

        if (
            ports >= cfg["scan_min_ports"]
            and g["_pkts"].mean() <= cfg["scan_max_avg_packets"]
        ):
            span = max(
                g["Start Time"].max() - g["Start Time"].min(),
                1e-3,
            )

            findings.append(
                _finding(
                    "Port Scan",
                    "medium",
                    min(1.0, 0.6 + ports / 2000),
                    src,
                    dst,
                    {
                        "distinct_ports": int(ports),
                        "flows": int(len(g)),
                        "avg_packets_per_flow": round(float(g["_pkts"].mean()), 2),
                        "ports_per_second": round(float(ports / span), 1),
                    },
                )
            )

            mark(g.index, "Port Scan")

    # 3. DoS / DDoS flood detection
    #rule- At least 300 flows must target the same destination IP and port.
    #rule- Traffic rate must be at least 100 flows per second.
    #rule- If there are at least 50 distinct source IPs, classify it as DDoS; otherwise, classify it as DoS.
    for (dst, port), g in df.groupby(["Destination IP", "Destination Port"]):
        if len(g) < cfg["flood_min_flows"]:
            continue

        g = g[~g.index.isin(flagged)]

        if len(g) < cfg["flood_min_flows"]:
            continue

        span = max(
            g["Start Time"].max() - g["Start Time"].min(),
            1e-3,
        )

        rate = len(g) / span
        if rate < cfg["flood_min_rate"]:
            continue

        n_src = g["Source IP"].nunique()
        attack = "DDoS" if n_src >= cfg["ddos_min_sources"] else "DoS"

        findings.append(
            _finding(
                attack,
                "high",
                min(1.0, 0.6 + min(rate, 1000) / 2500),
                f"{n_src} source(s)",
                f"{dst}:{int(port)}",
                {
                    "flows": int(len(g)),
                    "unique_sources": int(n_src),
                    "flows_per_second": round(float(rate), 1),
                },
            )
        )

        mark(g.index, attack)

    # 4. Beaconing detection
    #rule- At least 10 connections between the same source IP and destination IP on the same port.
    #rule- Average time interval between connections must be at least 1 second.
    #rule- Variation in connection intervals (CV) must be 0.25 or less.
    for (src, dst, port), g in df.groupby(
        ["Source IP", "Destination IP", "Destination Port"]
    ):
        if len(g) < cfg["beacon_min_flows"]:
            continue

        t = np.sort(g["Start Time"].to_numpy(dtype=float))
        gaps = np.diff(t)

        if len(gaps) < 2 or gaps.mean() < cfg["beacon_min_period"]:
            continue

        cv = gaps.std() / gaps.mean()

        if cv <= cfg["beacon_max_cv"]:
            findings.append(
                _finding(
                    "Botnet (suspected beaconing)",
                    "medium",
                    max(0.5, 0.9 - cv),
                    src,
                    f"{dst}:{int(port)}",
                    {
                        "connections": int(len(g)),
                        "mean_interval_s": round(float(gaps.mean()), 2),
                        "interval_cv": round(float(cv), 3),
                    },
                )
            )

            mark(g.index, "Botnet (suspected beaconing)")

    return findings, flagged
