/** Short display label; handles whitespace, Unicode and missing names. */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? '')
      .join('')
      .toLocaleUpperCase() || '?'
  );
}
