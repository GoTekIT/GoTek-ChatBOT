/** Sequence pagination is independent of the provider's historical timestamps. */
export async function loadMessagePages<T extends {id: string; sequence?: number}>(
  fetchPage: (after: number) => Promise<T[]>,
  isCurrent: () => boolean,
): Promise<T[] | undefined> {
  const messages = new Map<string, T>();
  let cursor = 0;
  while (isCurrent()) {
    const page = await fetchPage(cursor);
    if (!isCurrent()) return undefined;
    if (!Array.isArray(page)) throw new Error('Invalid message page');
    for (const message of page) messages.set(message.id, message);
    if (page.length < 100) return [...messages.values()];
    const next = Math.max(...page.map(message => Number(message.sequence)));
    if (!Number.isSafeInteger(next) || next <= cursor) throw new Error('Invalid message cursor');
    cursor = next;
  }
  return undefined;
}
