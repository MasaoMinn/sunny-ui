#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawArgs = process.argv.slice(2);
const command = rawArgs[0];

const registry = loadRegistry();
const cwd = process.cwd();

if (!command || command === "help" || command === "-h" || command === "--help") {
  printUsage();
  process.exit(0);
}

if (command === "list") {
  printList();
  process.exit(0);
}

if (command !== "add") {
  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

await runAdd(rawArgs.slice(1));

async function runAdd(args) {
  const yes = args.includes("-y") || args.includes("--yes");
  const ids = args.filter((item) => item !== "-y" && item !== "--yes");

  if (ids.length === 0) {
    console.error("Please provide at least one component name.");
    printUsage();
    process.exit(1);
  }

  const packageJson = readPackageJson(cwd);
  const installedDependencyNames = getInstalledDependencyNames(packageJson);
  const operations = [];

  for (const id of ids) {
    const { route, name } = parseComponentId(id);
    const routeConfig = registry.routes[route];
    if (!routeConfig) {
      console.error(`Unknown route "${route}".`);
      console.error(`Available routes: ${Object.keys(registry.routes).join(", ")}`);
      process.exit(1);
    }

    const component = registry.components.find(
      (item) => item.route === route && item.name === name,
    );

    if (!component) {
      console.error(`Component "${id}" not found.`);
      console.error(`Run "sunny list" to view all available components.`);
      process.exit(1);
    }

    const sourcePath = path.resolve(__dirname, "..", component.source);
    if (!existsSync(sourcePath)) {
      console.error(`Source file is missing: ${component.source}`);
      process.exit(1);
    }

    const targetPath = path.resolve(cwd, routeConfig.outputDir, component.target);
    const dependencies = Array.from(
      new Set([...(routeConfig.dependencies ?? []), ...(component.dependencies ?? [])]),
    );

    operations.push({
      id,
      sourcePath,
      targetPath,
      dependencies,
    });
  }

  const missingDependencies = collectMissingDependencies(
    operations.flatMap((item) => item.dependencies),
    installedDependencyNames,
  );

  if (missingDependencies.length > 0) {
    console.log("These dependencies are required by the selected components:");
    for (const dependency of missingDependencies) {
      console.log(`  - ${dependency}`);
    }

    const confirmed = yes
      ? true
      : await confirm("Install these dependencies now?");
    if (!confirmed) {
      console.log("Cancelled. No dependency was installed.");
      process.exit(0);
    }

    const packageManager = detectPackageManager(cwd);
    const installResult = installDependencies(packageManager, missingDependencies, cwd);
    if (!installResult) {
      console.error("Dependency installation failed.");
      process.exit(1);
    }
  }

  let addedCount = 0;
  for (const operation of operations) {
    mkdirSync(path.dirname(operation.targetPath), { recursive: true });

    if (existsSync(operation.targetPath) && !yes) {
      const overwrite = await confirm(
        `File "${path.relative(cwd, operation.targetPath)}" exists. Overwrite?`,
      );
      if (!overwrite) {
        console.log(`Skipped ${operation.id}`);
        continue;
      }
    }

    copyFileSync(operation.sourcePath, operation.targetPath);
    console.log(`Added ${operation.id} -> ${path.relative(cwd, operation.targetPath)}`);
    addedCount += 1;
  }

  if (addedCount === 0) {
    console.log("No files were added.");
    return;
  }

  console.log(`Done. Added ${addedCount} component(s).`);
}

function loadRegistry() {
  const registryPath = path.resolve(__dirname, "..", "registry", "registry.json");
  const content = readFileSync(registryPath, "utf8");
  return JSON.parse(content);
}

function parseComponentId(rawId) {
  const id = rawId.trim().replace(/^\/+|\/+$/g, "");
  if (!id) {
    throw new Error("Component id is empty.");
  }

  const parts = id.split("/");
  if (parts.length === 1) {
    return { route: "core", name: parts[0] };
  }

  return {
    route: parts[0],
    name: parts.slice(1).join("/"),
  };
}

function readPackageJson(rootPath) {
  const packagePath = path.join(rootPath, "package.json");
  if (!existsSync(packagePath)) {
    return null;
  }

  const content = readFileSync(packagePath, "utf8");
  return JSON.parse(content);
}

function getInstalledDependencyNames(packageJson) {
  if (!packageJson) {
    return new Set();
  }

  const all = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
  };

  return new Set(Object.keys(all));
}

function collectMissingDependencies(requiredDependencies, installedDependencyNames) {
  const missing = [];
  const seen = new Set();

  for (const dependency of requiredDependencies) {
    const normalized = dependency.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const name = dependencyName(normalized);
    if (!installedDependencyNames.has(name)) {
      missing.push(normalized);
    }
  }

  return missing;
}

function dependencyName(dependencySpec) {
  if (dependencySpec.startsWith("@")) {
    const secondAt = dependencySpec.indexOf("@", 1);
    return secondAt === -1 ? dependencySpec : dependencySpec.slice(0, secondAt);
  }

  const firstAt = dependencySpec.indexOf("@");
  return firstAt === -1 ? dependencySpec : dependencySpec.slice(0, firstAt);
}

function detectPackageManager(rootPath) {
  if (existsSync(path.join(rootPath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (existsSync(path.join(rootPath, "yarn.lock"))) {
    return "yarn";
  }

  if (
    existsSync(path.join(rootPath, "bun.lockb")) ||
    existsSync(path.join(rootPath, "bun.lock"))
  ) {
    return "bun";
  }

  return "npm";
}

function installDependencies(packageManager, dependencies, rootPath) {
  const argsByManager = {
    pnpm: ["add", ...dependencies],
    npm: ["install", ...dependencies],
    yarn: ["add", ...dependencies],
    bun: ["add", ...dependencies],
  };

  const args = argsByManager[packageManager];
  if (!args) {
    throw new Error(`Unsupported package manager: ${packageManager}`);
  }

  const result = spawnSync(packageManager, args, {
    cwd: rootPath,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    return false;
  }

  return result.status === 0;
}

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${question} (y/N) `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function printList() {
  const grouped = new Map();
  for (const component of registry.components) {
    if (!grouped.has(component.route)) {
      grouped.set(component.route, []);
    }
    grouped.get(component.route).push(component);
  }

  for (const [route, components] of grouped) {
    console.log(`[${route}]`);
    for (const component of components) {
      const routePrefix = route === "core" ? "" : `${route}/`;
      console.log(`  - ${routePrefix}${component.name}`);
    }
  }
}

function printUsage() {
  console.log("sunny - component installer");
  console.log("");
  console.log("Usage:");
  console.log("  sunny list");
  console.log("  sunny add <component-name>");
  console.log("  sunny add matter/<component-name>");
  console.log("  sunny add <component> [more...] [-y|--yes]");
}
