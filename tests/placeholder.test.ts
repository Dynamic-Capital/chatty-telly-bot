// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest;
if (typeof Deno !== 'undefined') {
  registerTest = Deno.test;
} else {
  const { test } = await import('node:test');
  registerTest = test;
}
registerTest('placeholder', () => {
  // Placeholder test to satisfy both Deno and Node test runners.
});
