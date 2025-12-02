function getCookies(key: string | null = null) {
	const cookies = Object.fromEntries(
		document.cookie
			.split("; ")
			.map((c) => c.split("=").map(decodeURIComponent)),
	);

	return key ? cookies[key] : cookies;
}

function deleteCookie(name: string) {
	document.cookie = `${name}=; Max-Age=0; path=/;`;
	document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname};`;
}

export { getCookies, deleteCookie };
