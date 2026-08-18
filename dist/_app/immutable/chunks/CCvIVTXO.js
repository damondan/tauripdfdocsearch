import{i as u}from"./BDPGcIsz.js";class r{constructor(t){this.path=t}static async load(t){const s=await u("plugin:sql|load",{db:t});return new r(s)}static get(t){return new r(t)}async execute(t,s){const[a,d]=await u("plugin:sql|execute",{db:this.path,query:t,values:s??[]});return{lastInsertId:d,rowsAffected:a}}async select(t,s){return await u("plugin:sql|select",{db:this.path,query:t,values:s??[]})}async close(t){return await u("plugin:sql|close",{db:t})}}let i=null;async function c(){if(i)return i;try{return i=await r.load("sqlite:pdfsearch.db"),console.log("✅ Database connected successfully"),i}catch(e){throw console.error("❌ Failed to load SQLite database",e),new Error(e instanceof Error?`Database initialization failed: ${e.message}`:"Database initialization failed due to an unknown error")}}async function $(){console.log("🔍 getSubjects called");const e=await c(),t=await e.select("PRAGMA database_list");console.log("🗂️ DB INFO:",t),console.log("📊 Running query: SELECT DISTINCT subject FROM books ORDER BY subject");const s=await e.select("SELECT DISTINCT subject FROM books ORDER BY subject");return console.log("📚 Query result:",s),console.log("📚 Subjects loaded:",s.map(a=>a.subject)),s.map(a=>a.subject)}async function j(e){return(await(await c()).select("SELECT bookTitle, tableOfContents FROM books WHERE subject = $1 ORDER BY bookTitle",[e])).map(a=>({bookTitle:a.bookTitle,tableOfContents:a.tableOfContents?JSON.parse(a.tableOfContents):void 0}))}async function A(e,t,s){const a=await c(),d=s.map((o,l)=>`$${l+3}`).join(","),N=`"${t}"`,f=`
    SELECT p.bookTitle, p.pageNum, p.text 
    FROM pages p
    INNER JOIN pages_fts f ON p.id = f.rowid
    WHERE f.text MATCH $1
    AND p.subject = $2
    AND p.bookTitle IN (${d})
    ORDER BY p.bookTitle, p.pageNum
  `,T=[N,e,...s],m=await a.select(f,T),n={};for(const o of m){n[o.bookTitle]||(n[o.bookTitle]=[]);const b=await a.select(`
      SELECT pageNum, text 
      FROM pages 
      WHERE bookTitle = $1 
      AND subject = $2 
      AND pageNum IN ($3, $4, $5)
      ORDER BY pageNum
    `,[o.bookTitle,e,o.pageNum-1,o.pageNum,o.pageNum+1]),p=new Map(b.map(g=>[g.pageNum,g])),E=p.get(o.pageNum-1)||null,w={pageNum:o.pageNum,text:o.text},R=p.get(o.pageNum+1)||null;n[o.bookTitle].length,n[o.bookTitle].push(E,w,R)}const O=Object.values(n).reduce((o,l)=>o+l.filter(b=>b!==null).length,0);return{message:"Search completed",results:n,total:O}}async function k(e){const t=await c(),s=new Date().toISOString(),a=e.tableOfContents?JSON.stringify(e.tableOfContents):null;await t.execute(`INSERT INTO books (subject, bookTitle, fileName, tableOfContents, importedAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(subject, bookTitle) DO UPDATE SET
     fileName = excluded.fileName,
     tableOfContents = excluded.tableOfContents,
     updatedAt = excluded.updatedAt`,[e.subject,e.bookTitle,e.fileName,a,e.importedAt,s])}async function C(e){const t=await c(),s=new Date().toISOString();await t.execute(`INSERT INTO pages (subject, bookTitle, pageNum, text, importedAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(subject, bookTitle, pageNum) DO UPDATE SET
     text = excluded.text,
     updatedAt = excluded.updatedAt`,[e.subject,e.bookTitle,e.pageNum,e.text,e.importedAt,s])}export{j as getBookTitlesBySubject,$ as getSubjects,A as searchPages,k as upsertBook,C as upsertPage};
