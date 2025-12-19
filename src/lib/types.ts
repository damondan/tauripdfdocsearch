export interface BookData {
  subject: string;
  bookTitle: string;
  fileName: string;
  tableOfContents?: string[];
  importedAt: Date;
}

export interface BookWithTOC {
  bookTitle: string;
  tableOfContents?: string[];
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
  results: Record<string, (PageResult | null)[]>;
  total: number;
}

export interface ErrorResponse {
  error: string;
}