from pathlib import Path
import pandas as pd

from scapy.layers.inet import IP, TCP, UDP
from scapy.layers.inet6 import IPv6
from scapy.utils import PcapReader, PcapNgReader

# flow represents a communication between two network endpoints.
# A flow is considered new if it is inactive for 120 seconds
FLOW_TIMEOUT = 120


def extract_flows(pcap_path):
    """Group packets into bidirectional flows."""
    pcap_path = Path(pcap_path)

    if not pcap_path.exists():
        raise FileNotFoundError("PCAP file not found.")

    # Select the correct reader
    if pcap_path.suffix.lower() == ".pcapng":
        reader = PcapNgReader
    else:
        reader = PcapReader

    flows = []  # all extracted flows
    active_flows = {}  # crrently active flows
    flow_number = 0

    print("Reading PCAP file...")
    with reader(str(pcap_path)) as packets:
        for packet in packets:

            # Get IP information
            if IP in packet:
                ip = packet[IP]
                source_ip = ip.src
                destination_ip = ip.dst
                protocol = ip.proto  # identifies the transport protocol number.

            elif IPv6 in packet:
                ip = packet[IPv6]
                source_ip = ip.src
                destination_ip = ip.dst
                protocol = ip.nh  # give next header value

            else:
                continue

            # start with TCP and UDP traffic
            if TCP in packet:
                transport = packet[TCP]
                source_port = transport.sport
                destination_port = transport.dport
                protocol_name = "TCP"

                tcp_flags = int(transport.flags)
                window_size = transport.window
                transport_header_length = (
                    transport.dataofs * 4
                )  # TCP header length is represented in units of 4 bytes.

            elif UDP in packet:
                transport = packet[UDP]
                source_port = transport.sport
                destination_port = transport.dport
                protocol_name = "UDP"

                tcp_flags = 0
                window_size = 0
                transport_header_length = 8

            else:
                continue

            timestamp = float(packet.time)

            # Identify both directions as the same flow
            source = (source_ip, source_port)
            destination = (destination_ip, destination_port)
            endpoints = tuple(sorted([source, destination]))
            flow_key = (protocol_name, endpoints)

            # Check whether this flow already exists
            flow = active_flows.get(flow_key)
            if flow is None or timestamp - flow["Last Seen"] > FLOW_TIMEOUT:
                flow_number += 1
                flow = {
                    "Flow ID": flow_number,
                    "Source IP": source_ip,
                    "Source Port": source_port,
                    "Destination IP": destination_ip,
                    "Destination Port": destination_port,
                    "Protocol": protocol_name,
                    "Start Time": timestamp,
                    "Last Seen": timestamp,
                    "Forward Packets": [],
                    "Backward Packets": [],
                }

                flows.append(flow)
                active_flows[flow_key] = flow

            flow["Last Seen"] = timestamp

            # Collect packet information
            packet_info = {
                "timestamp": timestamp,
                "length": len(transport.payload),
                "tcp_hdr": transport_header_length,
                "tcp_flags": tcp_flags,
                "window_size": window_size,
                "header_length": (
                    (ip.ihl * 4 if IP in packet else 40) + transport_header_length
                ),
            }

            # Identify packet direction
            if source_ip == flow["Source IP"] and source_port == flow["Source Port"]:
                flow["Forward Packets"].append(packet_info)
            else:
                flow["Backward Packets"].append(packet_info)

    print("Flow extraction completed!")
    return flows


