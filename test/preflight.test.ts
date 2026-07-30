import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const required = [
  "GATEWAY_FIDELITY_GATEWAY_URL",
  "GATEWAY_FIDELITY_KEY",
  "GATEWAY_FIDELITY_ANTHROPIC_BASELINE_URL",
  "GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY",
  "GATEWAY_FIDELITY_ANTHROPIC_MODEL",
  "GATEWAY_FIDELITY_OPENAI_BASELINE_URL",
  "GATEWAY_FIDELITY_OPENAI_BASELINE_KEY",
  "GATEWAY_FIDELITY_OPENAI_MODEL",
];

test("real preflight reports every missing environment variable together", () => {
  const environment = { ...process.env };
  for (const name of required) delete environment[name];
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/preflight.ts", "--real"],
    { encoding: "utf8", env: environment },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1);
  assert.match(output, /Missing required environment variables \(8\)/);
  for (const name of required) assert.match(output, new RegExp(`- ${name}`));
});

test("README and env template document every real-preflight variable", () => {
  const readme = readFileSync("README.md", "utf8");
  const template = readFileSync(".env.example", "utf8");
  for (const name of required) {
    const row = readme.split("\n").find((line) => line.startsWith(`| \`${name}\` |`));
    assert.ok(row, `${name} must have a README configuration row`);
    assert.equal((row.match(/\|/g) ?? []).length, 6, `${name} row must contain all five columns`);
    assert.match(row, /\*\*Required\.\*\*/, `${name} must state whether it is optional`);
    assert.match(row, /https:\/\/[^)]+/, `${name} must include an official documentation link`);
    assert.match(row, /<ol><li>.+<\/li><li>.+<\/li>(?:<li>.+<\/li>)?<\/ol>/, `${name} must include two or three concrete steps`);
    assert.match(template, new RegExp(`^${name}=\\S+`, "m"));
  }
  assert.match(readme, /do not include `\/chat\/completions`/);
  assert.match(readme, /None of these eight variables is optional/);
});
