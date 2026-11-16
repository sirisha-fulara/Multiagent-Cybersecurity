// The 78 numeric CICIDS2017 features, grouped so the single-flow form isn't one huge wall of inputs.
// NOTE: names and order must match what the Flask model expects. They're kept in one place so
// that adjusting them (e.g. dropping "Fwd Header Length.1") is a one-file change.

export const FEATURE_GROUPS = [
  {
    id: 'basics',
    title: 'Flow basics',
    description: 'Port, duration and overall packet / byte counts.',
    fields: [
      'Destination Port',
      'Flow Duration',
      'Total Fwd Packets',
      'Total Backward Packets',
      'Total Length of Fwd Packets',
      'Total Length of Bwd Packets',
    ],
  },
  {
    id: 'pktlen',
    title: 'Packet lengths',
    description: 'Forward and backward packet size statistics.',
    fields: [
      'Fwd Packet Length Max',
      'Fwd Packet Length Min',
      'Fwd Packet Length Mean',
      'Fwd Packet Length Std',
      'Bwd Packet Length Max',
      'Bwd Packet Length Min',
      'Bwd Packet Length Mean',
      'Bwd Packet Length Std',
    ],
  },
  {
    id: 'rates',
    title: 'Rates & flow IAT',
    description: 'Throughput and inter-arrival times across the whole flow.',
    fields: [
      'Flow Bytes/s',
      'Flow Packets/s',
      'Flow IAT Mean',
      'Flow IAT Std',
      'Flow IAT Max',
      'Flow IAT Min',
    ],
  },
  {
    id: 'iat',
    title: 'Fwd / Bwd IAT',
    description: 'Inter-arrival times per direction.',
    fields: [
      'Fwd IAT Total',
      'Fwd IAT Mean',
      'Fwd IAT Std',
      'Fwd IAT Max',
      'Fwd IAT Min',
      'Bwd IAT Total',
      'Bwd IAT Mean',
      'Bwd IAT Std',
      'Bwd IAT Max',
      'Bwd IAT Min',
    ],
  },
  {
    id: 'headers',
    title: 'Flags & headers',
    description: 'PSH / URG flags, header lengths and per-direction packet rates.',
    fields: [
      'Fwd PSH Flags',
      'Bwd PSH Flags',
      'Fwd URG Flags',
      'Bwd URG Flags',
      'Fwd Header Length',
      'Bwd Header Length',
      'Fwd Packets/s',
      'Bwd Packets/s',
    ],
  },
  {
    id: 'pktstats',
    title: 'Packet statistics',
    description: 'Length statistics across all packets in the flow.',
    fields: [
      'Min Packet Length',
      'Max Packet Length',
      'Packet Length Mean',
      'Packet Length Std',
      'Packet Length Variance',
    ],
  },
  {
    id: 'tcpflags',
    title: 'TCP flag counts',
    description: 'How many packets carried each TCP flag.',
    fields: [
      'FIN Flag Count',
      'SYN Flag Count',
      'RST Flag Count',
      'PSH Flag Count',
      'ACK Flag Count',
      'URG Flag Count',
      'CWE Flag Count',
      'ECE Flag Count',
    ],
  },
  {
    id: 'ratios',
    title: 'Size & ratios',
    description: 'Average sizes and the down/up ratio.',
    fields: [
      'Down/Up Ratio',
      'Average Packet Size',
      'Avg Fwd Segment Size',
      'Avg Bwd Segment Size',
      'Fwd Header Length.1',
    ],
  },
  {
    id: 'bulk',
    title: 'Bulk & subflow',
    description: 'Bulk transfer averages and subflow totals.',
    fields: [
      'Fwd Avg Bytes/Bulk',
      'Fwd Avg Packets/Bulk',
      'Fwd Avg Bulk Rate',
      'Bwd Avg Bytes/Bulk',
      'Bwd Avg Packets/Bulk',
      'Bwd Avg Bulk Rate',
      'Subflow Fwd Packets',
      'Subflow Fwd Bytes',
      'Subflow Bwd Packets',
      'Subflow Bwd Bytes',
    ],
  },
  {
    id: 'window',
    title: 'Window & segments',
    description: 'TCP window sizes and segment info.',
    fields: [
      'Init_Win_bytes_forward',
      'Init_Win_bytes_backward',
      'act_data_pkt_fwd',
      'min_seg_size_forward',
    ],
  },
  {
    id: 'activity',
    title: 'Active / idle',
    description: 'Time the flow spent active versus idle.',
    fields: [
      'Active Mean',
      'Active Std',
      'Active Max',
      'Active Min',
      'Idle Mean',
      'Idle Std',
      'Idle Max',
      'Idle Min',
    ],
  },
]

export const ALL_FEATURES = FEATURE_GROUPS.flatMap((g) => g.fields)

// header matching ignores case, spaces and punctuation so " Flow Bytes/s" still lines up
export const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
