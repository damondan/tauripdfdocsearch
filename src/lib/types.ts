export interface BookData {
  subject: string;
  bookTitle: string;
  fileName: string;
  importedAt: Date;
}

export interface PageResult {
    pageNum: number;
    text: string;
}

export interface PageData {
    subject: string;
    bookTitle: string;
    pageNum: number;
    text: string;
    importedAt: Date;
}

export interface SearchRequestBody {
  selectedSubject: string;
  searchQuery: string;
  pdfBookTitles: string[];
}

export interface SearchResponse {
  message: string;
  results: Record<string, any[]>;
  total: number;
}

export interface ErrorResponse {
  error: string;
}