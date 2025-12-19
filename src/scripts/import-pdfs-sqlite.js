// scripts/import-pdfs-sqlite.js
// ES Module imports
import fs from 'fs/promises';
import path from 'path';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import Database from 'better-sqlite3';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';

// ES module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

// Configure PDF.js for Node environment
GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'; 

// Create a custom Node.js compatible document loader
const NodeCanvasFactory = {
  create: function(width, height) {
    return {
      width,
      height,
      getContext: function() {
        return {
          // Stub methods that might be called but aren't needed for text extraction
          scale: function() {},
          translate: function() {},
          transform: function() {},
          beginPath: function() {},
          moveTo: function() {},
          lineTo: function() {},
          closePath: function() {},
          stroke: function() {},
          fill: function() {},
          measureText: function() { return { width: 0 }; },
          fillText: function() {},
          restore: function() {},
          save: function() {},
          rect: function() {},
          clip: function() {}
        };
      },
      toBuffer: function() { return null; }
    };
  }
};

// Get Tauri app data directory path (matches what Tauri uses)
function getDbPath() {
  //gets operating system platform
  const platform = process.platform;
  let dataDir;
  
  if (platform === 'darwin') {
    dataDir = path.join(homedir(), 'Library', 'Application Support', 'com.tauri.dev');
  } else if (platform === 'win32') {
    dataDir = path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), 'com.tauri.dev');
  } else {
    // Linux - Tauri uses .config in dev mode
    dataDir = path.join(homedir(), '.config', 'com.tauri.dev');
  }
  
  return path.join(dataDir, 'pdfsearch.db');
}

