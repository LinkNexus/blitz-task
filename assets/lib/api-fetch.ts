import { deleteCookie, getCookies } from "./cookies";
import { toFormData } from "./utils";

export type ApiFetchResponse<T> = Response & { data: T };

export interface ApiFetchOptions<S> extends Omit<RequestInit, "body"> {
	data?: S;
	contentType?: "json" | "form-data";
	accept?: "json" | "text";
}

export async function apiFetch<T, S = null>(
	url: string | URL,
	options?: ApiFetchOptions<S>,
	retryAttempt: number = 0,
) {
	options = options ?? {};
	options.contentType ??=
		options.data instanceof FormData ? "form-data" : "json";
	options.accept ??= "json";

	const headers: Record<string, any> = options.headers
		? { ...options.headers }
		: {};
	const xsrfToken = getCookies("XSRF-TOKEN");

	if (
		options.data &&
		!(options.data instanceof FormData) &&
		options.contentType === "json"
	)
		headers["Content-Type"] = "application/json";
	if (options.accept === "json") headers.Accept = "application/json";

	if (
		options.contentType === "form-data" &&
		options.data &&
		!(options.data instanceof FormData)
	) {
		options.data = toFormData(options.data) as S;
	}

	const res = await fetch(url, {
		...options,
		body: options.data
			? options.data instanceof FormData
				? options.data
				: JSON.stringify(options.data)
			: null,
		headers: {
			...headers,
			"X-XSRF-TOKEN": xsrfToken,
			"X-Requested-With": "XMLHttpRequest",
		},
		method: options.method ? options.method : options.data ? "POST" : "GET",
		credentials: "include",
	});

	if (res.status === 419 && retryAttempt < 1) {
		deleteCookie("XSRF-TOKEN");
		await fetch("/api/csrf-token");
		return apiFetch<T, S>(url, options, retryAttempt + 1);
	}

	if (!res.ok)
		throw new ApiError(
			{
				data: options.accept === "json" ? await res.json() : await res.text(),
				...res,
			},
			res.status,
		);

	return {
		data:
			options.accept === "json"
				? ((await res.json()) as T)
				: ((await res.text()) as T),
		...res,
	};
}

export class ApiError<T> extends Error {
	constructor(
		public response: ApiFetchResponse<T>,
		public statusCode: number,
	) {
		super();
		this.name = "ApiError";
	}
}
