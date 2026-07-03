import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["coverage/", "dist/"],
	},
	eslint.configs.recommended,
	{
		files: ["**/*.ts"],
		extends: [...tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ["src/math/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{ patterns: ["../app/**", "../ui/**", "../infrastructure/**"] },
			],
		},
	},
	{
		files: ["src/app/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						"../ui/**",
						"../infrastructure/**",
						"../rendering/**",
					],
				},
			],
		},
	},
	{
		files: ["src/ui/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						"../infrastructure/**",
						"../../infrastructure/**",
					],
				},
			],
		},
	},
	{
		files: ["src/infrastructure/**/*.ts"],
		rules: {
			"no-restricted-imports": ["error", { patterns: ["../ui/**"] }],
		},
	},
	{
		files: ["src/**/*.test.ts"],
		rules: {
			"no-restricted-imports": "off",
		},
	},
	{
		files: ["public/sw.js"],
		languageOptions: {
			globals: globals.serviceworker,
		},
	},
	{
		files: ["scripts/*.mjs"],
		languageOptions: {
			globals: globals.node,
		},
	},
	prettier,
);
