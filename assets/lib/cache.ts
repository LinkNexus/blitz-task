import type { ApiFetchResponse, HttpMethod } from "./api-fetch";

type CacheEntry<T> = {
	expireAt: number;
	response: ApiFetchResponse<T>;
};

export class Cache {
	private static instance: Cache;
	public static getInstance(): Cache {
		if (!Cache.instance) Cache.instance = new Cache();
		return Cache.instance;
	}

	public readonly store: Map<string, CacheEntry<any>>;

	public constructor() {
		this.store = new Map<string, CacheEntry<any>>();
	}

	public static getKey(url: string, method: HttpMethod): string {
		return `${method.toLowerCase()}:${url.toLowerCase()}`;
	}

	public get<T>(url: string, method: HttpMethod) {
		const key = Cache.getKey(url, method);
		const entry = this.store.get(key);

		if (entry) {
			if (entry.expireAt >= Date.now()) {
				return entry.response as ApiFetchResponse<T>;
			} else {
				this.store.delete(key);
				return undefined;
			}
		}

		return undefined;
	}

	public set<T>(
		url: string,
		method: HttpMethod,
		response: ApiFetchResponse<T>,
		invalidationTime: false | number,
	): void {
		const key = Cache.getKey(url, method);
		this.store.set(key, {
			expireAt: Date.now() + (invalidationTime || 0),
			response,
		});
	}

	public invalidate(url: string, method: HttpMethod): void {
		const key = Cache.getKey(url, method);

		if (this.store.has(key)) {
			this.store.delete(key);
		}
	}
}
