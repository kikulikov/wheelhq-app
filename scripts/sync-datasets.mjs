import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ageInDays, datasetProblem } from './dataset-contract.mjs';

const base = (process.env.DATASET_SYNC_BASE || 'https://datasets.wheelhq.xyz').replace(/\/$/, '');
const output = fileURLToPath(new URL('../static/data/', import.meta.url));
const files = ['indexes.json', 'earnings.json'];
const TIMEOUT_MS = 20_000;
const STALE_DAYS = 7;

try {
  const loaded = [];
  for (const name of files) {
    const url = `${base}/${name}`;
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const data = await response.json();
    const problem = datasetProblem(name, data);
    if (problem) throw new Error(`${url}: ${problem}`);
    const age = ageInDays(data.effectiveDate);
    if (age !== null && age > STALE_DAYS) {
      console.warn(`sync:data ${name} is ${age} days old`);
    }
    loaded.push({ name, data });
  }

  await mkdir(output, { recursive: true });
  for (const { name, data } of loaded) {
    const target = join(output, name);
    await writeFile(target, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`wrote ${target}`);
  }
} catch (error) {
  console.warn(`sync:data skipped, keeping the committed snapshots: ${error.message}`);
}
