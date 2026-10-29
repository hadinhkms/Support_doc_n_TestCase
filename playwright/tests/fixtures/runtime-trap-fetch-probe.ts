import type { Page } from '@playwright/test';

export function attachFetchFailureProbe(
  page: Page,
  onFetchFailure: (url: string, method: string, errorText: string) => void,
): void {
  void page
    .exposeBinding(
      '__runtimeTrapReportFetchFailure',
      (_source, payload: { url: string; method: string; errorText: string }) => {
        if (payload && typeof payload.url === 'string') {
          onFetchFailure(
            payload.url,
            payload.method || 'GET',
            payload.errorText || 'Failed to fetch',
          );
        }
      },
    )
    .catch(() => {});

  void page
    .addInitScript(() => {
      const w = window as unknown as {
        __runtimeTrapFetchPatched?: boolean;
        __runtimeTrapReportFetchFailure?: (p: {
          url: string;
          method: string;
          errorText: string;
        }) => Promise<void>;
      };
      if (w.__runtimeTrapFetchPatched || typeof window.fetch !== 'function') return;
      w.__runtimeTrapFetchPatched = true;
      const origFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        try {
          return await origFetch(input, init);
        } catch (err) {
          const rawUrl =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input?.url || '';
          const resolvedUrl = new URL(rawUrl, window.location.href).href;
          const method =
            init?.method || (input instanceof Request ? input.method : undefined) || 'GET';
          if (typeof w.__runtimeTrapReportFetchFailure === 'function') {
            await w
              .__runtimeTrapReportFetchFailure({
                url: resolvedUrl,
                method,
                errorText: err instanceof Error ? err.message : String(err),
              })
              .catch(() => {});
          }
          throw err;
        }
      };
    })
    .catch(() => {});
}

