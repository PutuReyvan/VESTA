import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "**/artifacts/**",
      "**/cache/**",
      "**/coverage/**",
      "**/typechain-types/**",
      "**/dist/**",
      "**/deployments/**",
      "**/graphify-out/**"
    ]
  },
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser },
    rules: {
      eqeqeq: "error",
      "no-debugger": "error",
      "no-constant-binary-expression": "error"
    }
  }
];
