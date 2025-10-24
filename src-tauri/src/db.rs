use tauri_plugin_sql::{Migration, MigrationKind};

/// Initialize the database with schema and indexes
pub fn init_db() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
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
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_fts_table",
            sql: "
                CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
                    subject,
                    bookTitle,
                    pageNum,
                    text,
                    content='pages',
                    content_rowid='id'
                );

                -- Populate FTS table with existing data
                INSERT INTO pages_fts(rowid, subject, bookTitle, pageNum, text)
                SELECT id, subject, bookTitle, pageNum, text FROM pages;

                -- Triggers to keep FTS in sync
                CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
                    INSERT INTO pages_fts(rowid, subject, bookTitle, pageNum, text)
                    VALUES (new.id, new.subject, new.bookTitle, new.pageNum, new.text);
                END;

                CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
                    INSERT INTO pages_fts(pages_fts, rowid, subject, bookTitle, pageNum, text)
                    VALUES('delete', old.id, old.subject, old.bookTitle, old.pageNum, old.text);
                END;

                CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
                    INSERT INTO pages_fts(pages_fts, rowid, subject, bookTitle, pageNum, text)
                    VALUES('delete', old.id, old.subject, old.bookTitle, old.pageNum, old.text);
                    INSERT INTO pages_fts(rowid, subject, bookTitle, pageNum, text)
                    VALUES (new.id, new.subject, new.bookTitle, new.pageNum, new.text);
                END;
            ",
            kind: MigrationKind::Up,
        },
    ]
}
