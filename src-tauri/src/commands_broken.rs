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

async fn get_db(app: &tauri::AppHandle) -> Result<tauri_plugin_sql::Db, String> {
    let db = app.state::<tauri_plugin_sql::DbInstances>();
    db.get("sqlite:pdfsearch.db").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_subjects(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let db = get_db(&app).await?;
    
    let query = "SELECT DISTINCT subject FROM books ORDER BY subject";
    let result: Vec<serde_json::Value> = tauri_plugin_sql::query(&db, query)
        .await
        .map_err(|e| e.to_string())?;
    
    let subjects: Vec<String> = result.iter()
        .filter_map(|row| {
            row.as_array()
                .and_then(|arr| arr.get(0))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .collect();
    
    Ok(subjects)
}

#[tauri::command]
pub async fn get_book_titles_by_subject(
    app: tauri::AppHandle,
    subject: String,
) -> Result<Vec<String>, String> {
    let db = get_db(&app).await?;
    
    let query = "SELECT bookTitle FROM books WHERE subject = ? ORDER BY bookTitle";
    let result: Vec<serde_json::Value> = tauri_plugin_sql::query(&db, query)
        .bind(&subject)
        .await
        .map_err(|e| e.to_string())?;
    
    let titles: Vec<String> = result.iter()
        .filter_map(|row| {
            row.as_array()
                .and_then(|arr| arr.get(0))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .collect();
    
    Ok(titles)
}

#[tauri::command]
pub async fn search_pages(
    app: tauri::AppHandle,
    subject: String,
    search_query: String,
    book_titles: Vec<String>,
) -> Result<SearchResponse, String> {
    let db = get_db(&app).await?;
    
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
    
    let results: Vec<serde_json::Value> = stmt.await.map_err(|e| e.to_string())?;
    
    // Group results by book title
    let mut grouped: HashMap<String, Vec<PageResult>> = HashMap::new();
    
    for row in results {
        if let Some(arr) = row.as_array() {
            if arr.len() >= 3 {
                let book_title = arr[0].as_str().unwrap_or("").to_string();
                let page_num = arr[1].as_i64().unwrap_or(0);
                let text = arr[2].as_str().unwrap_or("").to_string();
                
                grouped.entry(book_title).or_insert_with(Vec::new).push(PageResult {
                    page_num,
                    text,
                });
            }
        }
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
    let db = get_db(&app).await?;
    
    let now = chrono::Utc::now().to_rfc3339();
    
    let query = "INSERT INTO books (subject, bookTitle, fileName, importedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(subject, bookTitle) DO UPDATE SET
         fileName = excluded.fileName,
         updatedAt = excluded.updatedAt";
    
    tauri_plugin_sql::query(&db, query)
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
    let db = get_db(&app).await?;
    
    let now = chrono::Utc::now().to_rfc3339();
    
    let query = "INSERT INTO pages (subject, bookTitle, pageNum, text, importedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(subject, bookTitle, pageNum) DO UPDATE SET
         text = excluded.text,
         updatedAt = excluded.updatedAt";
    
    tauri_plugin_sql::query(&db, query)
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
