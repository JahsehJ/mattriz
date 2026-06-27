import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["coverage/", "dist/"]
	},
	eslint.configs.recommended,
	{
		files: ["**/*.ts"],
		extends: [...tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		}
	},
	{
		files: ["public/sw.js"],
		languageOptions: {
			globals: globals.serviceworker
		}
	},
	prettier
);
