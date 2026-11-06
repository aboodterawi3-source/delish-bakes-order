import fs from "node:fs";
import path from "node:path";

function getAllFiles(dir, exts = [".ts", ".tsx"]) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.some((e) => file.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllFiles(path.resolve("src"));
const graph = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const imports = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const spec = match[1];
    if (spec.startsWith("@/") || spec.startsWith(".")) {
      imports.push(spec);
    }
  }
  graph.set(file, imports);
}

// Simple DFS cycle detector
const visited = new Set();
const recStack = new Set();
const cycles = [];

function resolveImport(fromFile, spec) {
  let target = "";
  if (spec.startsWith("@/")) {
    target = path.resolve("src", spec.slice(2));
  } else {
    target = path.resolve(path.dirname(fromFile), spec);
  }

  const extensions = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
  for (const ext of extensions) {
    if (fs.existsSync(target + ext) && !fs.statSync(target + ext).isDirectory()) {
      return target + ext;
    }
  }
  return null;
}

function findCycle(node, pathStack = []) {
  visited.add(node);
  recStack.add(node);
  pathStack.push(node);

  const rawImports = graph.get(node) || [];
  for (const spec of rawImports) {
    const resolved = resolveImport(node, spec);
    if (!resolved || !graph.has(resolved)) continue;

    if (!visited.has(resolved)) {
      findCycle(resolved, [...pathStack]);
    } else if (recStack.has(resolved)) {
      cycles.push([...pathStack, resolved]);
    }
  }

  recStack.delete(node);
}

for (const file of files) {
  if (!visited.has(file)) {
    findCycle(file);
  }
}

if (cycles.length === 0) {
  console.log(`✅ Circular Dependencies Check: 0 circular dependencies found across ${files.length} modules!`);
} else {
  console.warn(`⚠️ Found ${cycles.length} circular dependencies:`);
  for (const c of cycles) {
    console.warn("  -> " + c.map((p) => path.relative("src", p)).join(" -> "));
  }
}