// SQLite connection function
async function connect() {
  if (db) return db;
  
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  
  // Ensure directory exists
  await fs.mkdir(dbDir, { recursive: true });
  
  db = new Database(dbPath);
  console.log(`Connected to SQLite at: ${dbPath}`);
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      bookTitle TEXT NOT NULL,
      fileName TEXT NOT NULL,
      tableOfContents TEXT,
      importedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(subject, bookTitle)
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      bookTitle TEXT NOT NULL,
      pageNum INTEGER NOT NULL,
      text TEXT NOT NULL,
      importedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(subject, bookTitle, pageNum)
    );

    CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject);
    CREATE INDEX IF NOT EXISTS idx_pages_lookup ON pages(subject, bookTitle, pageNum);
  `);
  
  return db;
}

// Close connection function
async function close() {
  console.log("Closing SQLite connection");
  if (db) {
    db.close();
    db = null;
  }
}

// Function to prompt user for input
// promptUser(question: string): Promise<string>
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });
}

// Function to clear existing data from tables
async function clearCollections() {
  const database = await connect();
  
  console.log('\nClearing existing data...');
  
  const booksResult = database.prepare('DELETE FROM books').run();
  const pagesResult = database.prepare('DELETE FROM pages').run();
  
  console.log(`Deleted ${booksResult.changes} books and ${pagesResult.changes} pages.`);
}

// Function to extract table of contents from multiple pages
// Returns array of TOC entries
// extractTableOfContents(allPageTexts: string[]): string[]
function extractTableOfContents(allPageTexts) {
  const tocEntries = [];
  let tocReached = false;
  
  console.log(`  🔍 Scanning ${allPageTexts.length} pages for TOC...`);
  
  // Roman numeral pattern (i, ii, iii, iv, v, vi, vii, viii, ix, x, etc.)
  const romanNumeralPattern = /\b([ivxlcdm]+)\b/i;
  
  for (let pageIdx = 0; pageIdx < allPageTexts.length; pageIdx++) {
    const pageText = allPageTexts[pageIdx];
    const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log(`\n  📖 Page ${pageIdx + 1}: Checking ${lines.length} lines...`);
    
    // Check if this page has TOC marker, dot leader pattern, or roman numerals
    let hasTocMarker = false;
    let hasDotLeaderPattern = false;
    let hasValidRomanNumerals = false;
    
    for (const line of lines) {
      // Check for TOC marker
      if (/table\s+of\s+contents|^contents$/i.test(line)) {
        hasTocMarker = true;
        tocReached = true;
        console.log(`  ✅ Found TOC marker: "${line}"`);
        break;
      }
      
      // Check for dot leader pattern: 2+ dots followed by number
      // Pattern: text ... (dots) ... number
      if (/\.{2,}\s*\d+\s*$/.test(line)) {
        hasDotLeaderPattern = true;
        break;
      }
    }
    
    // Check for valid roman numerals (only if on multiple lines or with dots/numbers)
    if (tocReached && !hasTocMarker) {
      // Count how many lines have roman numerals
      let romanNumeralCount = 0;
      let hasRomanWithDotsOrNumbers = false;
      
      for (const line of lines) {
        if (romanNumeralPattern.test(line)) {
          romanNumeralCount++;
          
          // Check if this line also has dots or ends with a number (TOC format)
          if (/\.{2,}/.test(line) || /\d+\s*$/.test(line)) {
            hasRomanWithDotsOrNumbers = true;
          }
        }
      }
      
      // Valid if: multiple roman numerals OR roman numerals with dots/page numbers
      hasValidRomanNumerals = romanNumeralCount > 1 || hasRomanWithDotsOrNumbers;
      
      if (hasValidRomanNumerals) {
        console.log(`  ✅ Found valid roman numerals (count: ${romanNumeralCount}, withDots: ${hasRomanWithDotsOrNumbers})`);
      }
      
      // Also check for dot leader pattern
      hasDotLeaderPattern = lines.some(line => /\.{2,}\s*\d+\s*$/.test(line));
    }
    
    // Add all lines from this page if it has TOC marker, dot leader pattern, or valid roman numerals
    if (hasTocMarker || (tocReached && (hasDotLeaderPattern || hasValidRomanNumerals))) {
      console.log(`  ✅ Page ${pageIdx + 1} is TOC page (marker: ${hasTocMarker}, dots: ${hasDotLeaderPattern}, roman: ${hasValidRomanNumerals})`);
      
      for (const line of lines) {
        // Skip the "Table of Contents" header itself and page numbers alone
        if (!/^table\s+of\s+contents$|^contents$|^\d+$/i.test(line) && line.length > 2) {
          tocEntries.push(line);
          console.log(`    📄 Added: "${line.substring(0, 60)}..."`);
        }
      }
    } else if (tocReached && !hasDotLeaderPattern && !hasValidRomanNumerals) {
      // TOC has ended if we were in TOC but no dot pattern or valid roman numerals found
      console.log(`  🛑 TOC ended at page ${pageIdx + 1}`);
      break;
    }
  }
  
  console.log(`\n  📊 Total TOC entries collected: ${tocEntries.length}`);
  return tocEntries;
}

// Database operations
const bookModel = {
  // upsertBook(bookData: {subject: string, bookTitle: string, fileName: string, tableOfContents?: string[], importedAt: string}): Promise<void>
  async upsertBook(bookData) {
    const database = await connect();
    const now = new Date().toISOString();
    
    // Convert tableOfContents array to JSON string if present
    const tocJson = bookData.tableOfContents ? JSON.stringify(bookData.tableOfContents) : null;
    
    const stmt = database.prepare(`
      INSERT INTO books (subject, bookTitle, fileName, tableOfContents, importedAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(subject, bookTitle) DO UPDATE SET
      fileName = excluded.fileName,
      tableOfContents = excluded.tableOfContents,
      updatedAt = excluded.updatedAt
    `);
    
    stmt.run(
      bookData.subject,
      bookData.bookTitle,
      bookData.fileName,
      tocJson,
      bookData.importedAt,
      now
    );
  }
};

const pageModel = {
  // upsertPage(pageData: {subject: string, bookTitle: string, pageNum: number, text: string, importedAt: string}): Promise<void>
  async upsertPage(pageData) {
    const database = await connect();
    const now = new Date().toISOString();
    
    const stmt = database.prepare(`
      INSERT INTO pages (subject, bookTitle, pageNum, text, importedAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(subject, bookTitle, pageNum) DO UPDATE SET
      text = excluded.text,
      updatedAt = excluded.updatedAt
    `);
    
    stmt.run(
      pageData.subject,
      pageData.bookTitle,
      pageData.pageNum,
      pageData.text,
      pageData.importedAt,
      now
    );
  },

  async createFtsTable() {
    const database = await connect();
    
    // Create FTS5 virtual table
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
        subject,
        bookTitle,
        pageNum,
        text,
        content='pages',
        content_rowid='id'
      );

      -- Populate FTS table with existing data
      INSERT OR IGNORE INTO pages_fts(rowid, subject, bookTitle, pageNum, text)
      SELECT id, subject, bookTitle, pageNum, text FROM pages;

      -- Triggers to keep FTS in sync
      DROP TRIGGER IF EXISTS pages_ai;
      CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
        INSERT INTO pages_fts(rowid, subject, bookTitle, pageNum, text)
        VALUES (new.id, new.subject, new.bookTitle, new.pageNum, new.text);
      END;

      DROP TRIGGER IF EXISTS pages_ad;
      CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
        INSERT INTO pages_fts(pages_fts, rowid, subject, bookTitle, pageNum, text)
        VALUES('delete', old.id, old.subject, old.bookTitle, old.pageNum, old.text);
      END;

      DROP TRIGGER IF EXISTS pages_au;
      CREATE TRIGGER pages_au AFTER UPDATE ON pages BEGIN
        INSERT INTO pages_fts(pages_fts, rowid, subject, bookTitle, pageNum, text)
        VALUES('delete', old.id, old.subject, old.bookTitle, old.pageNum, old.text);
        INSERT INTO pages_fts(rowid, subject, bookTitle, pageNum, text)
        VALUES (new.id, new.subject, new.bookTitle, new.pageNum, new.text);
      END;
    `);
    
    console.log('FTS table and triggers created');
  }
};

