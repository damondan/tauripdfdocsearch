import Database from '@tauri-apps/plugin-sql';
import type { PageResult, SearchResponse, BookData, PageData } from './types';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:pdfsearch.db');
    console.log('✅ Database connected successfully');
  }
  return db;
}

/**
 * Get all distinct subjects from the database
 */
export async function getSubjects(): Promise<string[]> {
  console.log('🔍 getSubjects called');
  const database = await getDb();
  console.log('📊 Running query: SELECT DISTINCT subject FROM books ORDER BY subject');
  const result = await database.select<Array<{subject: string}>>(
    'SELECT DISTINCT subject FROM books ORDER BY subject'
  );
  console.log('📚 Query result:', result);
  console.log('📚 Subjects loaded:', result.map(row => row.subject));
  return result.map(row => row.subject);
}

/**
 * Get book titles for a specific subject
 */
export async function getBookTitlesBySubject(subject: string): Promise<string[]> {
  const database = await getDb();
  const result = await database.select<Array<{bookTitle: string}>>(
    'SELECT bookTitle FROM books WHERE subject = $1 ORDER BY bookTitle',
    [subject]
  );
  return result.map(row => row.bookTitle);
}

/**
 * Search pages with full-text search
 */
export async function searchPages(
  subject: string,
  searchQuery: string,
  bookTitles: string[]
): Promise<SearchResponse> {
  const database = await getDb();
  
  // Build placeholders for IN clause
  const placeholders = bookTitles.map((_, i) => `$${i + 3}`).join(',');
  
  // Build FTS5 MATCH query with word boundaries
  const ftsQuery = `"${searchQuery}"`;
  
  const query = `
    SELECT p.bookTitle, p.pageNum, p.text 
    FROM pages p
    INNER JOIN pages_fts f ON p.id = f.rowid
    WHERE f.text MATCH $1
    AND p.subject = $2
    AND p.bookTitle IN (${placeholders})
    ORDER BY p.bookTitle, p.pageNum
  `;
  
  const params = [ftsQuery, subject, ...bookTitles];
  const results = await database.select<Array<{bookTitle: string, pageNum: number, text: string}>>(
    query,
    params
  );
  
  // Group results by book title
  const grouped: Record<string, PageResult[]> = {};
  
  for (const row of results) {
    if (!grouped[row.bookTitle]) {
      grouped[row.bookTitle] = [];
    }
    grouped[row.bookTitle].push({
      pageNum: row.pageNum,
      text: row.text
    });
  }
  
  const total = Object.values(grouped).reduce((sum, pages) => sum + pages.length, 0);
  
  return {
    message: 'Search completed',
    results: grouped,
    total
  };
}

/**
 * Insert or update a book record
 */
export async function upsertBook(bookData: BookData): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  
  await database.execute(
    `INSERT INTO books (subject, bookTitle, fileName, importedAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(subject, bookTitle) DO UPDATE SET
     fileName = excluded.fileName,
     updatedAt = excluded.updatedAt`,
    [bookData.subject, bookData.bookTitle, bookData.fileName, bookData.importedAt, now]
  );
}

/**
 * Insert or update a page record
 */
export async function upsertPage(pageData: PageData): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  
  await database.execute(
    `INSERT INTO pages (subject, bookTitle, pageNum, text, importedAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(subject, bookTitle, pageNum) DO UPDATE SET
     text = excluded.text,
     updatedAt = excluded.updatedAt`,
    [pageData.subject, pageData.bookTitle, pageData.pageNum, pageData.text, pageData.importedAt, now]
  );
}
