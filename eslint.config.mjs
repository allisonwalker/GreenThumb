import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", "drizzle/**", "next-env.d.ts"]),
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='slice'] > MemberExpression.callee > CallExpression.callee[property.name='toISOString']",
          message:
            "Do not derive calendar dates from UTC ISO strings. Use gardenLocalToday or localDateString from lib/garden/local-date.",
        },
        {
          selector:
            "CallExpression[callee.property.name='substring'] > MemberExpression.callee > CallExpression.callee[property.name='toISOString']",
          message:
            "Do not derive calendar dates from UTC ISO strings. Use gardenLocalToday or localDateString from lib/garden/local-date.",
        },
      ],
    },
  },
]);
