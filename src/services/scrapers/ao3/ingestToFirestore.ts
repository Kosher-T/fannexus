import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { initFirebase } from './firebaseCoordination';
import type { StoryMetadata } from '../../../types/scraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../data');
const SCRAPED_DIR = path.join(DATA_DIR, 'scraped');

const BATCH_SIZE = 500; // Firestore limit is 500 per batch

async function getJsonlFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getJsonlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function ingestFile(db: admin.database.Database | admin.firestore.Firestore, filePath: string, isDryRun: boolean): Promise<number> {
  const firestore = admin.firestore();
  console.log(`\n📂 Processing: ${path.relative(DATA_DIR, filePath)}`);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch = firestore.batch();
  let countInBatch = 0;
  let totalIngested = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const story: StoryMetadata = JSON.parse(line);
      if (!story.ao3Id) {
        console.warn(`  ⚠️ Skipping story without ao3Id: ${story.title}`);
        continue;
      }

      const docRef = firestore.collection('stories').doc(story.ao3Id);
      
      if (!isDryRun) {
        batch.set(docRef, story, { merge: true });
        countInBatch++;

        if (countInBatch === BATCH_SIZE) {
          await batch.commit();
          totalIngested += countInBatch;
          console.log(`  ✅ Committed batch of ${countInBatch} (Total for file: ${totalIngested})`);
          batch = firestore.batch();
          countInBatch = 0;
        }
      } else {
        totalIngested++;
      }
    } catch (err) {
      console.error(`  ❌ Failed to parse or process line: ${err}`);
    }
  }

  if (countInBatch > 0 && !isDryRun) {
    await batch.commit();
    totalIngested += countInBatch;
    console.log(`  ✅ Committed final batch of ${countInBatch} (Total for file: ${totalIngested})`);
  } else if (isDryRun) {
    console.log(`  [DRY RUN] Would ingest ${totalIngested} stories.`);
  }

  return totalIngested;
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  if (isDryRun) {
    console.log('=== DRY RUN MODE: No data will be written to Firestore ===');
  }

  let db;
  try {
    db = initFirebase();
    console.log('[Firebase] ✅ Connected to Firebase');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    process.exit(1);
  }

  if (!fs.existsSync(SCRAPED_DIR)) {
    console.error(`❌ Scraped directory not found at: ${SCRAPED_DIR}`);
    process.exit(1);
  }

  const files = await getJsonlFiles(SCRAPED_DIR);
  if (files.length === 0) {
    console.log(`📭 No .jsonl files found in ${SCRAPED_DIR}`);
    return;
  }

  console.log(`📋 Found ${files.length} JSONL files to process.`);
  let totalAcrossAll = 0;

  for (const file of files) {
    const fileTotal = await ingestFile(db, file, isDryRun);
    totalAcrossAll += fileTotal;
  }

  console.log('\n=============================================');
  console.log(`🎉 Finished processing ${files.length} files.`);
  console.log(`📊 Total stories processed: ${totalAcrossAll}`);
  if (isDryRun) {
    console.log('ℹ️  Run without --dry-run to actually ingest data.');
  }
  console.log('=============================================');
  process.exit(0);
}

// Start execution
run().catch(console.error);
