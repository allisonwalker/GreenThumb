export const DATABASE_UNAVAILABLE_MESSAGE =
  "The garden database is unavailable right now. Wait a minute and try again. If this keeps happening, the Supabase project may be paused or DATABASE_URL on Vercel may be wrong.";

export async function retryPing(
  ping: () => Promise<void>,
  options: { attempts?: number; delayMs?: number } = {},
) {
  const attempts = options.attempts ?? 2;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await ping();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * (attempt + 1)),
        );
      }
    }
  }

  throw lastError;
}
