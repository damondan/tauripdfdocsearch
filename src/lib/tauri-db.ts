import Database from '@tauri-apps/plugin-sql';
import type { PageResult, SearchResponse, BookData, PageData, BookWithTOC } from './types';

let db: Database | null = null;

async function getDb(): Promise<Database> {
 if (db) return db;

  try {
    db = await Database.load('sqlite:pdfsearch.db');
    console.log('✅ Database connected successfully');
    return db;
  } catch (err) {
    console.error('❌ Failed to load SQLite database', err);
    throw new Error(
      err instanceof Error
        ? `Database initialization failed: ${err.message}`
        : 'Database initialization failed due to an unknown error'
    );
  }
}

/**
 * Get all distinct subjects from the database
 */
export async function getSubjects(): Promise<string[]> {
  console.log('🔍 getSubjects called');
  const database = await getDb();
  const dbInfo = await database.select('PRAGMA database_list');
  console.log('🗂️ DB INFO:', dbInfo);

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
 * getBookTitlesBySubject(subject: string): Promise<BookWithTOC[]>
 */
export async function getBookTitlesBySubject(subject: string): Promise<BookWithTOC[]> {
  const database = await getDb();
  const result = await database.select<Array<{bookTitle: string, tableOfContents: string | null}>>(
    'SELECT bookTitle, tableOfContents FROM books WHERE subject = $1 ORDER BY bookTitle',
    [subject]
  );
  return result.map(row => ({
    bookTitle: row.bookTitle,
    tableOfContents: row.tableOfContents ? JSON.parse(row.tableOfContents) : undefined
  }));
}

export async function searchPages(
  subject: string,
  searchQuery: string,
  bookTitles: string[]
): Promise<SearchResponse> {
  const database = await getDb();

  // Build placeholders for IN clause
  const placeholders = bookTitles.map((_, i) => `$${i + 3}`).join(',');

  // Build FTS5 MATCH query
  const ftsQuery = `"${searchQuery}"`;

  // First, find all matches
  const matchQuery = `
    SELECT p.bookTitle, p.pageNum, p.text
    FROM pages p
    INNER JOIN pages_fts f ON p.id = f.rowid
    WHERE f.text MATCH $1
    AND p.subject = $2
    AND p.bookTitle IN (${placeholders})
    ORDER BY p.bookTitle, p.pageNum
  `;

  const params = [ftsQuery, subject, ...bookTitles];

  const matchResults = await database.select<
    Array<{
      bookTitle: string;
      pageNum: number;
      text: string;
    }>
  >(matchQuery, params);

  // Keeps carousel groups:
  // [previous, currentMatch, next]
  const grouped: Record<string, (PageResult | null)[]> = {};

  // Track pages already preserved for each book
  const savedPages: Record<string, Set<number>> = {};

  for (const match of matchResults) {
    if (!grouped[match.bookTitle]) {
      grouped[match.bookTitle] = [];
      savedPages[match.bookTitle] = new Set<number>();
    }

    const saved = savedPages[match.bookTitle];

    // If this matching page was already preserved as part
    // of a prior carousel group, skip this match entirely.
    if (saved.has(match.pageNum)) {
      continue;
    }

    const adjacentQuery = `
      SELECT pageNum, text
      FROM pages
      WHERE bookTitle = $1
      AND subject = $2
      AND pageNum IN ($3, $4, $5)
      ORDER BY pageNum
    `;

    const adjacentResults = await database.select<
      Array<{
        pageNum: number;
        text: string;
      }>
    >(
      adjacentQuery,
      [
        match.bookTitle,
        subject,
        match.pageNum - 1,
        match.pageNum,
        match.pageNum + 1
      ]
    );

    const pageMap = new Map(
      adjacentResults.map(page => [page.pageNum, page])
    );

    const previousPage = pageMap.get(match.pageNum - 1) ?? null;

    const currentPage: PageResult = {
      pageNum: match.pageNum,
      text: match.text
    };

    const nextPage = pageMap.get(match.pageNum + 1) ?? null;

    // Preserve strict carousel structure:
    // [previous, current, next]

    // Previous
    if (
      previousPage !== null &&
      !saved.has(previousPage.pageNum)
    ) {
      grouped[match.bookTitle].push(previousPage);
      saved.add(previousPage.pageNum);
    } else {
      grouped[match.bookTitle].push(null);
    }

    // Current match
    grouped[match.bookTitle].push(currentPage);
    saved.add(currentPage.pageNum);

    // Next
    if (
      nextPage !== null &&
      !saved.has(nextPage.pageNum)
    ) {
      grouped[match.bookTitle].push(nextPage);
      saved.add(nextPage.pageNum);
    } else {
      grouped[match.bookTitle].push(null);
    }
  }

  const total = Object.values(grouped).reduce(
    (sum, pages) =>
      sum + pages.filter(page => page !== null).length,
    0
  );

// console.log('===== FINAL GROUPED RESULTS =====');

// for (const [bookTitle, pages] of Object.entries(grouped)) {
//   console.log(`BOOK: ${bookTitle}`);

//   pages.forEach((page, index) => {
//     console.log(
//       `index=${index}`,
//       page === null
//         ? 'NULL'
//         : `pageNum=${page.pageNum}`
//     );
//   });
// }

// console.log('===== END GROUPED RESULTS =====');


  return {
    message: 'Search completed',
    results: grouped,
    total
  };
}

/**
 * Insert or update a book record
 * upsertBook(bookData: BookData): Promise<void>
 */
export async function upsertBook(bookData: BookData): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  
  const tocJson = bookData.tableOfContents ? JSON.stringify(bookData.tableOfContents) : null;
  
  await database.execute(
    `INSERT INTO books (subject, bookTitle, fileName, tableOfContents, importedAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(subject, bookTitle) DO UPDATE SET
     fileName = excluded.fileName,
     tableOfContents = excluded.tableOfContents,
     updatedAt = excluded.updatedAt`,
    [bookData.subject, bookData.bookTitle, bookData.fileName, tocJson, bookData.importedAt, now]
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
