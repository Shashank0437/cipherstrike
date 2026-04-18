/** Mirrors API `/tools` ids when the client cannot reach the API (offline / auth). */
export const ARSENAL_FALLBACK_TOOLS: { id: string; name: string }[] = [
  { id: "nmap", name: "nmap" },
  { id: "masscan", name: "masscan" },
  { id: "sqlmap", name: "sqlmap" },
  { id: "metasploit", name: "msfconsole" },
  { id: "burp", name: "burp" },
  { id: "nikto", name: "nikto" },
  { id: "john", name: "john" },
  { id: "aircrack", name: "aircrack" },
  { id: "wireshark", name: "wireshark" },
];
