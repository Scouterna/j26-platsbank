export function withLogging<T>(name: string, fn: () => Promise<T>): Promise<T> {
	return fn().catch((err: unknown) => {
		if (!(err instanceof Response)) {
			console.error(`[server] ${name}:`, err);
		}
		throw err;
	});
}
