#!/usr/bin/env node
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AVAILABLE_DEMOS = JSON.parse(
  readFileSync(join(__dirname, "../dist/demo-names.json"), "utf-8")
);

const name = process.argv[2];

if (!name || name === "--help" || name === "-h") {
  console.log("Usage: gridland-demo <demo-name>\n");
  console.log("Available demos:");
  for (const d of AVAILABLE_DEMOS) {
    console.log(`  ${d}`);
  }
  console.log("\nExamples:");
  console.log("  bunx @gridland/demo ascii");
  console.log("  bunx @gridland/demo gradient");
  process.exit(name ? 0 : 1);
}

if (!AVAILABLE_DEMOS.includes(name)) {
  console.error(`Unknown demo: "${name}"`);
  console.error(`Available: ${AVAILABLE_DEMOS.join(", ")}`);
  process.exit(1);
}

// @opentui/core uses bun:ffi for the native terminal renderer, so we must run under bun
let hasBun = false;
try {
  execSync("bun --version", { stdio: "ignore" });
  hasBun = true;
} catch {}

if (!hasBun) {
  console.error("Error: bun is required to run gridland demos.");
  console.error("Install it with: curl -fsSL https://bun.sh/install | bash");
  console.error("\nThen run: bunx @gridland/demo " + name);
  process.exit(1);
}

const runPath = join(__dirname, "../dist/run.js");
const tmpDir = mkdtempSync(join(tmpdir(), "gridland-demo-"));
const scriptPath = join(tmpDir, "run.mjs");
writeFileSync(scriptPath, `import { runDemo } from "${runPath}";\nrunDemo("${name}");\n`);
const { status } = spawnSync("bun", [scriptPath], {
  stdio: "inherit",
});
rmSync(tmpDir, { recursive: true, force: true });
process.exit(status ?? 1);
