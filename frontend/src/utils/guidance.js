// Static, general-purpose analyst guidance shown on the investigation page.
// This is NOT returned by the backend – the UI labels it accordingly.
// CYBERSHIELD only detects and analyses traffic, so every step here is a manual check.

const GUIDES = [
  {
    match: /ddos|dos|slowloris|hulk|goldeneye|slowhttp/i,
    steps: [
      'Check the destination host and service for resource exhaustion (CPU, connection table, bandwidth) around the flow timestamp.',
      'Compare how many distinct source IPs hit the target in the same window to separate DoS from DDoS behaviour.',
      'Review request rate and connection duration in the flow features – slow-rate variants keep connections open unusually long.',
      'Look at upstream logs (load balancer, firewall) for the same time window to confirm the volume.',
    ],
  },
  {
    match: /port\s*scan|portscan|scan/i,
    steps: [
      'List every destination port touched by the source IP in the capture and look for sequential or wide-ranging patterns.',
      'Check whether the source is an internal asset (vulnerability scanner, monitoring) before treating it as hostile.',
      'Inspect SYN / RST flag counts – scans typically show many short, unanswered connection attempts.',
      'Search firewall logs for earlier probing from the same source.',
    ],
  },
  {
    match: /patator|brute|ssh|ftp/i,
    steps: [
      'Review authentication logs on the destination host for repeated failures from the source IP.',
      'Check whether any attempt succeeded and, if so, look at what the account did afterwards.',
      'Look at the connection rate and duration pattern across flows from the same source.',
    ],
  },
  {
    match: /xss|sql|web attack|injection/i,
    steps: [
      'Pull the web server / WAF logs for the destination around the flow timestamp and inspect the requested URLs and parameters.',
      'Confirm whether the targeted endpoint is exposed and whether input there is validated.',
      'Check for follow-up requests from the same source that might indicate successful exploitation.',
    ],
  },
  {
    match: /bot/i,
    steps: [
      'Inspect the internal host for periodic outbound connections to the same external destination (beaconing).',
      'Check the destination IP / domain against your own blocklists and DNS logs.',
      'Review endpoint logs for the process that opened the connection.',
    ],
  },
  {
    match: /infiltration|heartbleed/i,
    steps: [
      'Check the destination host for unexpected processes, new accounts or outbound transfers after the flow timestamp.',
      'Verify patch level of the exposed service and review its logs for malformed requests.',
      'Look for lateral movement from the destination to other internal hosts.',
    ],
  },
]

const DEFAULT_STEPS = [
  'Confirm the source and destination IPs are what you expect (asset inventory, DHCP / DNS logs).',
  'Look at the surrounding flows from the same source in this analysis to see whether the behaviour repeats.',
  'Compare the flagged flow with the evidence and rule findings shown on this page before deciding whether it is a false positive.',
  'Correlate with host, firewall or server logs from the same time window.',
]

export function stepsFor(attackType) {
  const hit = GUIDES.find((g) => g.match.test(attackType || ''))
  return hit ? hit.steps : DEFAULT_STEPS
}
