import { spawnSync } from "node:child_process";

process.env.NITRO_PRESET = "node-server";
const res = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(res.status ?? 0);