// Main import function
async function importPdfs() {
  try {
    // Prompt user for append or clear mode
    const response = await promptUser('Will this DB data be appended? (Y/N): ');
    
    // Connect to SQLite
    await connect();
    
    // If user chose 'N', clear existing data
    if (response === 'N') {
      await clearCollections();
    } else if (response === 'Y') {
      console.log('\nAppending to existing data...');
    } else {
      console.log('\nInvalid response. Defaulting to append mode.');
    }
    
    // Get all directories (subjects)
    const baseDir = path.join(__dirname, '..', '..');
    console.log('Script __dirname:', __dirname);
    console.log('Base directory:', baseDir);
    
    // Specify the subject folders we're looking for
    const subjectFolders = ['Codoh', 'NonFiction', 'Psychology', 'Philosophy', 'Art'];
    //const subjectFolders = ['NonFiction'];
    const subjects = [];
    
    // Check if each subject folder exists
    for (const folder of subjectFolders) {
      const folderPath = path.join(baseDir, folder);
      console.log(`Checking path: ${folderPath}`);
      try {
        const stat = await fs.stat(folderPath);
        if (stat.isDirectory()) {
          console.log(`✓ Found: ${folder}`);
          subjects.push(folder);
        }
      } catch (error) {
        console.log(`✗ Subject folder "${folder}" not found at: ${folderPath}`);
        console.log(`Error:`, error.message);
      }
    }
    
    console.log(`Found ${subjects.length} subjects: ${subjects.join(', ')}`);
    
    // Process each subject
    for (const subject of subjects) {
      console.log(`\nProcessing subject: ${subject}`);
      const subjectPath = path.join(baseDir, subject);
      
      // Get all PDF files in the subject folder
      const files = await fs.readdir(subjectPath);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      console.log(`Found ${pdfFiles.length} PDF files in ${subject}`);
      
      // Process each PDF file
      for (const pdfFile of pdfFiles) {
        const bookTitle = path.basename(pdfFile, '.pdf');
        console.log(`\nProcessing book: ${bookTitle}`);
        
        // Process the PDF pages
        try {
          const pdfPath = path.join(subjectPath, pdfFile);
          const dataBuffer = await fs.readFile(pdfPath);
          
          // Configure PDF.js with Node.js friendly options
          const loadingTask = getDocument({
            data: new Uint8Array(dataBuffer),
            canvasFactory: NodeCanvasFactory,
            disableFontFace: true,
            nativeImageDecoderSupport: 'none'
          });
          
          // Load the PDF
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;
          
          console.log(`PDF has ${numPages} pages. Extracting text...`);
          
          // Store all page texts for TOC extraction
          const allPageTexts = [];
          
          // Process each page
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
              // Get the page
              const page = await pdf.getPage(pageNum);
              
              // Extract text content
              const textContent = await page.getTextContent();
              
              // For regular search: join with spaces
              const pageText = textContent.items.map(item => item.str).join(' ');
              
              // For TOC extraction: preserve line breaks based on Y-coordinates
              if (pageNum <= 30) {
                let pageTextWithLines = '';
                let lastY = null;
                
                for (const item of textContent.items) {
                  const currentY = item.transform[5]; // Y-coordinate
                  
                  // If Y changed significantly, it's a new line
                  if (lastY !== null && Math.abs(currentY - lastY) > 2) {
                    pageTextWithLines += '\n';
                  }
                  
                  pageTextWithLines += item.str + ' ';
                  lastY = currentY;
                }
                
                allPageTexts.push(pageTextWithLines);
              }
              
              // Store page in SQLite
              await pageModel.upsertPage({
                subject,
                bookTitle,
                pageNum,
                text: pageText,
                importedAt: new Date().toISOString()
              });
              
              if (pageNum % 10 === 0 || pageNum === numPages) {
                console.log(`Processed ${pageNum}/${numPages} pages of ${bookTitle}`);
              }
            } catch (error) {
              console.error(`Error processing page ${pageNum} of ${bookTitle}:`, error);
            }
          }
          
          // Extract table of contents from the collected pages
          console.log('\n📚 Extracting table of contents...');
          const tableOfContents = extractTableOfContents(allPageTexts);
          
          if (tableOfContents.length > 0) {
            console.log(`\n✅ Found TOC with ${tableOfContents.length} entries!`);
          } else {
            console.log(`\n⚠️  No TOC found in first 30 pages`);
          }
          
          // Store book information with TOC (if found)
          if (tableOfContents.length > 0) {
            console.log(`💾 Saving book with TOC to database...`);
            await bookModel.upsertBook({
              subject,
              bookTitle,
              fileName: pdfFile,
              tableOfContents,
              importedAt: new Date().toISOString()
            });
            console.log(`✅ Book saved with ${tableOfContents.length} TOC entries`);
          } else {
            console.log(`⚠️  No TOC found, saving book without TOC...`);
            await bookModel.upsertBook({
              subject,
              bookTitle,
              fileName: pdfFile,
              importedAt: new Date().toISOString()
            });
            console.log(`✅ Book saved without TOC`);
          }
        } catch (error) {
          console.error(`Error processing PDF ${pdfFile}:`, error);
        }
      }
    }
    
    // Create FTS table after all data is imported
    console.log('\nCreating full-text search indexes...');
    await pageModel.createFtsTable();
    
    console.log('\nImport completed successfully!');
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    // Close SQLite connection
    await close();
  }
}

// Run the import
importPdfs().catch(console.error);
