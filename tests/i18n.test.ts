import { t } from "../src/i18n/index.ts";
import { setTemplate } from "../src/templates/lib.ts";

function assertEquals(a: unknown, b: unknown) {
  if (a !== b) throw new Error(`Assertion failed: ${a} !== ${b}`);
}

Deno.test("template override reflects in translation", () => {
  setTemplate("hi", "welcome.body", "नमस्ते");
  assertEquals(t("welcome.body", "hi"), "नमस्ते");
});

Deno.test("fallback to english when key missing", () => {
  const en = t("help.body", "en");
  assertEquals(t("help.body", "hi"), en);
});
