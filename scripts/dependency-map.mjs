#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs"
];
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".turbo",
  ".next",
  "coverage",
  "dist",
  "node_modules"
]);

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const graph = buildDependencyGraph();

  if (options.affected) {
    const changedFiles = collectChangedFiles(options);
    const affected = collectAffectedFiles(graph, changedFiles);
    writeOutput(
      {
        changedFiles,
        affectedFiles: affected,
        unmappedChangedFiles: changedFiles.filter((file) => !graph.files[file])
      },
      options.format
    );
    return;
  }

  writeOutput(graph, options.format);
}

function parseArgs(args) {
  const options = {
    affected: false,
    base: undefined,
    changed: [],
    format: "json",
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--affected":
        options.affected = true;
        break;
      case "--base":
        options.base = readOptionValue(args, index, arg);
        index += 1;
        break;
      case "--changed":
        options.changed.push(normalizeRepositoryPath(readOptionValue(args, index, arg)));
        index += 1;
        break;
      case "--format":
        options.format = readOptionValue(args, index, arg);
        index += 1;
        break;
      case "--json":
        options.format = "json";
        break;
      case "--text":
        options.format = "text";
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }

        options.changed.push(normalizeRepositoryPath(arg));
        break;
    }
  }

  if (!["json", "text"].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }

  return options;
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value`);
  }

  return value;
}

function buildDependencyGraph() {
  const sourceFiles = collectSourceFiles(REPOSITORY_ROOT);
  const sourceFileSet = new Set(sourceFiles);
  const workspacePackages = collectWorkspacePackages();
  const graph = {
    version: 1,
    files: {}
  };

  for (const sourceFile of sourceFiles) {
    const relativeFile = toRepositoryPath(sourceFile);
    graph.files[relativeFile] = {
      dependencies: [],
      dependents: []
    };
  }

  for (const sourceFile of sourceFiles) {
    const relativeFile = toRepositoryPath(sourceFile);
    const dependencies = extractModuleSpecifiers(sourceFile)
      .map((specifier) =>
        resolveLocalModule(specifier, sourceFile, sourceFileSet, workspacePackages)
      )
      .filter(Boolean)
      .map(toRepositoryPath);
    const uniqueDependencies = [...new Set(dependencies)].sort();

    graph.files[relativeFile].dependencies = uniqueDependencies;

    for (const dependency of uniqueDependencies) {
      graph.files[dependency] ??= {
        dependencies: [],
        dependents: []
      };
      graph.files[dependency].dependents.push(relativeFile);
    }
  }

  for (const file of Object.keys(graph.files)) {
    graph.files[file].dependencies.sort();
    graph.files[file].dependents = [...new Set(graph.files[file].dependents)].sort();
  }

  return {
    version: graph.version,
    files: Object.fromEntries(
      Object.entries(graph.files).sort(([left], [right]) => left.localeCompare(right))
    )
  };
}

function collectSourceFiles(root) {
  const files = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          visit(path.join(directory, entry.name));
        }

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const filePath = path.join(directory, entry.name);

      if (isSourceFile(filePath)) {
        files.push(filePath);
      }
    }
  }

  visit(root);
  return files.sort((left, right) => toRepositoryPath(left).localeCompare(toRepositoryPath(right)));
}

function isSourceFile(filePath) {
  if (filePath.endsWith(".d.ts")) {
    return false;
  }

  return SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

function extractModuleSpecifiers(filePath) {
  const contents = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath)
  );
  const specifiers = [];

  function addSpecifier(node) {
    if (node && ts.isStringLiteralLike(node)) {
      specifiers.push(node.text);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addSpecifier(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      addSpecifier(node.arguments[0]);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      addSpecifier(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function scriptKindForPath(filePath) {
  switch (path.extname(filePath)) {
    case ".tsx":
    case ".jsx":
      return ts.ScriptKind.TSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function resolveLocalModule(specifier, importerFile, sourceFileSet, workspacePackages) {
  if (specifier.startsWith("node:")) {
    return undefined;
  }

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const candidate = specifier.startsWith("/")
      ? path.resolve(REPOSITORY_ROOT, `.${specifier}`)
      : path.resolve(path.dirname(importerFile), specifier);

    return resolveFilePath(candidate, sourceFileSet);
  }

  const workspacePackage = findWorkspacePackage(specifier, workspacePackages);

  if (!workspacePackage) {
    return undefined;
  }

  if (specifier === workspacePackage.name) {
    return resolvePackageEntrypoint(workspacePackage, sourceFileSet);
  }

  const subpath = specifier.slice(workspacePackage.name.length + 1);
  return resolveFilePath(path.join(workspacePackage.root, subpath), sourceFileSet);
}

function resolveFilePath(candidatePath, sourceFileSet) {
  const normalizedCandidate = path.normalize(candidatePath);

  if (sourceFileSet.has(normalizedCandidate)) {
    return normalizedCandidate;
  }

  const extension = path.extname(normalizedCandidate);

  if (extension) {
    for (const alternateExtension of alternateExtensions(extension)) {
      const alternatePath =
        normalizedCandidate.slice(0, -extension.length) + alternateExtension;

      if (sourceFileSet.has(alternatePath)) {
        return alternatePath;
      }
    }

    return undefined;
  }

  for (const sourceExtension of SOURCE_EXTENSIONS) {
    const filePath = `${normalizedCandidate}${sourceExtension}`;

    if (sourceFileSet.has(filePath)) {
      return filePath;
    }
  }

  for (const sourceExtension of SOURCE_EXTENSIONS) {
    const indexPath = path.join(normalizedCandidate, `index${sourceExtension}`);

    if (sourceFileSet.has(indexPath)) {
      return indexPath;
    }
  }

  return undefined;
}

function alternateExtensions(extension) {
  switch (extension) {
    case ".js":
      return [".ts", ".tsx", ".mts", ".cts"];
    case ".jsx":
      return [".tsx"];
    case ".mjs":
      return [".mts"];
    case ".cjs":
      return [".cts"];
    default:
      return [];
  }
}

function collectWorkspacePackages() {
  const rootPackage = readJsonFile(path.join(REPOSITORY_ROOT, "package.json"));
  const workspacePatterns = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : rootPackage.workspaces?.packages ?? [];
  const packages = [];

  for (const pattern of workspacePatterns) {
    if (!pattern.endsWith("/*")) {
      continue;
    }

    const workspaceRoot = path.join(REPOSITORY_ROOT, pattern.slice(0, -2));

    if (!existsSync(workspaceRoot)) {
      continue;
    }

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageRoot = path.join(workspaceRoot, entry.name);
      const packageJsonPath = path.join(packageRoot, "package.json");

      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = readJsonFile(packageJsonPath);

      if (typeof packageJson.name !== "string") {
        continue;
      }

      packages.push({
        name: packageJson.name,
        root: packageRoot,
        packageJson
      });
    }
  }

  return packages.sort((left, right) => right.name.length - left.name.length);
}

function findWorkspacePackage(specifier, workspacePackages) {
  return workspacePackages.find(
    (workspacePackage) =>
      specifier === workspacePackage.name || specifier.startsWith(`${workspacePackage.name}/`)
  );
}

function resolvePackageEntrypoint(workspacePackage, sourceFileSet) {
  const candidateFields = [
    workspacePackage.packageJson.source,
    workspacePackage.packageJson.types,
    workspacePackage.packageJson.module,
    workspacePackage.packageJson.main
  ].filter((field) => typeof field === "string");

  for (const field of candidateFields) {
    const resolved = resolveFilePath(path.join(workspacePackage.root, field), sourceFileSet);

    if (resolved) {
      return resolved;
    }
  }

  return (
    resolveFilePath(path.join(workspacePackage.root, "src", "index"), sourceFileSet) ??
    resolveFilePath(path.join(workspacePackage.root, "index"), sourceFileSet)
  );
}

function collectChangedFiles(options) {
  const changedFiles = new Set(options.changed);

  if (options.base) {
    for (const file of readGitChangedFiles(options.base)) {
      changedFiles.add(file);
    }
  }

  return [...changedFiles].sort();
}

function readGitChangedFiles(baseRef) {
  const output = execFileSync("git", ["diff", "--name-only", `${baseRef}...HEAD`], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8"
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizeRepositoryPath);
}

function collectAffectedFiles(graph, changedFiles) {
  const affectedFiles = new Set();
  const queue = changedFiles.filter((file) => graph.files[file]);

  for (const file of queue) {
    affectedFiles.add(file);
  }

  while (queue.length > 0) {
    const file = queue.shift();
    const node = graph.files[file];

    for (const dependent of node.dependents) {
      if (!affectedFiles.has(dependent)) {
        affectedFiles.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return [...affectedFiles].sort();
}

function normalizeRepositoryPath(filePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(REPOSITORY_ROOT, filePath);

  return toRepositoryPath(absolutePath);
}

function toRepositoryPath(filePath) {
  return path.relative(REPOSITORY_ROOT, filePath).split(path.sep).join("/");
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeOutput(value, format) {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  if ("affectedFiles" in value) {
    process.stdout.write(`${value.affectedFiles.join("\n")}\n`);
    return;
  }

  for (const [file, node] of Object.entries(value.files)) {
    process.stdout.write(`${file}\n`);

    for (const dependency of node.dependencies) {
      process.stdout.write(`  -> ${dependency}\n`);
    }

    for (const dependent of node.dependents) {
      process.stdout.write(`  <- ${dependent}\n`);
    }
  }
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/dependency-map.mjs [options] [changed-file...]

Build a local source dependency map from static import/export/require calls.

Options:
  --affected          Print changed files plus all transitive dependents.
  --base <git-ref>   Read changed files from git diff --name-only <git-ref>...HEAD.
  --changed <file>   Add a changed file path. Can be provided multiple times.
  --format <format>  Output format: json or text. Defaults to json.
  --json             Shortcut for --format json.
  --text             Shortcut for --format text.
  --help, -h         Show this help message.
`);
}

main();
