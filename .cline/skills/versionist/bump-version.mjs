#!/usr/bin/env node
/**
 * versionist - bump-version.mjs
 *
 * package.json (ve uyumlu package-lock.json kök) versiyon numarasını artırır
 * ve isteğe bağlı olarak git add, commit ve push işlemlerini otomatikleştirir.
 *
 * Kullanım:
 *   node versionist/bump-version.mjs                          # Sadece versiyon artırır (patch)
 *   node versionist/bump-version.mjs --bump=minor             # Minor artırır
 *   node versionist/bump-version.mjs --commit                 # Versiyon artırır + git add + commit yapar
 *   node versionist/bump-version.mjs --push                   # Versiyon artırır + commit + git push yapar
 *   node versionist/bump-version.mjs --push --m="Özel mesaj" # Özel commit mesajı ile push yapar
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// --- Argüman ayrıştırma -------------------------------------------------
const args = process.argv.slice(2);
const bumpArg = args.find((a) => a.startsWith("--bump="));
const bump = bumpArg ? bumpArg.split("=")[1] : "patch";

const msgArg = args.find((a) => a.startsWith("--m="));
const customMsg = msgArg ? msgArg.slice(4) : "";

const doCommit = args.includes("--commit") || args.includes("--push");
const doPush = args.includes("--push");

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Bilinmeyen bump türü: "${bump}". patch | minor | major kullanın.`);
  process.exit(1);
}

// --- Helper: execSync runner --------------------------------------------
function runCmd(cmd) {
  console.log(`> ${cmd}`);
  try {
    const output = execSync(cmd, { cwd: root, encoding: "utf8" });
    if (output.trim()) console.log(output.trim());
  } catch (err) {
    console.error(`Komut hatası (${cmd}):`, err.message || err);
    process.exit(1);
  }
}

// --- Mevcut versiyonu oku -------------------------------------------------
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = String(pkg.version || "0.0.0");
const parts = current.split(".").map((n) => parseInt(n, 10) || 0);

let [major, minor, patch] = parts;
if (major === undefined) major = 0;
if (minor === undefined) minor = 0;
if (patch === undefined) patch = 0;

if (bump === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bump === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const next = `${major}.${minor}.${patch}`;

// --- package.json güncelle -------------------------------------------------
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`package.json: ${current} -> ${next} (${bump})`);

// --- package-lock.json kök versiyonunu eşitle ------------------------------
const pkgLockPath = join(root, "package-lock.json");
try {
  const lock = JSON.parse(readFileSync(pkgLockPath, "utf8"));
  if (lock.version === current) {
    lock.version = next;
    writeFileSync(pkgLockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
    console.log(`package-lock.json: versiyon ${current} -> ${next} olarak eşitlendi`);
  }
} catch {
  // Lockfile olmasa da devam et
}

// --- Git Commit & Push İle Yapılandırma ------------------------------------
if (doCommit) {
  const commitMsg = customMsg
    ? `chore(release): v${next} - ${customMsg}`
    : `chore(release): v${next} - release update`;

  runCmd("git add .");
  runCmd(`git commit -m "${commitMsg}"`);

  if (doPush) {
    runCmd("git push");
    console.log(`✓ Başarıyla commit atıldı ve repoya pushlandı: v${next}`);
  } else {
    console.log(`✓ Başarıyla commit atıldı (push yapılmadı): v${next}`);
  }
}

