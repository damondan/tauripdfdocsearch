// scripts/import-pdfs-sqlite.js
// ES Module imports
import fs from 'fs/promises';
import path from 'path';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import Database from 'better-sqlite3';
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
  const platform = process.platform;
  let dataDir;
  
  if (platform === 'darwin') {
    dataDir = path.join(homedir(), 'Library', 'Application Support', 'com.tauri.dev');
  } else if (platform === 'win32') {
    dataDir = path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), 'com.tauri.dev');
  } else {
    // Linux
    dataDir = path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'), 'com.tauri.dev');
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

// Database operations
const bookModel = {
  async upsertBook(bookData) {
    const database = await connect();
    const now = new Date().toISOString();
    
    const stmt = database.prepare(`
      INSERT INTO books (subject, bookTitle, fileName, importedAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(subject, bookTitle) DO UPDATE SET
      fileName = excluded.fileName,
      updatedAt = excluded.updatedAt
    `);
    
    stmt.run(
      bookData.subject,
      bookData.bookTitle,
      bookData.fileName,
      bookData.importedAt,
      now
    );
  }
};

const pageModel = {
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
    // Connect to SQLite
    await connect();
    
    // Get all directories (subjects)
    const baseDir = path.join(__dirname, '..', '..');
    console.log('Script __dirname:', __dirname);
    console.log('Base directory:', baseDir);
    
    // Specify the subject folders we're looking for
    const subjectFolders = ['Program Languages', 'NonFiction', 'Jung'];
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
        
        // Store book information
        await bookModel.upsertBook({
          subject,
          bookTitle,
          fileName: pdfFile,
          importedAt: new Date().toISOString()
        });
        
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
          
          // Process each page
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
              // Get the page
              const page = await pdf.getPage(pageNum);
              
              // Extract text content
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(' ');
              
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
