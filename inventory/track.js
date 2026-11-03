/* Analytics stub. The site has no analytics provider yet, so this only logs in
   development. Wire a provider here later; callers never pass workflow text. */
const isDev = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export function track(event, props = {}) {
  if (isDev) console.debug("[track]", event, props);
}
