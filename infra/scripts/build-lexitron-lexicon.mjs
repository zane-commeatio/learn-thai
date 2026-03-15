import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(process.cwd(), "data/lexitron/telex.utf-8");
const outputPath = resolve(process.cwd(), "data/lexicon/lexitron.json");

function extractTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  if (!match) {
    return null;
  }

  const value = match[1]?.trim();
  return value && value.length > 0 ? value : null;
}

async function main() {
  const raw = await readFile(sourcePath, "utf8");
  const blocks = raw.match(/<Doc>[\s\S]*?<\/Doc>/g) ?? [];

  const lexicon = new Map();
  let skipped = 0;
  let duplicates = 0;

  for (const block of blocks) {
    const thai = extractTagValue(block, "tentry");
    const english = extractTagValue(block, "eentry");
    if (!thai || !english) {
      skipped += 1;
      continue;
    }

    if (lexicon.has(thai)) {
      duplicates += 1;
      continue;
    }

    lexicon.set(thai, english);
  }

  const sortedEntries = [...lexicon.entries()].sort(([left], [right]) => left.localeCompare(right, "th"));
  const output = Object.fromEntries(sortedEntries);

  await mkdir(resolve(process.cwd(), "data/lexicon"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`LEXiTRON transform complete.`);
  console.log(`Source docs: ${blocks.length}`);
  console.log(`Imported entries: ${sortedEntries.length}`);
  console.log(`Skipped entries: ${skipped}`);
  console.log(`Duplicate keys ignored: ${duplicates}`);
  console.log(`Output: ${outputPath}`);
}

await main();
