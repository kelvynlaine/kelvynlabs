import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      ".data/**",
      "drizzle/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      /*
       * Convention du projet : un identifiant préfixé par `_` est
       * intentionnellement inutilisé. Le cas courant ici est le retrait d'une
       * clé par déstructuration (`const { lecon: _lecon, ...reste } = ligne`),
       * qui est la façon la plus lisible d'exclure un champ d'un objet.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
