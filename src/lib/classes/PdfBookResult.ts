export class PdfBookResult {
    private _bookTitle: string;
    private _pageNum: number;
    private _sentence: string;
    private _pageText: string;
    private _isChecked: boolean;
  
    constructor(bookTitle: string, pageNum: number, sentence: string, text: string) {
      this._bookTitle = bookTitle; // e.g., "01PsychiatricStudies"
      this._pageNum = pageNum;     // e.g., 36
      this._sentence = sentence;   // e.g., "The quick brown fox jumps over the lazy dog."
      this._pageText = text;       // Same as sentence for now, adjust if needed
      this._isChecked = false;
    }
  
    get bookTitle(): string {
      return this._bookTitle;
    }
  
    set bookTitle(value: string) {
      this._bookTitle = value;
    }
  
    get pageNum(): number {
      return this._pageNum;
    }
  
    set pageNum(value: number) {
      this._pageNum = value;
    }
  
    get sentence(): string {
      return this._sentence;
    }
  
    set sentence(value: string) {
      this._sentence = value;
    }
  
    get pageText(): string {
      return this._pageText;
    }
  
    set pageText(value: string) {
      this._pageText = value;
    }
  
    get isChecked(): boolean {
      return this._isChecked;
    }
  
    set isChecked(value: boolean) {
      this._isChecked = value;
    }
  
    // Optional: Method to display the result
    toString(): string {
      return `${this.bookTitle} - Page ${this.pageNum}: ${this.sentence}`;
    }
  }
  