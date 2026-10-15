#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(root, path)}: invalid JSON (${error.message})`);
    return {};
  }
}

function filesUnder(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

function scalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  const value = match[1].trim();
  if (value === ">" || value === "|") {
    const after = frontmatter.slice(match.index + match[0].length);
    const lines = after.match(/^(?:\r?\n[ \t]+[^\r\n]*)+/)?.[0] ?? "";
    return lines.replace(/\r?\n[ \t]+/g, " ").trim();
  }
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

const skillFiles = filesUnder(join(root, "skills")).filter(
  (path) => path.endsWith(`${sep}SKILL.md`),
);

if (skillFiles.length === 0) fail("skills/: no SKILL.md files found");

for (const path of skillFiles) {
  const label = relative(root, path);
  const text = readFileSync(path, "utf8");
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) {
    fail(`${label}: missing closed YAML frontmatter`);
    continue;
  }

  const name = scalar(frontmatter, "name");
  const description = scalar(frontmatter, "description");
  const directory = dirname(path).split(sep).at(-1);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    fail(`${label}: name must be a 1-64 character lowercase kebab-case slug`);
  }
  if (name !== directory) fail(`${label}: name must match parent directory '${directory}'`);
  if (!description || description.length > 1024) {
    fail(`${label}: description must contain 1-1024 characters`);
  }

  const references = [
    ...text.matchAll(/\[[^\]]*\]\((?!https?:|#|mailto:)([^)]+)\)/g),
    ...text.matchAll(/`((?:references|scripts|assets)\/[^`]+)`/g),
  ].map((match) => match[1].split("#", 1)[0]);

  for (const reference of references) {
    const target = resolve(dirname(path), reference);
    if (!target.startsWith(`${dirname(path)}${sep}`) || !existsSync(target)) {
      fail(`${label}: missing or unsafe relative reference '${reference}'`);
    }
  }

  // Update contract: the skill's version is the newest entry in its CHANGELOG.md.
  const skillVersion = frontmatter.match(/^\s+version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1] ?? "";
  const skillChangelogPath = join(dirname(path), "CHANGELOG.md");
  const newest = existsSync(skillChangelogPath)
    ? readFileSync(skillChangelogPath, "utf8").match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1]
    : undefined;
  if (!/^\d+\.\d+\.\d+$/.test(skillVersion)) {
    fail(`${label}: metadata.version "${skillVersion}" is not semver`);
  } else if (newest !== skillVersion) {
    fail(
      `${label}: metadata.version ${skillVersion} must match the newest "## [x.y.z]" entry in ${relative(root, skillChangelogPath)} (found ${newest ?? "none"})`,
    );
  }
}

const manifests = [
  [".claude-plugin/plugin.json", "skills"],
  [".codex-plugin/plugin.json", "skills"],
  ["kimi.plugin.json", "skills"],
];

// One version, declared in .claude-plugin/plugin.json; every other manifest must match it.
const version = String(readJson(join(root, ".claude-plugin/plugin.json")).version ?? "");
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`.claude-plugin/plugin.json: version "${version}" is not semver`);

const marketplace = readJson(join(root, ".claude-plugin/marketplace.json"));
readJson(join(root, "hooks/hooks.json"));
if (marketplace.version !== version) {
  fail(`.claude-plugin/marketplace.json: version ${marketplace.version} must match ${version}`);
}
for (const plugin of marketplace.plugins ?? []) {
  if (plugin.version !== version) {
    fail(`.claude-plugin/marketplace.json: plugins[${plugin.name}].version ${plugin.version} must match ${version}`);
  }
}

const changelogPath = join(root, "CHANGELOG.md");
const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "";
if (!changelog.split("\n").some((line) => line.startsWith(`## [${version}]`))) {
  fail(`CHANGELOG.md: add a "## [${version}] — YYYY-MM-DD" entry for the current version`);
}

for (const [manifestPath, skillsKey] of manifests) {
  const path = join(root, manifestPath);
  if (!existsSync(path)) {
    fail(`${manifestPath}: missing manifest`);
    continue;
  }
  const manifest = readJson(path);
  if (manifest.name !== "wisdom-lens") fail(`${manifestPath}: unexpected plugin name`);
  if (manifest.version !== version) fail(`${manifestPath}: version ${manifest.version} must match ${version}`);
  const skillsPath = resolve(root, manifest[skillsKey] ?? "");
  if (skillsPath !== join(root, "skills") || !existsSync(skillsPath)) {
    fail(`${manifestPath}: skills must resolve to ./skills/`);
  }
}

for (const path of filesUnder(root)) {
  const repoPath = relative(root, path).replaceAll("\\", "/");
  if (repoPath.startsWith(".git/")) continue;
  if (/(^|\/)(MEMORY\.md|USER\.md)$/i.test(repoPath) || /(^|\/)memory\//i.test(repoPath)) {
    fail(`${repoPath}: private agent-memory files must not be packaged`);
  }
}

// Executable repo checks: each script must exit 0. They run here so that
// `node scripts/validate.mjs` (and the CI step that calls it) covers them.
const checkScripts = [
  ["scripts/trigger-test.mjs", []],
  ["scripts/tripwire-check.mjs", ["--self-test"]],
  ["scripts/skill-eval.mjs", []],
  ["scripts/token-audit.mjs", []],
];
for (const [script, args] of checkScripts) {
  const result = spawnSync(execPath, [join(root, script), ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${script}: executable check failed (exit ${result.status})\n${result.stdout}${result.stderr}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${skillFiles.length} skills, ${manifests.length} package manifests, 2 supporting JSON files, and relative references.`,
);
