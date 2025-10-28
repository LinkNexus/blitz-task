import { useCallback } from "react";
import { useAppStore } from "./use-store";
import { apiFetch } from "@/lib/api-fetch";
import type { User } from "@/types";

type AuthStatus = "authenticated" | "unauthenticated" | "unknown";

export function useAuth() {
	const user = useAppStore.use.user();
	const setUser = useAppStore.use.setUser();

	let status: AuthStatus;

	switch (user) {
		case undefined:
			status = "unknown";
			break;
		case null:
			status = "unauthenticated";
			break;
		default:
			status = "authenticated";
			break;
	}

	const authenticate = useCallback(() => {
		fetch("/api/csrf-token").then(() => {
			apiFetch<User>("/api/me")
				.then((res) => setUser(res.data))
				.catch(() => {
					setUser(null);
				});
		});
	}, [setUser]);

	const logout = useCallback(() => {
		fetch("/api/logout")
			.then(() => fetch("/api/csrf-token"))
			.finally(() => setUser(null));
	}, [setUser]);

	return {
		status,
		authenticate,
		logout,
	};
}
