import { type ApiFetchOptions, ApiError, apiFetch } from "@/lib/api-fetch";
import { useCallback, useState } from "react";

interface UseApiFetchOptions<T, S> extends ApiFetchOptions {
  onError?: (err: ApiError<S>) => void;
  onSuccess?: (data: T) => void;
  onEnd?: () => void;
  // retryCount?: number;
  // timeout?: number;
}

export function useApiFetch<T, S>(
  url: string | URL,
  options: UseApiFetchOptions<T, S> = {
    contentType: "json",
    accept: "json",
  },
  deps: any[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError<S> | null>(null);
  const [pending, setPending] = useState(false);

  const { onError, onSuccess, onEnd, ...restOptions } = options;

  const callback = useCallback(
    async function (
      params: {
        data?: ApiFetchOptions["data"];
        searchParams?: Record<string, (string | number) | (string | number)[]>;
      } = {
        data: options.data,
        searchParams: {},
      },
    ) {
      if (pending) return;

      const { data, searchParams } = params;

      setPending(true);
      setError(null);

      if (!(url instanceof URL)) url = new URL(url, window.location.origin);

      if (searchParams && Object.keys(searchParams).length > 0) {
        const urlSearchParams = new URLSearchParams();

        for (const [key, values] of Object.entries(searchParams)) {
          if (Array.isArray(values))
            values.forEach((v) => urlSearchParams.append(key, String(v)));
          else urlSearchParams.append(key, String(values));
        }
        url.search = urlSearchParams.toString();
      }

      try {
        const res = await apiFetch<T>(url, {
          ...restOptions,
          data,
        });

        setData(res);
        onSuccess?.(res);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err);
          onError?.(err);
        } else {
          console.error("Unexpected error:", err);
          throw err;
        }
      } finally {
        setPending(false);
        options.onEnd?.();
      }
    },
    [url, pending, ...deps],
  );

  return {
    data,
    error,
    pending,
    callback,
  };
}
