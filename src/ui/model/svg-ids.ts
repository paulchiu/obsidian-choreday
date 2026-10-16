/**
 * Renames the `cd-` ids in an SVG, and each reference to them, by adding `suffix`. A `url(#id)`
 * resolves to the first match in the document, so two copies of one drawing would otherwise share
 * the first copy's clip paths, which break while that copy sits in a hidden tab.
 */
export const withIdSuffix = (svg: string, suffix: string): string =>
  svg.replace(/(id="|#)(cd-[\w-]+)/g, `$1$2-${suffix}`)
