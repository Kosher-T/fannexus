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
const SCRAPING_DIR = path.join(DATA_DIR, 'scraping');
const INGESTED_IDS_FILE = path.join(SCRAPING_DIR, 'ingested_ids.txt');
const PENDING_INGEST_FILE = path.join(SCRAPING_DIR, 'pending_ingest_files.txt');

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

function loadIngestedIds(): Set<string> {
  const ids = new Set<string>();
  if (fs.existsSync(INGESTED_IDS_FILE)) {
    const content = fs.readFileSync(INGESTED_IDS_FILE, 'utf-8');
    for (const line of content.split('\n')) {
      const id = line.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

function getPendingFiles(): string[] {
  if (!fs.existsSync(PENDING_INGEST_FILE)) return [];
  const content = fs.readFileSync(PENDING_INGEST_FILE, 'utf-8');
  const files = new Set<string>();
  for (const line of content.split('\n')) {
    const filePath = line.trim();
    if (filePath && fs.existsSync(filePath)) files.add(filePath);
  }
  return Array.from(files);
}

async function ingestFile(
  db: admin.database.Database | admin.firestore.Firestore, 
  filePath: string, 
  isDryRun: boolean,
  ingestedIds: Set<string>
): Promise<string[]> {
  const firestore = admin.firestore();
  console.log(`\n📂 Processing: ${path.relative(DATA_DIR, filePath)}`);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch = firestore.batch();
  let countInBatch = 0;
  const newIds: string[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const story: StoryMetadata = JSON.parse(line);
      if (!story.ao3Id) {
        console.warn(`  ⚠️ Skipping story without ao3Id: ${story.title}`);
        continue;
      }

      // Skip if already ingested
      if (ingestedIds.has(story.ao3Id)) {
        continue;
      }

      const docRef = firestore.collection('stories').doc(story.ao3Id);
      
      if (!isDryRun) {
        batch.set(docRef, story, { merge: true });
        countInBatch++;
        newIds.push(story.ao3Id);

        if (countInBatch === BATCH_SIZE) {
          await batch.commit();
          console.log(`  ✅ Committed batch of ${countInBatch} (Total new for file: ${newIds.length})`);
          batch = firestore.batch();
          countInBatch = 0;
        }
      } else {
        newIds.push(story.ao3Id);
      }
    } catch (err) {
      console.error(`  ❌ Failed to parse or process line: ${err}`);
    }
  }

  if (countInBatch > 0 && !isDryRun) {
    await batch.commit();
    console.log(`  ✅ Committed final batch of ${countInBatch} (Total new for file: ${newIds.length})`);
  } else if (isDryRun) {
    console.log(`  [DRY RUN] Would ingest ${newIds.length} new stories.`);
  }

  if (newIds.length === 0) {
    console.log(`  ⏭️ No new stories to ingest in this file.`);
  }

  return newIds;
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isAll = args.includes('--all');

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

  const ingestedIds = loadIngestedIds();
  console.log(`📚 Loaded ${ingestedIds.size} already ingested IDs.`);

  let files: string[] = [];
  if (isAll) {
    console.log('🔍 Scanning all JSONL files (--all flag used)...');
    files = await getJsonlFiles(SCRAPED_DIR);
  } else {
    files = getPendingFiles();
    if (files.length === 0) {
      console.log('📭 No pending files to ingest. Use --all to force scan all files.');
      process.exit(0);
    }
  }

  console.log(`📋 Found ${files.length} files to process.`);
  let totalNewIngested = 0;
  const allNewIds: string[] = [];

  for (const file of files) {
    const newIds = await ingestFile(db, file, isDryRun, ingestedIds);
    totalNewIngested += newIds.length;
    allNewIds.push(...newIds);
  }

  if (!isDryRun && allNewIds.length > 0) {
    if (!fs.existsSync(SCRAPING_DIR)) fs.mkdirSync(SCRAPING_DIR, { recursive: true });
    fs.appendFileSync(INGESTED_IDS_FILE, allNewIds.join('\n') + '\n');
    console.log(`📝 Appended ${allNewIds.length} new IDs to ingested_ids.txt`);
  }

  if (!isDryRun && !isAll) {
    // Clear pending files
    fs.writeFileSync(PENDING_INGEST_FILE, '');
    console.log('🧹 Cleared pending ingest files queue.');
  }

  console.log('\n=============================================');
  console.log(`🎉 Finished processing ${files.length} files.`);
  console.log(`📊 Total NEW stories processed: ${totalNewIngested}`);
  if (isDryRun) {
    console.log('ℹ️  Run without --dry-run to actually ingest data.');
  }
  console.log('=============================================');
  process.exit(0);
}

// Start execution
run().catch(console.error);
