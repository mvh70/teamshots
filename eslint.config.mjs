import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";

const reactYouMightNotNeedAnEffectPlugin = {
  meta: reactYouMightNotNeedAnEffect.meta,
  rules: reactYouMightNotNeedAnEffect.rules,
};

const reactYouMightNotNeedAnEffectRules = Object.fromEntries(
  Object.keys(reactYouMightNotNeedAnEffect.rules).map((ruleName) => [
    `react-you-might-not-need-an-effect/${ruleName}`,
    "warn",
  ])
);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: {
      "react-you-might-not-need-an-effect": reactYouMightNotNeedAnEffectPlugin,
    },
    rules: reactYouMightNotNeedAnEffectRules,
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "todelete/**",
    ],
  },
];

export default eslintConfig;
