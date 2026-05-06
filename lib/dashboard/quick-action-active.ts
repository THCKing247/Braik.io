/**
 * Pure helper: whether `pathname` should treat `href` as the active quick-action route.
 * Mirrors previous sidebar logic: exact match, or prefix match except for `/dashboard` home.
 */
export function isQuickActionPathActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === "/dashboard") return false
  return pathname.startsWith(href)
}
