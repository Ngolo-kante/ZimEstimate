export interface NavItem {
  label: string;
  href: string;
  description?: string;
  /** Highlight when the path starts with this instead of href — lets
      "My projects" stay lit on /projects and /projects/[id], not only on
      its own landing URL. */
  activePrefix?: string;
  hasDropdown?: boolean;
  adminOnly?: boolean;
}

export const exploreNavItems: NavItem[] = [
  { label: 'Market Insights', href: '/market-insights', description: 'Track current material prices' },
  { label: 'Templates', href: '/templates', description: 'Start from a proven build' },
  { label: 'Marketplace', href: '/marketplace', description: 'Find materials and suppliers' },
  { label: 'Contractors', href: '/contractors', description: 'Browse verified professionals' },
];
