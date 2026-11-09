/** URL of a market page. */
export function marketHref(marketId: string): string {
  return `/markets/${marketId}`;
}

/** Directory filtered to one group. */
export function groupHref(groupId: string): string {
  return `/markets?group=${encodeURIComponent(groupId)}`;
}

/** Directory filtered to one category. */
export function categoryHref(categoryId: string): string {
  return `/markets?category=${encodeURIComponent(categoryId)}`;
}
