const PREFIX = "cs_arsenal_cfg_";

export type SavedToolConfig = {
  target: string;
  flagValues: Record<string, boolean>;
  extraArgs: string;
};

function key(id: string): string {
  return `${PREFIX}${id}`;
}

export function loadToolConfig(id: string): Partial<SavedToolConfig> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Partial<SavedToolConfig>;
  } catch {
    return null;
  }
}

export function saveToolConfig(id: string, data: SavedToolConfig): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key(id), JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}
