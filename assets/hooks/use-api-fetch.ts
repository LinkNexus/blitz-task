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

export type UseApiFetchActionParams<U> = {
	data?: ApiFetchOptions<U>["data"];
	searchParams?: Record<
		string,
		| (string | number | boolean | object | null | undefined)
		| (string | number | object | boolean)[]
	>;
	params?: Record<string, string | number | boolean>;
};

export type UseApiFetchAction<U> = (
	params?: UseApiFetchActionParams<U>,
) => Promise<void>;

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

	const action: UseApiFetchAction<U> = useCallback(
		async (
			params = {
				data: options.data,
				searchParams: {},
				params: {},
			},
		) => {
			const { data, params: routeParams } = params;
			let searchParams = params.searchParams;

			setPending(true);
			setError(null);

			if (!(url instanceof URL)) url = new URL(url, window.location.origin);

			if (routeParams && Object.keys(routeParams).length > 0) {
				let path = url.pathname;
				for (const [key, value] of Object.entries(routeParams)) {
					const token = `:${key}`;
					if (path.includes(token)) {
						path = path.replaceAll(token, encodeURIComponent(String(value)));
					} else {
						if (!searchParams) searchParams = {};

						if (!(key in searchParams)) searchParams[key] = value;
					}
				}
				url.pathname = path;
			}

			if (searchParams && Object.keys(searchParams).length > 0) {
				const urlSearchParams = new URLSearchParams();

				for (const [key, values] of Object.entries(searchParams)) {
					if (typeof values !== "boolean" && !values) continue;
					if (Array.isArray(values))
						values.forEach((v) => {
							if (typeof v === "object") {
								urlSearchParams.append(key, JSON.stringify(v));
							} else urlSearchParams.append(key, String(v));
						});
					else {
						if (typeof values === "object") {
							urlSearchParams.append(key, JSON.stringify(values));
						} else urlSearchParams.append(key, String(values));
					}
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
