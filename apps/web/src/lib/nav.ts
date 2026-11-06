/** Fired on this page when saved answers or inputs change, so the menus can catch up. */
export const SAVED_CHANGED = "budgy:saved-changed";

/** The parts of the home page. */
export type HomeView = "dashboard" | "tools" | "ideas" | "settings";

/** Where each part of the home page lives. Links work from any page. */
export const HOME_HREF: Record<HomeView, string> = {
  dashboard: "/",
  tools: "/?view=tools",
  ideas: "/?view=ideas",
  settings: "/?view=settings",
};

/**
 * The home page view a `?view=` value asks for, or null for the dashboard.
 * Older links used `all` for the tool list and `answers` for the questions.
 */
export function viewParam(value: string | null): Exclude<HomeView, "dashboard"> | null {
  if (value === "tools" || value === "all") return "tools";
  if (value === "settings" || value === "answers") return "settings";
  if (value === "ideas") return "ideas";
  return null;
}
