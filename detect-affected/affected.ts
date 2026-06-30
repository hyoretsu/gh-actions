#!/usr/bin/env bun
// Built-in, Turbo-free affected-packages resolver. Used when the consumer repo
// has no custom resolver script. Detects workspace packages from the root
// package.json `workspaces`, finds which ones changed since BASE_SHA via git,
// then keeps only those that actually declare each requested task as a script.
// Emits {"<task>":["pkg",...]} so a package without the script (or a task no
// package has) yields an empty list — and the downstream matrix job is skipped.
import { Glob } from "bun";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const root = process.cwd();
const baseSha = (process.env.BASE_SHA ?? "").trim();
const tasks = (process.env.TASKS ?? "").trim().split(/\s+/).filter(Boolean);

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const rootPkgPath = resolve(root, "package.json");
const rootPkg = existsSync(rootPkgPath) ? readJson(rootPkgPath) : {};

const ws = rootPkg.workspaces;
const patterns: string[] = Array.isArray(ws) ? ws : Array.isArray(ws?.packages) ? ws.packages : [];

type Pkg = { name: string; relDir: string; scripts: Record<string, string> };
const packages: Pkg[] = [];
const seen = new Set<string>();

const addPkg = (dir: string) => {
	const relDir = relative(root, dir);
	const pkgPath = resolve(dir, "package.json");
	if (seen.has(relDir) || !existsSync(pkgPath)) return;
	seen.add(relDir);
	const json = readJson(pkgPath);
	if (json.name) packages.push({ name: json.name, relDir, scripts: json.scripts ?? {} });
};

for (const pattern of patterns) {
	for (const match of new Glob(`${pattern}/package.json`).scanSync({ cwd: root, onlyFiles: true })) {
		addPkg(resolve(root, dirname(match)));
	}
}
// No workspaces declared: treat the repo root as a single package.
if (packages.length === 0 && rootPkg.name) {
	packages.push({ name: rootPkg.name, relDir: "", scripts: rootPkg.scripts ?? {} });
}

const allNames = new Set(packages.map((p) => p.name));

// Deepest package dir owning a changed file; null when the file is repo-level.
const ownerOf = (file: string): string | null => {
	let best: Pkg | null = null;
	for (const p of packages) {
		if (p.relDir === "") continue;
		if (file === p.relDir || file.startsWith(`${p.relDir}/`)) {
			if (!best || p.relDir.length > best.relDir.length) best = p;
		}
	}
	return best?.name ?? null;
};

let affected = new Set<string>();
if (!baseSha || /^0+$/.test(baseSha)) {
	affected = new Set(allNames); // no base → plan everything
} else {
	let changed: string[] | null = null;
	try {
		changed = execSync(`git diff --name-only ${baseSha} HEAD`, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
	} catch {
		changed = null; // base commit unreachable → plan everything
	}
	if (changed === null) {
		affected = new Set(allNames);
	} else {
		for (const file of changed) {
			const owner = ownerOf(file);
			if (owner) affected.add(owner);
			// A repo-level change (lockfile, root config) may affect any package.
			else {
				affected = new Set(allNames);
				break;
			}
		}
	}
}

const result: Record<string, string[]> = {};
for (const task of tasks) {
	result[task] = packages
		.filter((p) => affected.has(p.name) && p.scripts[task])
		.map((p) => p.name)
		.sort();
}

console.log(JSON.stringify(result));
