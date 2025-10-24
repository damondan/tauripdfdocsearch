use serde::{Deserialize, Serialize};
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

// Simple wrapper to return just the subject strings
#[tauri::command]
pub async fn get_subjects() -> Result<Vec<String>, String> {
    // Placeholder - frontend will call SQL directly via plugin
    Ok(vec![])
}

#[tauri::command]
pub async fn get_book_titles_by_subject(subject: String) -> Result<Vec<String>, String> {
    // Placeholder - frontend will call SQL directly via plugin
    Ok(vec![])
}

#[tauri::command]
pub async fn search_pages(
    subject: String,
    search_query: String,
    book_titles: Vec<String>,
) -> Result<SearchResponse, String> {
    // Placeholder - frontend will call SQL directly via plugin
    Ok(SearchResponse {
        message: "Not implemented".to_string(),
        results: HashMap::new(),
        total: 0,
    })
}

#[tauri::command]
pub async fn upsert_book(book_data: BookData) -> Result<(), String> {
    // Placeholder - frontend will call SQL directly via plugin
    Ok(())
}

#[tauri::command]
pub async fn upsert_page(page_data: PageData) -> Result<(), String> {
    // Placeholder - frontend will call SQL directly via plugin  
    Ok(())
}
