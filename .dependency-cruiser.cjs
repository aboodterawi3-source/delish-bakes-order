/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "not-to-unresolvable",
      comment: "Modules must resolve to existing files or external packages.",
      severity: "error",
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: "no-deprecated-core",
      comment: "Warn when a module uses a deprecated Node.js core module.",
      severity: "warn",
      from: {},
      to: {
        dependencyTypes: ["core"],
        path: ["^(?:punycode|constants|domain)$"],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "\\.output", "dist"],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "./tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