def save_flow_summary(flows, output_path):
    import numpy as np

    results = []

    for flow in flows:
        forward = flow["Forward Packets"]
        backward = flow["Backward Packets"]

        all_packets = forward + backward

        duration = flow["Last Seen"] - flow["Start Time"]

        # These features help identify traffic imbalance and unusual communication volume.
        fwd_lengths = [p["length"] for p in forward]
        bwd_lengths = [p["length"] for p in backward]
        total_fwd_bytes = sum(fwd_lengths)
        total_bwd_bytes = sum(bwd_lengths)

        total_packets = len(all_packets)

        # Inter-arrival time means the time difference between two consecutive packets.
        # IAT features help understand the timing behaviour of network communication.
        def calculate_iat(packets):
            if len(packets) < 2:
                return 0, 0, 0, 0, 0

            # Sort packets by timestamp before calculating intervals
            timestamps = sorted(p["timestamp"] for p in packets)

            # Calculate time difference in microseconds
            iats = [
                (timestamps[i] - timestamps[i - 1]) * 1000000
                for i in range(1, len(timestamps))
            ]

            return (
                sum(iats),
                np.mean(iats),
                np.std(iats, ddof=1) if len(iats) > 1 else 0,
                max(iats),
                min(iats),
            )

        flow_iat_total, flow_iat_mean, flow_iat_std, flow_iat_max, flow_iat_min = (
            calculate_iat(all_packets)
        )

        fwd_iat_total, fwd_iat_mean, fwd_iat_std, fwd_iat_max, fwd_iat_min = (
            calculate_iat(forward)
        )

        bwd_iat_total, bwd_iat_mean, bwd_iat_std, bwd_iat_max, bwd_iat_min = (
            calculate_iat(backward)
        )

        # TCP flag counts
        # Different attacks have different TCP flag patterns.
        def count_flag(packets, flag):
            return sum(1 for p in packets if p["tcp_flags"] & flag)

        fwd_psh = count_flag(forward, 8)
        bwd_psh = count_flag(backward, 8)

        fwd_urg = count_flag(forward, 32)
        bwd_urg = count_flag(backward, 32)

        fin_count = count_flag(all_packets, 1)
        syn_count = count_flag(all_packets, 2)
        rst_count = count_flag(all_packets, 4)
        psh_count = count_flag(all_packets, 8)
        ack_count = count_flag(all_packets, 16)
        urg_count = count_flag(all_packets, 32)
        ece_count = count_flag(all_packets, 64)
        cwe_count = count_flag(all_packets, 128)

        fwd_header_length = sum(p["header_length"] for p in forward)
        bwd_header_length = sum(p["header_length"] for p in backward)

        # Overall packet length statistics
        packet_lengths = [p["length"] for p in all_packets]

        min_packet_length = min(packet_lengths) if packet_lengths else 0
        max_packet_length = max(packet_lengths) if packet_lengths else 0

        packet_length_mean = np.mean(packet_lengths) if packet_lengths else 0
        packet_length_std = (
            np.std(packet_lengths, ddof=1) if len(packet_lengths) > 1 else 0
        )

        packet_length_variance = (
            np.var(packet_lengths, ddof=1) if len(packet_lengths) > 1 else 0
        )

        average_packet_size = (
            sum(packet_lengths) / len(packet_lengths) if packet_lengths else 0
        )

        # Average packet and segment features
        # These represent the average payload length of packets in each direction in your implementation.
        down_up_ratio = len(backward) / len(forward) if len(forward) > 0 else 0
        avg_fwd_segment_size = np.mean(fwd_lengths) if fwd_lengths else 0
        avg_bwd_segment_size = np.mean(bwd_lengths) if bwd_lengths else 0

        # Initial bulk estimates
        # The server sends multiple consecutive data packets. Those packets can be grouped into a bulk transfer.
        fwd_avg_bytes_bulk = 0
        fwd_avg_packets_bulk = 0
        fwd_avg_bulk_rate = 0

        bwd_avg_bytes_bulk = 0
        bwd_avg_packets_bulk = 0
        bwd_avg_bulk_rate = 0

        # subflow is a smaller segment of a larger flow,
        subflow_fwd_packets = len(forward)
        subflow_fwd_bytes = total_fwd_bytes
        subflow_bwd_packets = len(backward)
        subflow_bwd_bytes = total_bwd_bytes

        # Initial TCP window sizes
        init_win_forward = forward[0]["window_size"] if forward else 0

        init_win_backward = backward[0]["window_size"] if backward else 0

        # Forward data packet count
        act_data_pkt_fwd = sum(1 for p in forward if p["length"] > 0)

        # Minimum forward segment size
        min_seg_size_forward = min(p["tcp_hdr"] for p in forward) if forward else 0

        # Active and idle time estimates
        # They help capture whether a flow has continuous traffic or periods of inactivity.
        timestamps = sorted(p["timestamp"] for p in all_packets)
        active_periods = []
        idle_periods = []
        if len(timestamps) > 1:
            gaps = [
                (timestamps[i] - timestamps[i - 1]) * 1000000
                for i in range(1, len(timestamps))
            ]

            active_periods = [gap for gap in gaps if gap <= 1000000]
            idle_periods = [gap for gap in gaps if gap > 1000000]

        def time_stats(values):
            if not values:
                return 0, 0, 0, 0

            return (
                np.mean(values),
                np.std(values, ddof=1) if len(values) > 1 else 0,
                max(values),
                min(values),
            )

        active_mean, active_std, active_max, active_min = time_stats(active_periods)
        idle_mean, idle_std, idle_max, idle_min = time_stats(idle_periods)

        def packet_stats(lengths):
            if not lengths:
                return 0, 0, 0, 0

            return (
                max(lengths),
                min(lengths),
                np.mean(lengths),
                np.std(lengths, ddof=1) if len(lengths) > 1 else 0,
            )

        fwd_max, fwd_min, fwd_mean, fwd_std = packet_stats(fwd_lengths)
        bwd_max, bwd_min, bwd_mean, bwd_std = packet_stats(bwd_lengths)

        flow_bytes_per_sec = (
            (total_fwd_bytes + total_bwd_bytes) / duration if duration > 0 else 0
        )

        flow_packets_per_sec = total_packets / duration if duration > 0 else 0

        fwd_packets_per_sec = len(forward) / duration if duration > 0 else 0
        bwd_packets_per_sec = len(backward) / duration if duration > 0 else 0

        results.append(
            {
                "Flow ID": flow["Flow ID"],
                "Start Time": flow["Start Time"],
                "Protocol": flow["Protocol"],
                "Source IP": flow["Source IP"],
                "Source Port": flow["Source Port"],
                "Destination IP": flow["Destination IP"],
                "Destination Port": flow["Destination Port"],
                "Flow Duration": duration * 1000000,
                "Total Fwd Packets": len(forward),
                "Total Backward Packets": len(backward),
                "Total Length of Fwd Packets": total_fwd_bytes,
                "Total Length of Bwd Packets": total_bwd_bytes,
                "Fwd Packet Length Max": fwd_max,
                "Fwd Packet Length Min": fwd_min,
                "Fwd Packet Length Mean": fwd_mean,
                "Fwd Packet Length Std": fwd_std,
                "Bwd Packet Length Max": bwd_max,
                "Bwd Packet Length Min": bwd_min,
                "Bwd Packet Length Mean": bwd_mean,
                "Bwd Packet Length Std": bwd_std,
                "Flow Bytes/s": flow_bytes_per_sec,
                "Flow Packets/s": flow_packets_per_sec,
                "Flow IAT Mean": flow_iat_mean,
                "Flow IAT Std": flow_iat_std,
                "Flow IAT Max": flow_iat_max,
                "Flow IAT Min": flow_iat_min,
                "Fwd IAT Total": fwd_iat_total,
                "Fwd IAT Mean": fwd_iat_mean,
                "Fwd IAT Std": fwd_iat_std,
                "Fwd IAT Max": fwd_iat_max,
                "Fwd IAT Min": fwd_iat_min,
                "Bwd IAT Total": bwd_iat_total,
                "Bwd IAT Mean": bwd_iat_mean,
                "Bwd IAT Std": bwd_iat_std,
                "Bwd IAT Max": bwd_iat_max,
                "Bwd IAT Min": bwd_iat_min,
                "Fwd PSH Flags": fwd_psh,
                "Bwd PSH Flags": bwd_psh,
                "Fwd URG Flags": fwd_urg,
                "Bwd URG Flags": bwd_urg,
                "Fwd Header Length": fwd_header_length,
                "Bwd Header Length": bwd_header_length,
                "FIN Flag Count": fin_count,
                "SYN Flag Count": syn_count,
                "RST Flag Count": rst_count,
                "PSH Flag Count": psh_count,
                "ACK Flag Count": ack_count,
                "URG Flag Count": urg_count,
                "CWE Flag Count": cwe_count,
                "ECE Flag Count": ece_count,
                "Min Packet Length": min_packet_length,
                "Max Packet Length": max_packet_length,
                "Packet Length Mean": packet_length_mean,
                "Packet Length Std": packet_length_std,
                "Packet Length Variance": packet_length_variance,
                "Average Packet Size": average_packet_size,
                "Down/Up Ratio": down_up_ratio,
                "Avg Fwd Segment Size": avg_fwd_segment_size,
                "Avg Bwd Segment Size": avg_bwd_segment_size,
                "Fwd Header Length.1": fwd_header_length,
                "Fwd Avg Bytes/Bulk": fwd_avg_bytes_bulk,
                "Fwd Avg Packets/Bulk": fwd_avg_packets_bulk,
                "Fwd Avg Bulk Rate": fwd_avg_bulk_rate,
                "Bwd Avg Bytes/Bulk": bwd_avg_bytes_bulk,
                "Bwd Avg Packets/Bulk": bwd_avg_packets_bulk,
                "Bwd Avg Bulk Rate": bwd_avg_bulk_rate,
                "Subflow Fwd Packets": subflow_fwd_packets,
                "Subflow Fwd Bytes": subflow_fwd_bytes,
                "Subflow Bwd Packets": subflow_bwd_packets,
                "Subflow Bwd Bytes": subflow_bwd_bytes,
                "Init_Win_bytes_forward": init_win_forward,
                "Init_Win_bytes_backward": init_win_backward,
                "act_data_pkt_fwd": act_data_pkt_fwd,
                "min_seg_size_forward": min_seg_size_forward,
                "Active Mean": active_mean,
                "Active Std": active_std,
                "Active Max": active_max,
                "Active Min": active_min,
                "Idle Mean": idle_mean,
                "Idle Std": idle_std,
                "Idle Max": idle_max,
                "Idle Min": idle_min,
                "Fwd Packets/s": fwd_packets_per_sec,
                "Bwd Packets/s": bwd_packets_per_sec,
            }
        )

    FEATURE_ORDER = [
        "Destination Port",
        "Flow Duration",
        "Total Fwd Packets",
        "Total Backward Packets",
        "Total Length of Fwd Packets",
        "Total Length of Bwd Packets",
        "Fwd Packet Length Max",
        "Fwd Packet Length Min",
        "Fwd Packet Length Mean",
        "Fwd Packet Length Std",
        "Bwd Packet Length Max",
        "Bwd Packet Length Min",
        "Bwd Packet Length Mean",
        "Bwd Packet Length Std",
        "Flow Bytes/s",
        "Flow Packets/s",
        "Flow IAT Mean",
        "Flow IAT Std",
        "Flow IAT Max",
        "Flow IAT Min",
        "Fwd IAT Total",
        "Fwd IAT Mean",
        "Fwd IAT Std",
        "Fwd IAT Max",
        "Fwd IAT Min",
        "Bwd IAT Total",
        "Bwd IAT Mean",
        "Bwd IAT Std",
        "Bwd IAT Max",
        "Bwd IAT Min",
        "Fwd PSH Flags",
        "Bwd PSH Flags",
        "Fwd URG Flags",
        "Bwd URG Flags",
        "Fwd Header Length",
        "Bwd Header Length",
        "Fwd Packets/s",
        "Bwd Packets/s",
        "Min Packet Length",
        "Max Packet Length",
        "Packet Length Mean",
        "Packet Length Std",
        "Packet Length Variance",
        "FIN Flag Count",
        "SYN Flag Count",
        "RST Flag Count",
        "PSH Flag Count",
        "ACK Flag Count",
        "URG Flag Count",
        "CWE Flag Count",
        "ECE Flag Count",
        "Down/Up Ratio",
        "Average Packet Size",
        "Avg Fwd Segment Size",
        "Avg Bwd Segment Size",
        "Fwd Header Length.1",
        "Fwd Avg Bytes/Bulk",
        "Fwd Avg Packets/Bulk",
        "Fwd Avg Bulk Rate",
        "Bwd Avg Bytes/Bulk",
        "Bwd Avg Packets/Bulk",
        "Bwd Avg Bulk Rate",
        "Subflow Fwd Packets",
        "Subflow Fwd Bytes",
        "Subflow Bwd Packets",
        "Subflow Bwd Bytes",
        "Init_Win_bytes_forward",
        "Init_Win_bytes_backward",
        "act_data_pkt_fwd",
        "min_seg_size_forward",
        "Active Mean",
        "Active Std",
        "Active Max",
        "Active Min",
        "Idle Mean",
        "Idle Std",
        "Idle Max",
        "Idle Min",
    ]
    df = pd.DataFrame(results)

    # Check whether all required model features exist
    missing_features = [col for col in FEATURE_ORDER if col not in df.columns]
    if missing_features:
        raise ValueError(f"Missing model features: {missing_features}")

    # Keep model features first, followed by metadata
    # after the ML model identifies a suspicious flow, application needs to know which actual network communication was flagged.
    metadata_columns = [
        "Flow ID",
        "Start Time",
        "Protocol",
        "Source IP",
        "Source Port",
        "Destination IP",
    ]

    df = df[FEATURE_ORDER + metadata_columns]

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(output_path, index=False)

    print("Feature extraction completed!")
    print("Feature file saved to:", output_path)
    print("Total flows:", len(df))
    print("Features calculated:", len(df.columns))


if __name__ == "__main__":
    pcap_file = "data/pcap_samples/synthetic_portscan.pcap"
    output_file = "data/processed/flow_summary.csv"
    flows = extract_flows(pcap_file)
    save_flow_summary(flows, output_file)
