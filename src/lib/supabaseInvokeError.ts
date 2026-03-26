/**
 * Parse Supabase Edge Function invoke errors so the UI shows the JSON `error` body
 * instead of the generic "Edge Function returned a non-2xx status code".
 */
export async function getInvokeErrorMessage(response: unknown): Promise<string | null> {
  const error = (response as { error?: { message?: string; context?: unknown } })?.error;
  if (!error) return null;

  const status =
    (error as { context?: { status?: number } }).context?.status ??
    (response as { status?: number }).status;
  const statusSuffix = typeof status === 'number' ? ` (status ${status})` : '';
  const contextBody = (error as { context?: { body?: unknown } }).context?.body;

  const parseBodyText = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
      if (parsed?.error && typeof parsed.error === 'string') return `${parsed.error}${statusSuffix}`;
      if (parsed?.message && typeof parsed.message === 'string') return `${parsed.message}${statusSuffix}`;
      if (typeof parsed === 'string') return `${parsed}${statusSuffix}`;
    } catch {
      return `${trimmed}${statusSuffix}`;
    }
    return null;
  };

  if (contextBody) {
    if (typeof contextBody === 'string') {
      const parsed = parseBodyText(contextBody);
      if (parsed) return parsed;
    } else if (contextBody instanceof Blob) {
      const parsed = parseBodyText(await contextBody.text());
      if (parsed) return parsed;
    } else if (contextBody instanceof ReadableStream) {
      const parsed = parseBodyText(await new Response(contextBody).text());
      if (parsed) return parsed;
    } else if (typeof contextBody === 'object' && contextBody !== null) {
      const bodyObj = contextBody as { error?: string; message?: string };
      if (bodyObj?.error && typeof bodyObj.error === 'string') return `${bodyObj.error}${statusSuffix}`;
      if (bodyObj?.message && typeof bodyObj.message === 'string') return `${bodyObj.message}${statusSuffix}`;
      try {
        return `${JSON.stringify(contextBody)}${statusSuffix}`;
      } catch {
        void 0;
      }
    }
  }

  if (typeof error.message === 'string') return `${error.message}${statusSuffix}`;
  return `Edge Function error${statusSuffix}`;
}
