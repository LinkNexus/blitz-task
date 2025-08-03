import {ApiError, apiFetch, type ApiFetchOptions} from "@/lib/fetch";
import {useCallback, useState} from "react";

interface UseApiFetchOptions<T, S> extends ApiFetchOptions {
  onError?: (error: ApiError<S>) => void;
  onSuccess?: (data: T) => void | Promise<void>;
  finally?: () => void;
}

export function useApiFetch<T, S>(
  url: string | URL,
  options: UseApiFetchOptions<T, S> = {
    contentType: "json",
    accept: "json",
  },
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError<S> | null>(null);
  const [pending, setPending] = useState<boolean>(false);
  const { onError, onSuccess, ...restOptions } = options;

  const fetchData = useCallback(
    async (params: {
      data?: ApiFetchOptions["data"];
      searchParams?: Record<string, (string|number)|(string | number)[]>;
    } = {
      data: options.data,
      searchParams: {}
    }) => {
      if (pending) return Promise.resolve(); // Prevent multiple concurrent requests
      const { data, searchParams } = params;

      setPending(true);
      setError(null);

      if (!(url instanceof URL)) {
        url = new URL(url, window.location.origin);
      }

      // Append search parameters to the URL
      if (searchParams && Object.keys(searchParams).length > 0) {
        const urlSearchParams = new URLSearchParams();
        for (const [key, values] of Object.entries(searchParams)) {
          if (Array.isArray(values)) {
            values.forEach(value => urlSearchParams.append(key, String(value)));
          } else {
            urlSearchParams.set(key, String(values));
          }
        }
        url.search = urlSearchParams.toString();
      }

      try {
        const res = await apiFetch<T>(url, {
          ...restOptions,
          data,
        });
        setData(res);
        await onSuccess?.(res);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err);
          onError?.(err);
        } else {
          console.error("Unexpected error:", err);
          throw err; // Re-throw unexpected errors
        }
      } finally {
        setPending(false);
        options.finally?.();
      }
    },
    [url, pending, ...deps]
  );

  return {
    data, error,
    pending,
    callback: fetchData
  };
}
