export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  data?: Record<string, any> | FormData | null;
  contentType?: "json" | "form-data";
  accept?: "json" | "text";
}

export async function apiFetch<T>(
  url: string | URL,
  options: ApiFetchOptions = {
    data: null,
    contentType: "json",
    accept: "json",
  }
) {
  const {data = null, contentType = "json", accept = "json"} = options;
  let headers: Record<string, string> = {};

  if (data && !(data instanceof FormData) && contentType === "json")
    headers["Content-Type"] = "application/json";
  if (accept === "json") headers["Accept"] = "application/json";

  const response = await fetch(url, {
    ...options,
    body: data
      ? data instanceof FormData
        ? data
        : JSON.stringify(data)
      : null,
    headers: {
      ...headers,
      ...options.headers,
    },
    method: options.method ?? options.data ? "POST" : "GET",
  });

  if (!response.ok) {
    throw new ApiError(await response.json(), response.status);
  }

  if (response.status === 204) {
    return null as unknown as T; // No content response
  }

  return accept === "json"
    ? ((await response.json()) as T)
    : ((await response.text()) as T);
}

export class ApiError<T> extends Error {
  public data: T;
  public statusCode: number;

  constructor(
    data: T,
    statusCode: number
  ) {
    super();
    this.name = "ApiError";
    this.data = data;
    this.statusCode = statusCode;
  }
}
