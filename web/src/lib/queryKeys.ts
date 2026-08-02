export const queryKeys = {
  space: ["space"] as const,
  spaceStatus: ["space-status"] as const,
  appSettings: ["app-settings"] as const,
  entries: (type: string, params?: Record<string, unknown>) =>
    ["entries", type, params ?? {}] as const,
  entry: (id: string) => ["entry", id] as const,
  comments: (targetType: string, targetId: string) =>
    ["comments", targetType, targetId] as const,
  gallery: (filter: string, params?: Record<string, unknown>) =>
    ["gallery", filter, params ?? {}] as const,
  activityStats: (days: number) => ["activity-stats", days] as const,
  memorySummary: ["memory-summary"] as const,
  memoryNodes: (params?: Record<string, unknown>) =>
    ["memory-nodes", params ?? {}] as const,
  memoryMilestones: ["memory-milestones"] as const,
  memoryThemes: ["memory-themes"] as const,
  drafts: (type: string) => ["drafts", type] as const,
  search: (q: string) => ["search", q] as const,
};
