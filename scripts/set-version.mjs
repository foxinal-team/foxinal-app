#!/usr/bin/env node
/**
 * Sync app version across package.json, tauri.conf.json, and Cargo.toml.
 *
 *   node scripts/set-version.mjs 0.2.0
 *   node scripts/set-version.mjs --bump patch|minor|major
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver (expected x.y.z): ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function bump(version, kind) {
  const parts = parseSemver(version);
  if (kind === "major") {
    return `${parts.major + 1}.0.0`;
  }
  if (kind === "minor") {
    return `${parts.major}.${parts.minor + 1}.0`;
  }
  if (kind === "patch") {
    return `${parts.major}.${parts.minor}.${parts.patch + 1}`;
  }
  throw new Error(`Unknown bump kind: ${kind}`);
}

function setCargoVersion(path, version) {
  const text = readFileSync(path, "utf8");
  if (!/^version\s*=\s*"[^"]*"/m.test(text)) {
    throw new Error(`Could not find version in ${path}`);
  }
  const updated = text.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${version}"`,
  );
  writeFileSync(path, updated);
}

const arg = process.argv[2];
const bumpKind = process.argv[3];
const packagePath = join(root, "package.json");
const tauriConfPath = join(root, "src-tauri/tauri.conf.json");
const cargoPath = join(root, "src-tauri/Cargo.toml");

const current = readJson(packagePath).version;
let next;

if (arg === "--bump") {
  next = bump(current, bumpKind || "patch");
} else if (arg) {
  next = arg.replace(/^v/, "");
  parseSemver(next);
} else {
  console.error("Usage: set-version.mjs <x.y.z> | --bump patch|minor|major");
  process.exit(1);
}

const pkg = readJson(packagePath);
pkg.version = next;
writeJson(packagePath, pkg);

const tauriConf = readJson(tauriConfPath);
tauriConf.version = next;
writeJson(tauriConfPath, tauriConf);

setCargoVersion(cargoPath, next);

console.log(`version ${current} → ${next}`);
