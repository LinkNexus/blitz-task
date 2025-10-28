import { useCallback, useMemo, useState } from "react";
import {
	ApiError,
	type ApiFetchOptions,
	type ApiFetchResponse,
	apiFetch,
} from "@/lib/api-fetch";

interface UseApiFetchOptions<T, S, U> extends ApiFetchOptions<U> {
	onError?: (err: ApiError<S>) => void;
	onSuccess?: (response: ApiFetchResponse<T>) => void;
	onEnd?: () => void;
}

export function useApiFetch<T, S = null, U = never>({
	url,
	options,
	deps = [],
}: {
	url: string | URL;
	options?: UseApiFetchOptions<T, S, U>;
	deps?: any[];
}) {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<ApiError<S> | null>(null);
	const [pending, setPending] = useState(false);

	options = options || {};

	const action = useCallback(
		async (
			params: {
				data?: ApiFetchOptions<U>["data"];
				searchParams?: Record<string, (string | number) | (string | number)[]>;
			} = {
				data: options.data,
				searchParams: {},
			},
		) => {
			const { data, searchParams } = params;

			setPending(true);
			setError(null);

			if (!(url instanceof URL)) url = new URL(url, window.location.origin);

			if (searchParams && Object.keys(searchParams).length > 0) {
				const urlSearchParams = new URLSearchParams();

				for (const [key, values] of Object.entries(searchParams)) {
					if (Array.isArray(values))
						values.forEach((v) => {
							urlSearchParams.append(key, String(v));
						});
					else urlSearchParams.append(key, String(values));
				}
				url.search = urlSearchParams.toString();
			}

			try {
				const res = await apiFetch<T, U>(url, {
					...options,
					data,
				});

				setData(res.data);
				options?.onSuccess?.(res);
			} catch (err) {
				if (err instanceof ApiError) {
					setError(err);
					options?.onError?.(err);
				} else {
					console.error("Unexpected error:", err);
					throw err;
				}
			} finally {
				setPending(false);
				options.onEnd?.();
			}
		},
		[url, options, ...deps],
	);

	return {
		data,
		error,
		pending,
		action,
	};
}
