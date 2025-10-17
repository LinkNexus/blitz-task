export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  data?: Record<string, any> | Record<string, any>[] | FormData | null;
  contentType?: "json" | "form-data";
  accept?: "json" | "text";
}

function getCookies(key: string | null = null) {
  const cookies = Object.fromEntries(
    document.cookie
      .split("; ")
      .map((c) => c.split("=").map(decodeURIComponent)),
  );

  return key ? cookies[key] : cookies;
}

export async function apiFetch<T>(
  url: string | URL,
  options: ApiFetchOptions = {
    data: null,
    contentType: "json",
    accept: "json",
  },
) {
  options.contentType ??= "json";
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
  if (options.accept === "json") headers["Accept"] = "application/json";

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

  if (!res.ok) throw new ApiError(await res.json(), res.status);

  if (res.status === 204) return null as unknown as T;

  return options.accept === "json"
    ? ((await res.json()) as T)
    : ((await res.text()) as T);
}

export class ApiError<T> extends Error {
  constructor(
    public data: T,
    public statusCode: number,
  ) {
    super();
    this.name = "ApiError";
  }
}
