import { existsSync } from "node:fs";

if (!existsSync(".env.development")) {
	console.warn(
		"Warning: .env.development was not found. Copy .env.example to .env.development unless you know what you're doing.",
	);
}
