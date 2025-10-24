# MongoDB to SQLite Migration

This document outlines the migration from MongoDB to SQLite for the Tauri PDF Search application.

## What Changed

### Database
- **From**: MongoDB Atlas cloud database
- **To**: SQLite local database with Tauri plugin
- **Location**: `~/.local/share/com.tauri.dev/pdfsearch.db` (Linux)

### Architecture
- **From**: SvelteKit API routes calling MongoDB
- **To**: Direct SQLite calls from frontend via Tauri SQL plugin

### Key Benefits
- ✅ No internet connection required
- ✅ Faster queries (local database)
- ✅ No cloud database costs
- ✅ Better for desktop app distribution
- ✅ Full-text search with FTS5

## Database Schema

### Books Table
```sql
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  bookTitle TEXT NOT NULL,
  fileName TEXT NOT NULL,
  importedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(subject, bookTitle)
);
```

### Pages Table
```sql
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  bookTitle TEXT NOT NULL,
  pageNum INTEGER NOT NULL,
  text TEXT NOT NULL,
  importedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(subject, bookTitle, pageNum)
);
```

### FTS5 Search Table
```sql
CREATE VIRTUAL TABLE pages_fts USING fts5(
  subject,
  bookTitle,
  pageNum,
  text,
  content='pages',
  content_rowid='id'
);
```

## Importing PDFs

### Prerequisites
Place your PDF files in subject folders at the project root:
```
tauripdfdocsearch/
├── ProgramLanguages/
│   ├── book1.pdf
│   └── book2.pdf
├── NonFiction/
│   └── book3.pdf
└── Jung/
    └── book4.pdf
```

### Run Import
```bash
pnpm import:pdfs
```

This will:
1. Create the SQLite database in Tauri's app data directory
2. Extract text from all PDFs in subject folders
3. Store books and pages in the database
4. Create full-text search indexes

## Files Removed
- `src/db/mongodb.ts` - MongoDB connection
- `src/db/models/book.ts` - MongoDB book model
- `src/db/models/page.ts` - MongoDB page model
- `src/routes/api/` - SvelteKit API routes
- `src/scripts/import-pdfs.js` - Old MongoDB import script

## Files Added
- `src/lib/tauri-db.ts` - Direct SQLite query functions
- `src/scripts/import-pdfs-sqlite.js` - New SQLite import script
- `src-tauri/src/db.rs` - Database migrations
- `src-tauri/Cargo.toml` - Added `tauri-plugin-sql` and `chrono`

## Files Modified
- `src/routes/+page.server.ts` - Uses Tauri DB instead of MongoDB
- `src/routes/+page.svelte` - Calls Tauri DB functions
- `src/lib/components/SearchBar.svelte` - Calls Tauri DB for search
- `src-tauri/src/lib.rs` - Registered SQL plugin
- `package.json` - Added import script, `@tauri-apps/plugin-sql`, `better-sqlite3`

## Running the App

### Development
```bash
pnpm tauri:dev
```

### Production Build
```bash
pnpm tauri:build
```

## Troubleshooting

### No subjects showing up
Make sure you've run the import script first:
```bash
pnpm import:pdfs
```

### Database location
Linux: `~/.local/share/com.tauri.dev/pdfsearch.db`
macOS: `~/Library/Application Support/com.tauri.dev/pdfsearch.db`
Windows: `%APPDATA%\com.tauri.dev\pdfsearch.db`

### Search not working
The FTS5 table is created automatically during import. If you manually inserted data, run the import script again to rebuild the FTS index.
