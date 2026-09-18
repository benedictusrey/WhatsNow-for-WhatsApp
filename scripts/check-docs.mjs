// WhatsNow is authored and maintained solely by @benedictusrey.
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  "backup",
  "dist",
  "node_modules",
  "target",
  "versions",
]);
const encodingArtifacts = ["\uFFFD", "â€”", "â†’", "Â", "ï¿½"];

async function collectMarkdown(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...await collectMarkdown(path.join(directory, entry.name)));
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function localTargets(markdown) {
  const targets = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
    targets.push(match[1]);
  }
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
    targets.push(match[1]);
  }
  return targets;
}

function normalizeTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().replace(/^<|>$/g, "").split(/\s+"/, 1)[0];
  return decodeURIComponent(withoutTitle.split("#", 1)[0]);
}

const markdownFiles = await collectMarkdown(repositoryRoot);
const failures = [];

for (const file of markdownFiles) {
  const relativeFile = path.relative(repositoryRoot, file);
  const markdown = await readFile(file, "utf8");

  if (!markdown.includes("benedictusrey")) {
    failures.push(`${relativeFile}: missing @benedictusrey authorship`);
  }
  for (const artifact of encodingArtifacts) {
    if (markdown.includes(artifact)) {
      failures.push(`${relativeFile}: contains encoding artifact ${JSON.stringify(artifact)}`);
    }
  }
  if (/C:\\Users\\|\/Users\/[^/]+\//.test(markdown)) {
    failures.push(`${relativeFile}: contains a private absolute user path`);
  }

  for (const rawTarget of localTargets(markdown)) {
    if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const target = normalizeTarget(rawTarget);
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    try {
      await stat(resolved);
    } catch {
      failures.push(`${relativeFile}: missing local link target ${rawTarget}`);
    }
  }
}

assert.deepEqual(failures, [], failures.join("\n"));
console.log(`documentation checks passed (${markdownFiles.length} Markdown files)`);

