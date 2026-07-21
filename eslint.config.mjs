import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Capacitor tarafından üretilen Android projesi ve oraya kopyalanan
    // küçültülmüş web varlıkları. ESLint .gitignore'u okumaz, bu yüzden
    // burada ayrıca dışlanmaları gerekir.
    "android/**",
  ]),
]);

export default eslintConfig;
