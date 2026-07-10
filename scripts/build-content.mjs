import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesDir = path.join(rootDir, "cases");
const themesDir = path.join(rootDir, "themes");
const optimizedDir = path.join(rootDir, "images", "optimized");

let sharp = null;
try {
  sharp = require("sharp");
} catch (error) {
  console.warn("sharp is unavailable; JSON will use original images.");
}

function normalizeValue(rawValue) {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/);
  const data = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (["|", "|-", ">", ">-"].includes(rawValue)) {
      const block = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        block.push(lines[index + 1].replace(/^\s+/, ""));
        index += 1;
      }
      data[key] = rawValue.startsWith(">") ? block.join(" ") : block.join("\n");
      continue;
    }

    data[key] = normalizeValue(rawValue);
  }

  return data;
}

async function readFrontmatterCollection(directory) {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }));

  const entries = [];
  for (const file of files) {
    const source = await readFile(path.join(directory, file), "utf8");
    const data = parseFrontmatter(source);
    if (data) entries.push({ ...data, sourceFile: file });
  }
  return entries;
}

function normalizeAssetPath(assetPath) {
  return String(assetPath || "").replace(/^\/+/, "");
}

async function optimizeCaseImage(caseItem) {
  const originalPath = normalizeAssetPath(caseItem.image);
  const absoluteOriginal = path.join(rootDir, originalPath);
  if (!sharp || !originalPath || !existsSync(absoluteOriginal)) {
    return { image: originalPath, imageThumb: originalPath, imageOptimized: originalPath };
  }

  await mkdir(optimizedDir, { recursive: true });
  const hash = createHash("sha1")
    .update(`${caseItem.sourceFile}:${originalPath}`)
    .digest("hex")
    .slice(0, 12);
  const cardRelative = `images/optimized/case-${hash}-card.webp`;
  const fullRelative = `images/optimized/case-${hash}-full.webp`;
  const cardAbsolute = path.join(rootDir, cardRelative);
  const fullAbsolute = path.join(rootDir, fullRelative);

  await sharp(absoluteOriginal)
    .rotate()
    .resize({ width: 720, height: 900, fit: "cover", position: "attention", withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(cardAbsolute);

  await sharp(absoluteOriginal)
    .rotate()
    .resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 5 })
    .toFile(fullAbsolute);

  const cardMeta = await sharp(cardAbsolute).metadata();
  const fullMeta = await sharp(fullAbsolute).metadata();
  return {
    image: originalPath,
    imageThumb: cardRelative,
    imageOptimized: fullRelative,
    thumbWidth: cardMeta.width,
    thumbHeight: cardMeta.height,
    imageWidth: fullMeta.width,
    imageHeight: fullMeta.height
  };
}

const themes = (await readFrontmatterCollection(themesDir))
  .map(({ sourceFile, ...theme }) => theme)
  .filter((theme) => theme.enabled !== false)
  .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

const categoryRank = new Map(themes.map((theme, index) => [theme.name, index]));
const rawCases = await readFrontmatterCollection(casesDir);
const cases = [];

for (const caseItem of rawCases) {
  const imageData = await optimizeCaseImage(caseItem);
  const { sourceFile, ...content } = caseItem;
  cases.push({
    ...content,
    alt: content.alt || content.title || "云梦AI婚纱照案例",
    description: content.description || "",
    ...imageData
  });
}

cases.sort((a, b) => {
  const rankA = categoryRank.has(a.category) ? categoryRank.get(a.category) : 9999;
  const rankB = categoryRank.has(b.category) ? categoryRank.get(b.category) : 9999;
  if (rankA !== rankB) return rankA - rankB;
  const orderDifference = Number(a.order || 0) - Number(b.order || 0);
  if (orderDifference !== 0) return orderDifference;
  return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hans-CN");
});

await writeFile(
  path.join(rootDir, "data", "categories.json"),
  `${JSON.stringify({ categories: themes }, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(rootDir, "data", "cases.json"),
  `${JSON.stringify(cases, null, 2)}\n`,
  "utf8"
);

console.log(`Built ${cases.length} cases across ${themes.length} themes.`);
