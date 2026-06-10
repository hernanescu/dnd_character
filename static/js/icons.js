export const SUN_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle"><circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="0.8" x2="7" y2="2.3" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="11.7" x2="7" y2="13.2" stroke="currentColor" stroke-width="1.2"/><line x1="0.8" y1="7" x2="2.3" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="11.7" y1="7" x2="13.2" y2="7" stroke="currentColor" stroke-width="1.2"/></svg>`;

export const MOON_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle"><path d="M12.5 8.7A5.5 5.5 0 1 1 5.3 1.5 4.3 4.3 0 0 0 12.5 8.7Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

export function themeIcon(theme) {
  return theme === 'dark' ? MOON_ICON : SUN_ICON;
}
