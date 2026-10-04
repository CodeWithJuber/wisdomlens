#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { assessDecision, buildDecisionRequest, createJevAdapter, JevError } from "./jev-adapter.mjs";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node jev-decide.mjs --input <file.json|-> [--dry-run]\nLive calls use TYPESAFE_API_KEY and optional JEV_MODEL. Results are recommendations, never executed actions.");
  process.exit(0);
}

try {
  const dryRun = args.includes("--dry-run");
  const inputIndex = args.indexOf("--input");
  const filename = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const remaining = args.filter((_arg, index) => index !== inputIndex && index !== inputIndex + 1);
  if (!filename || filename.startsWith("--") || remaining.some((arg) => arg !== "--dry-run")) {
    throw new JevError("invalid_request", "Use --input <file.json|-> and optional --dry-run.");
  }
  let contents;
  try { contents = filename === "-" ? readFileSync(0, "utf8") : await readFile(filename, "utf8"); } catch {
    throw new JevError("input_error", "Could not read the decision input.");
  }
  let input;
  try { input = JSON.parse(contents); } catch {
    throw new JevError("invalid_request", "Decision input must be valid JSON.");
  }
  const result = dryRun
    ? { dryRun: true, request: { model: process.env.JEV_MODEL || "jev-1.13.0", ...buildDecisionRequest(input) } }
    : await assessDecision(input, createJevAdapter());
  console.log(JSON.stringify(result, null, 2));
  if (!dryRun && result.status !== "recommend") process.exitCode = 2;
} catch (error) {
  // Do not print arbitrary exception messages, request state, headers, or keys.
  const safe = error instanceof JevError ? error : new JevError("adapter_error", "Decision assessment failed; no recommendation was returned.");
  console.error(JSON.stringify({ status: "error", code: safe.code, message: safe.message }));
  process.exitCode = 1;
}
