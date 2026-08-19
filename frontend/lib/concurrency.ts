/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once,
 * calling `onItemDone` as each one finishes (not necessarily in order) so
 * callers can update progress incrementally.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;

  async function runner(): Promise<void> {
    while (next < items.length) {
      const current = next++;
      await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, runner);
  await Promise.all(runners);
}
