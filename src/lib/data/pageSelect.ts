/** PostgREST's max-rows cap. A `.limit()` above this can come back short with no error. */
export const POSTGREST_PAGE = 1000;

/**
 * Read every matching row by `.range()`, one page at a time.
 * A failed page stops the walk and returns the error. Callers must not
 * treat a short page as the full set.
 */
export async function collectInPages<T>(
  load: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += POSTGREST_PAGE) {
    const { data, error } = await load(from, from + POSTGREST_PAGE - 1);
    if (error) return { rows, error: error.message };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < POSTGREST_PAGE) return { rows, error: null };
  }
}
