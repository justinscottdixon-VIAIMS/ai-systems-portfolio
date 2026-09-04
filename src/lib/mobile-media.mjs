export const MOBILE_MAX_WIDTH = 767;

export const isMobileViewport = (width) => Number.isFinite(width) && width <= MOBILE_MAX_WIDTH;

export function eligibleVideoItems(items, width) {
  return isMobileViewport(width)
    ? items.filter((item) => item.aspect === 'portrait')
    : [...items];
}
