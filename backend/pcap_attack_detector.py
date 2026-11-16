"""PCAP-level detector for high-volume TCP SYN-ACK reflection patterns."""
from __future__ import annotations
import argparse # Accepts command line arguments
import json
from collections import Counter #counts occurence of IP addr and ports
from pathlib import Path

from scapy.layers.inet import IP, TCP
from scapy.layers.inet6 import IPv6
from scapy.utils import PcapNgReader, PcapReader

def analyze_pcap(pcap_path: str | Path) -> dict:
    path = Path(pcap_path)
    if not path.is_file():
        raise FileNotFoundError(f"PCAP file not found: {path}")

    reader_cls = PcapNgReader if path.suffix.lower() == ".pcapng" else PcapReader
    total_packets = tcp_packets = synack_packets = 0
    timestamps: list[float] = []
    source_ips: set[str] = set()
    destination_ips: Counter[str] = Counter()
    source_ports: Counter[int] = Counter()
    destination_ports: Counter[int] = Counter()

    with reader_cls(str(path)) as reader:
        for packet in reader:
            total_packets += 1
            if TCP not in packet or not (IP in packet or IPv6 in packet):
                continue

            tcp_packets += 1
            ip = packet[IP] if IP in packet else packet[IPv6]
            tcp = packet[TCP]
            ts = float(packet.time)
            timestamps.append(ts)
            source_ips.add(str(ip.src))
            destination_ips[str(ip.dst)] += 1
            source_ports[int(tcp.sport)] += 1
            destination_ports[int(tcp.dport)] += 1

            flags = int(tcp.flags)
            # SYN and ACK set, RST not set. hexadecimal fform of synack is 0x12
            if (flags & 0x12) == 0x12 and (flags & 0x04) == 0: 
                synack_packets += 1

    if not timestamps:
        raise ValueError("No TCP/IP packets were found in this PCAP.")

    duration = max(timestamps) - min(timestamps)
    duration = max(duration, 1e-9)
    synack_rate = synack_packets / duration
    unique_sources = len(source_ips)
    top_destination, top_destination_count = destination_ips.most_common(1)[0]
    destination_share = top_destination_count / tcp_packets if tcp_packets else 0.0
    synack_ratio = synack_packets / tcp_packets if tcp_packets else 0.0

    # Conservative, transparent indicators. These are screening thresholds,
    # not a universal definition of DDoS and should be calibrated to the network.
    indicators = {
        "high_synack_volume": synack_packets >= 1000,
        "high_synack_rate": synack_rate >= 1000,
        "high_source_diversity": unique_sources >= 500,
        "concentrated_destination": destination_share >= 0.80,
        "synack_dominant": synack_ratio >= 0.50,
    }
    triggered = sum(indicators.values())
    suspected = triggered >= 4

    return {
        "pcap": str(path),
        "total_packets": total_packets,
        "tcp_packets": tcp_packets,
        "syn_ack_packets": synack_packets,
        "capture_duration_seconds": duration,
        "syn_ack_packets_per_second": synack_rate,
        "unique_source_ips": unique_sources,
        "top_destination_ip": top_destination,
        "top_destination_packet_count": top_destination_count,
        "top_destination_share_of_tcp": destination_share,
        "syn_ack_share_of_tcp": synack_ratio,
        "top_tcp_source_ports": dict(source_ports.most_common(10)),
        "top_tcp_destination_ports": dict(destination_ports.most_common(10)),
        "indicators": indicators,
        "indicators_triggered": triggered,
        "assessment": (
            "POTENTIAL TCP SYN-ACK REFLECTION / FLOOD PATTERN"
            if suspected else "No strong SYN-ACK reflection pattern detected"
        ),
        "note": (
            "Aggregate screening result, not proof of malicious intent. "
            "Correlate with network context and validate thresholds."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pcap", help="Path to a .pcap or .pcapng file")
    parser.add_argument("--output", help="Optional JSON report path")
    args = parser.parse_args()

    report = analyze_pcap(args.pcap)
    print(json.dumps(report, indent=4))

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=4), encoding="utf-8")
        print(f"\nReport saved to: {output_path}")


if __name__ == "__main__":
    main()
