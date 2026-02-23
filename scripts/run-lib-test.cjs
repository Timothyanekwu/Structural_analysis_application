const { spawnSync } = require("node:child_process");

const testPath = process.argv[2];
if (!testPath) {
  console.error("Missing test path. Usage: node scripts/run-lib-test.cjs <path>");
  process.exit(1);
}

const env = {
  ...process.env,
  TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: "commonjs" }),
};

const result = spawnSync("npx", ["ts-node", testPath], {
  stdio: "inherit",
  env,
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
