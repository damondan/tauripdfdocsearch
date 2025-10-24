use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct PageResult {
    #[serde(rename = "pageNum")]
    page_num: i64,
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    message: String,
    results: HashMap<String, Vec<PageResult>>,
    total: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BookData {
    subject: String,
    #[serde(rename = "bookTitle")]
    book_title: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "importedAt")]
    imported_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageData {
    subject: String,
    #[serde(rename = "bookTitle")]
    book_title: String,
    #[serde(rename = "pageNum")]
    page_num: i64,
    text: String,
    #[serde(rename = "importedAt")]
    imported_at: String,
}

fn get_db_path(app: &tauri::AppHandle) -> Result<String, String> {
    let db_path = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pdfsearch.db");
    Ok(format!("sqlite:{}", db_path.display()))
}

#[tauri::command]
pub async fn get_subjects(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let db_url = get_db_path(&app)?;
    let db = tauri_plugin_sql::Builder::default().build().load(&db_url).await.map_err(|e| e.to_string())?;
    
    let result: Vec<serde_json::Value> = db.select("SELECT DISTINCT subject FROM books ORDER BY subject").await.map_err(|e| e.to_string())?;
    
    let subjects: Vec<String> = result.iter()
        .filter_map(|row| row.get("subject").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();
    
    Ok(subjects)
}

#[tauri::command]
pub async fn get_book_titles_by_subject(
    app: tauri::AppHandle,
    subject: String,
) -> Result<Vec<String>, String> {
    let db = app.state::<tauri_plugin_sql::DbPool>();
    
    let result: Vec<(String,)> = tauri_plugin_sql::query(
        &db,
        "SELECT bookTitle FROM books WHERE subject = ? ORDER BY bookTitle"
    )
    .bind(&subject)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(result.into_iter().map(|(title,)| title).collect())
}

#[tauri::command]
pub async fn search_pages(
    app: tauri::AppHandle,
    subject: String,
    search_query: String,
    book_titles: Vec<String>,
) -> Result<SearchResponse, String> {
    let db = app.state::<tauri_plugin_sql::DbPool>();
    
    // Build placeholders for IN clause
    let placeholders = book_titles.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    
    // Build FTS5 MATCH query with word boundaries
    let fts_query = format!("\"{}\"", search_query);
    
    let query = format!(
        "SELECT p.bookTitle, p.pageNum, p.text 
         FROM pages p
         INNER JOIN pages_fts f ON p.id = f.rowid
         WHERE f.text MATCH ?
         AND p.subject = ?
         AND p.bookTitle IN ({})
         ORDER BY p.bookTitle, p.pageNum",
        placeholders
    );
    
    let mut stmt = tauri_plugin_sql::query(&db, &query)
        .bind(&fts_query)
        .bind(&subject);
    
    for title in &book_titles {
        stmt = stmt.bind(title);
    }
    
    let results: Vec<(String, i64, String)> = stmt.await.map_err(|e| e.to_string())?;
    
    // Group results by book title
    let mut grouped: std::collections::HashMap<String, Vec<PageResult>> = std::collections::HashMap::new();
    
    for (book_title, page_num, text) in results {
        grouped.entry(book_title).or_insert_with(Vec::new).push(PageResult {
            page_num,
            text,
        });
    }
    
    let total = grouped.values().map(|v| v.len()).sum();
    
    Ok(SearchResponse {
        message: "Search completed".to_string(),
        results: grouped,
        total,
    })
}

#[tauri::command]
pub async fn upsert_book(
    app: tauri::AppHandle,
    book_data: BookData,
) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::DbPool>();
    
    let now = chrono::Utc::now().to_rfc3339();
    
    tauri_plugin_sql::query(
        &db,
        "INSERT INTO books (subject, bookTitle, fileName, importedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(subject, bookTitle) DO UPDATE SET
         fileName = excluded.fileName,
         updatedAt = excluded.updatedAt"
    )
    .bind(&book_data.subject)
    .bind(&book_data.book_title)
    .bind(&book_data.file_name)
    .bind(&book_data.imported_at)
    .bind(&now)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn upsert_page(
    app: tauri::AppHandle,
    page_data: PageData,
) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::DbPool>();
    
    let now = chrono::Utc::now().to_rfc3339();
    
    tauri_plugin_sql::query(
        &db,
        "INSERT INTO pages (subject, bookTitle, pageNum, text, importedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(subject, bookTitle, pageNum) DO UPDATE SET
         text = excluded.text,
         updatedAt = excluded.updatedAt"
    )
    .bind(&page_data.subject)
    .bind(&page_data.book_title)
    .bind(&page_data.page_num)
    .bind(&page_data.text)
    .bind(&page_data.imported_at)
    .bind(&now)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
