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
      ".next*/**",
      "chrome-extension/dist/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "todelete/**",
    ],
  },
  {
    files: [
      "**/*.cjs",
      "**/webpack.config.js",
      "improved_sequence.js",
      "scripts/**/*.js",
      "scripts/**/*.cjs",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: [
      "tests/**/*.{ts,tsx,js,jsx}",
      "scripts/**/*.{ts,tsx,js,cjs}",
      "messages/scripts/**/*.{ts,tsx,js,cjs}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/app/**/landings/PortreyaLandingV2.tsx",
      "src/app/**/landings/RightClickFitLanding.tsx",
      "src/app/api/styles/save/route.ts",
      "src/components/generation/selection/SelectableGrid.tsx",
      "src/domain/style/elements/clothing/overlay-element.ts",
      "src/domain/style/elements/preset/PresetSelector.tsx",
      "src/queue/workers/generate-image/gemini-replicate.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
