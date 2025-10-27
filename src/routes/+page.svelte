<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import type { Writable } from "svelte/store";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import PdfBlock from "$lib/components/PdfBlock.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import { PdfBookResult } from "$lib/classes/PdfBookResult";
  import { searchQueryWritable } from "$lib/store";
  import type { ISearchData } from "$lib";

  let selectedSubject = $state("");
  let setDataPdfSubjects: string[] = $state([]);
  let pdfBooksGetFromSubject: Writable<string[]> = writable([]);
  let pdfBookCheckFromPdfTab: string[] = $state([]);
  let mySearchData = $state<ISearchData | string>({
    message: "",
    results: {},
    total: 0,
  });
  let isLoading: boolean = $state(false);
  let pdfBooksRetFromSearch: any = undefined;
  let pdfBooksAsResultObjects: PdfBookResult[] = $state([]);
  let activeTab: string = $state("pdfs");
  let checkedResults: PdfBookResult[] = [];
  let isCheckAll: boolean = $state(false);
  let pdfLimit: number = 25;
  let totalCount = $derived(pdfBooksAsResultObjects.length);

  // onMount - Load subjects from Tauri DB and initialize
  onMount(async () => {
    try {
      const { getSubjects } = await import('$lib/tauri-db');
      setDataPdfSubjects = await getSubjects();
      
      if (setDataPdfSubjects.length > 0) {
        console.log("In onMount, subjects loaded:", setDataPdfSubjects);
        selectedSubject = setDataPdfSubjects[0]; // Set default to the first subject
        // Automatically trigger the fetch for the first subject
        handleLoadPdfTitlesFromSubject(selectedSubject);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  });

  function openTab(tabName: string): void {
    console.log("Open tab:", tabName);
    activeTab = tabName;
  }

  function handleSubjectChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const subject: string = target.value;
    selectedSubject = subject;

    if (subject) {
      // Trigger fetching based on subject
      handleLoadPdfTitlesFromSubject(subject);
    } else {
      pdfBooksGetFromSubject.set([]); // Clear the PDF books if no subject is selected
    }
  }

  //handleLoadPdfTitlesFromSubject - takes a subject as argument and calls Tauri
  //command to return just the titles of those pdf books by subject which
  //is the folder name.
  async function handleLoadPdfTitlesFromSubject(
    subject: string,
  ): Promise<void> {
    try {
      pdfBooksAsResultObjects = [];
      const { getBookTitlesBySubject } = await import('$lib/tauri-db');
      const data: string[] = await getBookTitlesBySubject(subject);

      pdfBooksGetFromSubject.set(data || []);
    } catch (error) {
      console.error("Error fetching PDF titles:", error);
    }
  }

  //This refers to the spinner - it is an event listener for the +page.svelte component
  //or parent that is set in the SearchBar component below - on:loadingChange={handleLoadingChange}
  //SearchBar component dispatches - dispatch('loadingChange', loading); loading is a boolean.
  //Below there is an - if isLoading is true or false which displays the spinner.
  function handleLoadingChange(event: CustomEvent<boolean>): void {
    isLoading = event.detail;
  }

  //This is also an event listener for +page.svelte or the parent component to the
  //SearchBar child component. SearchBar below on:searchResults={handleLoadPdfDataFromPdfTab}.
  //In SearchBar component - dispatch('searchResults', result);
  //The result is passed as searchResults and when that variable is set with the results,
  //it executes the below function through it being used as an event listener with the data
  //in results. mySearchData, being json data, is taken in by mySearchData, which uses 2
  //interfaces to configure with the json data. Lastly, it steps through the array to
  //input the pdf attributes into creating a PdfBookResult object that is than stored into
  //a pdfBooksAsResultObjects array.
  // Replace the existing handleLoadPdfDataFromPdfTab function with this updated version:
  function handleLoadPdfDataFromPdfTab(event: CustomEvent): void {
    mySearchData = event.detail;
    console.log(
      "Received search results in parent(mySearchData):",
      mySearchData,
    );

    // Type guard to check if it's a string
    if (typeof mySearchData === "string") {
      // Handle string cases
      if (mySearchData === "noSearchTermAndNoPdfs") {
        console.log("Both search term and PDFs are missing");
        alert("Add a Search Word and choose a Pdf book/books");
      } else if (mySearchData === "noPdfCheckBoxesChecked") {
        console.log("NO Pdfs chosen");
        alert("Choose a Pdf.");
      } else if (mySearchData === "pdfsOverLimit") {
        alert("Pdf book search limit is " + pdfLimit);
      } else if (mySearchData === "noSearchTerm") {
        console.log("No search term provided");
        alert("Add a Search Term");
      }
      return;
    }

    if (
      mySearchData.results != null &&
      Object.keys(mySearchData.results).length > 0
    ) {
      pdfBooksRetFromSearch = Object.keys(mySearchData.results);
      pdfBooksAsResultObjects = [];
      console.log(
        "clearing pdfBooksAsResultObjects in handleLoadPdfDataFromPdfTab adding to the " +
          "results objects",
      );
      if (pdfBooksRetFromSearch != null) {
        for (let i = 0; i < pdfBooksRetFromSearch.length; i++) {
          const matches = mySearchData.results[pdfBooksRetFromSearch[i]];

          for (const { pageNum, text } of matches) {
            const sentence = findSentenceForPdfPage(text, $searchQueryWritable);
            pdfBooksAsResultObjects.push(
              new PdfBookResult(
                pdfBooksRetFromSearch[i],
                pageNum,
                sentence,
                text,
              ),
            );
          }
        }
      } else {
        pdfBooksAsResultObjects = [];
        console.log("clearing pdfBooksAsResultObjects - else is null");
      }
    } else {
      alert("Search returned 0 for " + $searchQueryWritable);
    }
  }

  //In clicking the Download button displayed in the Results tab, this function is executed. The checkedResults
  //data is initialized through the handleCheckboxChangeForPdfBlock function below. handleCheckboxChangeForPdfBlock is
  //an event listener for the +page.svelte component or parent to the PdfBlock component or child.
  //Below -> <PdfBlock {result} on:delete={handleDeleteForPdfBlock} on:change={(e) => handleCheckboxChangeForPdfBlock(result, e)}
  //checkedResults is formatted below to set the downloaded text in a more readable manner.
  function handleDownloadPdfsForPdfBlock(): void {
    console.log("In handleDownloadPdfsForPdfBlock");
    const today = new Date().toISOString().split("T")[0];

    const checkedResultsBlob = checkedResults
      .map(
        (result) =>
          `${result.bookTitle}, Page ${result.pageNum}: ${result.sentence}\n\n` +
          `${result.pageText}\n`,
      )
      .join("\n");

    const blob = new Blob([checkedResultsBlob], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${$searchQueryWritable}-${today}-docsveltedwnld.txt`;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  //Used in handleLoadPdfDataFromPdfTab(event) to return the sentence within the page which
  //holds the searchQuery term. The sentence is placed initially in the PdfBlock as a quick
  //reference and in wanting to look further, can click on the block to open the full page.
  const findSentenceForPdfPage = (text: string, subject: string): string => {
    if (!text || !subject) return "No page text or sentence found";

    const errSubject = subject.toLowerCase();
    const sub = `\\b${subject}\\b`;

    const sentenceRegex = new RegExp(`[^.?!]*${sub}[^.?!]*(?:[.?!]|$)`, "gi");
    const match = sentenceRegex.exec(text);

    if (match) {
      return match[0].trim();
    } else {
      return `No sentence found containing "${errSubject}".`;
    }
  };

  //handleCheckboxChangeForPdfBlock is an event listener for the +page.svelte component
  //or parent to the PdfBlock component or child.
  //Below -> <PdfBlock {result} on:delete={handleDeleteForPdfBlock}
  //on:change={(e) => handleCheckboxChangeForPdfBlock(result, e)}
  //The parent listens for a dipatch from PdfBlock -> dispatch('change', { result, checked });
  //checkedResults is set with the proper array of PdfBookResult which has been checked
  //in the Results tab.
  function handleCheckboxChangeForPdfBlock(
    result: PdfBookResult,
    event: CustomEvent,
  ): void {
    console.log("IN handleCheckboxChangeForPdfBlock");
    result.isChecked = event.detail.checked;
    console.log("result is ", result);

    if (event.detail.checked) {
      checkedResults.push(result);
      console.log("checkedResults adding ", checkedResults);
    } else {
      checkedResults = checkedResults.filter((r) => r !== result);
      console.log("checkedResults deleting ", checkedResults);
    }

    console.log("Checked results:", checkedResults);
    for (let i = 0; i < checkedResults.length; i++) {
      console.log("Number " + i + " " + checkedResults[i]);
    }
  }

  //This checks all of the pdf book titles from the pdf tab.
  //<input type="checkbox" id="checkall-id" bind:checked={isCheckAll}
  //onchange={handleCheckAll}/>
  // If the Pdf tab is open, this checkbox will appear. isCheckAll is initialized on
  //change from a $derived rune functionality. If there is equality in the derived
  //attributes, the isAllChecked is updated to true, to than execute and update the
  //isCheckAll to true.
  function handleCheckAll(event: Event): void {
    const target = event.target as HTMLInputElement;

    isCheckAll = target.checked;

    if (isCheckAll) {
      pdfBookCheckFromPdfTab = $pdfBooksGetFromSubject;
    } else {
      pdfBookCheckFromPdfTab = [];
    }
  }

  let isAllChecked = $derived(
    pdfBookCheckFromPdfTab.length === $pdfBooksGetFromSubject.length &&
      $pdfBooksGetFromSubject.length > 0,
  );
  $effect(() => {
    isCheckAll = isAllChecked;
  });

  function handleDeleteForPdfBlock(event: CustomEvent): void {
    const resultToDelete = event.detail; // Assuming PdfBlock emits the result
    pdfBooksAsResultObjects = pdfBooksAsResultObjects.filter(
      (r) => r !== resultToDelete,
    );
  }
</script>

<svelte:head>
  <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css" />
</svelte:head>

<div
  class="grid grid-cols-3 grid-rows-[auto_auto_auto_1fr_auto] gap-1 bg-gradient-to-b from-primary to-secondary p-1
min-h-screen relative [grid-template-areas:'routing_routing_routing'_'header_header_header'_'download-r-checkall-buttons_tab-bar_pdfsubjects-dropdnlist'_'tab-content_tab-content_tab-content'_'footer_footer_footer']"
>
  {#if activeTab == "results"}
    <div class="[grid-area:download-r-checkall-buttons] flex flex-col sm:flex-row justify-start items-start sm:items-end ml-[15%] pb-2 gap-2">
      <input
        type="button"
        id="download-id"
        value="Download"
        onclick={handleDownloadPdfsForPdfBlock}
        class="!text-base sm:!text-lg md:!text-xl lg:!text-2xl text-white px-4 py-2 cursor-pointer border-[#333333]
        bg-[#3e228c] hover:bg-[#3206de] rounded-md ml-5 mb-1 font-comic shadow-soft"
      />
      <div class="total-count w-auto sm:w-36 h-auto sm:h-10 ml-5 sm:ml-0 rounded-md">
        <p class="w-full text-black font-comic font-light !text-base sm:!text-lg md:!text-xl lg:!text-2xl text-left sm:text-center
           overflow-visible whitespace-nowrap m-0">
          Results {totalCount}
        </p>
      </div>
    </div>
  {:else}
    <div
      class="[grid-area:download-r-checkall-buttons] flex justify-start items-end ml-[15%] pb-2"
    >
      <input
        type="checkbox"
        id="checkall-id"
        bind:checked={isCheckAll}
        onchange={handleCheckAll}
        class="w-5 h-5 scale-150 cursor-pointer ml-5 mb-2 shadow-soft"
      />
    </div>
  {/if}
  <div class="header [grid-area:header] text-center">
    <h1
      class="font-comic !text-6xl text-red-500 tracking-wider font-normal"
      style="text-shadow: 0px 8px 8px rgba(0, 0, 0, 0.3);">
      Pdf Search TS
    </h1>
    <SearchBar
      {selectedSubject}
      pdfBookTitles={pdfBookCheckFromPdfTab}
      on:searchResults={handleLoadPdfDataFromPdfTab}
      on:loadingChange={handleLoadingChange}
    />
    {#if isLoading}
      <div class="spinner-overlay tw-spinner-overlay">
        <div class="spinner custom-spinner"></div>
      </div>
    {/if}
  </div>
  {#if activeTab !== "results"}
    <div
      class="pdfsubjects-dropdnlist [grid-area:pdfsubjects-dropdnlist] text-base flex
       flex-col items-end justify-end mr-[15%] w-50 ml-auto"
    >
      <label
        for="pdf-options"
        id="pdf-label"
        class="pdf-label self-start mb-1 text-center w-full !text-xl font-black
           font-comic tracking-wider2 text-gray-900">PDF Subjects:</label
      >
      <select
        onchange={handleSubjectChange}
        class="w-full p-1 border border-gray-300 rounded-md bg-gray-100 !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-comic"
      >
        <!-- <option value="" disabled>Select a subject</option> -->
        {#each setDataPdfSubjects as pdfSubject}
          <option
            id="pdfsubject"
            class="pdfsubject font-comic"
            value={pdfSubject}>{pdfSubject}</option
          >
        {/each}
      </select>
    </div>
  {/if}
  <div
    class="tab-bar [grid-area:tab-bar] w-full flex justify-center bg-white
       h-10 rounded-md mt-2"
  >
    <div class="w3-row w-full rounded-md" role="tablist">
      <button type="button" onclick={() => openTab("pdfs")} role="tab" aria-selected={activeTab === "pdfs"} class="w3-half tablink w3-bottombar w3-hover-light-grey w3-padding
          w-1/2 rounded-md !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-comic tracking-wider2 font-normal bg-white
          text-center {activeTab === 'pdfs' ? 'active w3-border-green' : ''}">
          Pdfs
      </button>
      <button type="button" onclick={() => openTab("results")} role="tab" aria-selected={activeTab === "results"} class="w3-half tablink w3-bottombar w3-hover-light-grey w3-padding
          w-1/2 rounded-md !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-comic tracking-wider2 font-normal bg-white
          text-center {activeTab === 'results' ? 'active w3-border-green' : ''}">
          Results
      </button>
    </div>
  </div>
  <div
    class="tab-content [grid-area:tab-content] w-[90%] ml-[5%] mr-[5%] bg-white p-2 rounded-lg mt-3"
  >
    <div
      id="pdfs"
      class="w3-container tab w-full max-w-full overflow-hidden"
      style:display={activeTab === "pdfs" ? "block" : "none"}
    >
      {#if $pdfBooksGetFromSubject.length > 0}
        <ul class="pdf-titles-list list-none p-0 m-0 text-left w-full">
          {#each $pdfBooksGetFromSubject as title}
            <li
              class="pdf-title-block mb-2 border-b border-gray-300 pb-1 hover:bg-gray-100 flex items-start gap-2 w-full max-w-full"
            >
              <input
                type="checkbox"
                id={title}
                class="pdf-title-item w-4 h-4 mt-1 scale-150 cursor-pointer flex-shrink-0"
                bind:group={pdfBookCheckFromPdfTab}
                value={title}
              />
              <label
                for={title}
                class="pdf-title-label !text-base sm:!text-lg md:!text-xl lg:!text-2xl font-bold font-comic tracking-wider2 break-words overflow-wrap-anywhere leading-tight flex-1 cursor-pointer min-w-0 max-w-full overflow-hidden"
                >{title}</label
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div
      id="results"
      class="w3-container tab w-full max-w-full overflow-hidden"
      style:display={activeTab === "results" ? "block" : "none"}
    >
      {#each pdfBooksAsResultObjects as result}
        <PdfBlock
          {result}
          on:delete={handleDeleteForPdfBlock}
          on:change={(e) => handleCheckboxChangeForPdfBlock(result, e)}
        />
      {/each}
    </div>
  </div>

  <div class="footer [grid-area:footer]">
    <Footer />
  </div>
</div>
