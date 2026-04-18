/** Specialized agents (product catalog — matches operator docs / Stitch). */
/** Default engine id when a concrete agent is required by downstream logic (not the composer default). */
export const DEFAULT_AGENT_ID = "IntelligentDecisionEngine";

export type AgentDefinition = {
  id: string;
  name: string;
  description: string;
};

export const AGENTS: AgentDefinition[] = [
  {
    id: "IntelligentDecisionEngine",
    name: "IntelligentDecisionEngine",
    description: "Tool selection and parameter optimization",
  },
  {
    id: "BugBountyWorkflowManager",
    name: "BugBountyWorkflowManager",
    description: "Bug bounty hunting workflows",
  },
  { id: "CTFWorkflowManager", name: "CTFWorkflowManager", description: "CTF challenge solving" },
  {
    id: "CVEIntelligenceManager",
    name: "CVEIntelligenceManager",
    description: "Vulnerability intelligence",
  },
  {
    id: "AIExploitGenerator",
    name: "AIExploitGenerator",
    description: "Automated exploit development",
  },
  {
    id: "VulnerabilityCorrelator",
    name: "VulnerabilityCorrelator",
    description: "Attack chain discovery",
  },
  {
    id: "TechnologyDetector",
    name: "TechnologyDetector",
    description: "Technology stack identification",
  },
  {
    id: "RateLimitDetector",
    name: "RateLimitDetector",
    description: "Rate limiting detection",
  },
  {
    id: "FailureRecoverySystem",
    name: "FailureRecoverySystem",
    description: "Error handling and recovery",
  },
  { id: "PerformanceMonitor", name: "PerformanceMonitor", description: "System optimization" },
  {
    id: "ParameterOptimizer",
    name: "ParameterOptimizer",
    description: "Context-aware optimization",
  },
  {
    id: "GracefulDegradation",
    name: "GracefulDegradation",
    description: "Fault-tolerant operation",
  },
];

export function getAgentLabel(id: string): string {
  if (!id.trim()) return "None";
  return AGENTS.find((a) => a.id === id)?.name ?? id;
}
