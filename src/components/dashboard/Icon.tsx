import type { DashboardNavItem } from "./nav-items";

const PATHS: Record<DashboardNavItem["icon"], string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9",
  calendar: "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  users: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M15 8a3 3 0 1 0-6 0M21 20v-1a4 4 0 0 0-3-3.87",
  scissors: "M6 9a3 3 0 1 0 0 .01M6 15a3 3 0 1 0 0 .01M8.5 8.5 20 20M8.5 15.5 20 4",
  clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "user-group": "M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M17 8a2.5 2.5 0 1 1 1.5 4.5M20 20v-1a4 4 0 0 0-3-3.87",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6c.6-.25 1-.83 1.04-1.48V3a2 2 0 1 1 4 0v.09c.03.65.43 1.23 1.04 1.48.66.27 1.42.13 1.94-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.34.34-.5 .8-.44 1.26",
  chart: "M4 19V10M10 19V5M16 19v-7M22 19H2",
};

export function Icon({ name, className }: { name: DashboardNavItem["icon"]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
