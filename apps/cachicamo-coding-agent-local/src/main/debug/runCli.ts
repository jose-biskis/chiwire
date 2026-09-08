import { runAllDebugFixtures } from "./fixtures.js";

const results = await runAllDebugFixtures();
let failed = 0;
for (const result of results) {
  const mark = result.passed ? "PASS" : "FAIL";
  console.log(`${mark}  ${result.id}  (${result.durationMs}ms)`);
  if (!result.passed) {
    failed += 1;
    if (result.error) console.log(`      error: ${result.error}`);
    console.log(`      expected: ${result.expected}`);
    console.log(`      actual:   ${result.actual}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
if (failed > 0) {
  process.exitCode = 1;
}
