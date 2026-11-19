/** Shareable join link for a project, e.g. https://weigh-in-liart.vercel.app/join/WGH-4821 */
export function joinLink(code: string): string {
  return `${window.location.origin}/join/${code}`
}
