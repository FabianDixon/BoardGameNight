/**
 * Shared semantic constants for workflow states, view modes, and navigation tabs.
 * Centralizes string literals to reduce typo risk and improve maintainability.
 */

// Vote/Session Status States
export const VOTE_STATUS = {
  COLLECTING: "collecting",
  OPEN: "open",
  CLOSED: "closed",
};

// Main Application Tabs
export const APP_TAB = {
  LIBRARY: "library",
  COLLECTION: "collection",
  GROUP: "group",
  ANALYTICS: "analytics",
  PROFILE: "profile",
};

// Group Detail View Modes
export const GROUP_VIEW = {
  PICKER: "picker",
  DETAIL: "detail",
};

// Group Content Tabs (within GROUP_VIEW.DETAIL)
export const GROUP_TAB = {
  COLLECTION: "collection",
  VOTING: "voting",
  HISTORY: "history",
  STATISTICS: "statistics",
  TOOLS: "tools",
  SETTINGS: "settings",
  MANAGE: "manage",
};

// Pool Filter Modes (in group collection view)
export const POOL_FILTER = {
  ALL: "all",
  IN_POOL: "in",
  OUT_OF_POOL: "out",
};
