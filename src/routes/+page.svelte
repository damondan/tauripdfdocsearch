<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import type { Writable } from 'svelte/store';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import PdfBlock from '$lib/components/PdfBlock.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { PdfBookResult } from '$lib/classes/PdfBookResult';
	import { searchQueryWritable } from '$lib/store';
	import type { ISearchData } from '$lib';

	let selectedSubjectString = $state('');
	let pdfSubjectsStrings_Array: string[] = $state([]);
	let pdfBookStrings_Array: Writable<string[]> = writable([]);
	let pdfBookCheckedStrings_Array: string[] = $state([]);
	let mySearchData = $state<ISearchData | string>({
		message: '',
		results: {},
		total: 0
	});
	let isLoading: boolean = $state(false);
	let pdfBooksRetFromSearch: any = undefined;
	let pdfBooksAsResultObjectsArray: PdfBookResult[] = $state([]);
	let activeTab: string = $state('pdfs');
	let checkedResults: PdfBookResult[] = $state([]);
	let checkedResultsGroup: PdfBookResult[] = $state([]);
	let isCheckAll: boolean = $state(false);
	let isCheckAllResults: boolean = $state(false);
	let pdfLimit: number = 25;
	let totalCount = $derived(pdfBooksAsResultObjectsArray.length);

	// onMount - Load subjects from Tauri DB and initialize
	onMount(async () => {
		try {
			const { getSubjects } = await import('$lib/tauri-db');
			pdfSubjectsStrings_Array = await getSubjects();

			if (pdfSubjectsStrings_Array.length > 0) {
				//console.log('In onMount, subjects loaded:', pdfSubjectsStrings_Array);
				selectedSubjectString = pdfSubjectsStrings_Array[0]; // Set default to the first subject
				// Automatically trigger the fetch for the first subject
				handleLoadPdfTitlesFromSubject(selectedSubjectString);
			}
		} catch (error) {
			console.error('Error loading subjects:', error);
		}
	});

	function openTab(tabName: string): void {
		//console.log('Open tab:', tabName);
		activeTab = tabName;
	}

	function handleSubjectChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		const subject: string = target.value;
		selectedSubjectString = subject;

		if (subject) {
			// Trigger fetching based on subject
			handleLoadPdfTitlesFromSubject(subject);
		} else {
			pdfBookStrings_Array.set([]); // Clear the PDF books if no subject is selected
		}
	}

	//handleLoadPdfTitlesFromSubject - takes a subject as argument and calls Tauri
	//command to return just the titles of those pdf books by subject which
	//is the folder name.
	async function handleLoadPdfTitlesFromSubject(subject: string): Promise<void> {
		try {
			pdfBooksAsResultObjectsArray = [];
			const { getBookTitlesBySubject } = await import('$lib/tauri-db');
			const data: string[] = await getBookTitlesBySubject(subject);

			pdfBookStrings_Array.set(data || []);
		} catch (error) {
			console.error('Error fetching PDF titles:', error);
		}
	}

	//This refers to the spinner - it is a callback for the +page.svelte component
	//or parent that is set in the SearchBar component below - onloadingChange={handleLoadingChange}
	//SearchBar component calls - onloadingChange?.(loading); loading is a boolean.
	//Below there is an - if isLoading is true or false which displays the spinner.
	function handleLoadingChange(loading: boolean): void {
		isLoading = loading;
	}

	function cleanTextSpacing(text: string): string {
	  if (!text) return text;

	  let cleaned = text.replace(/\b(\w)\s+(?=\w)/g, (match, char, offset, string) => {
	    const nextChar = string[offset + match.length];
	    if (nextChar && nextChar === nextChar.toLowerCase() && char.length === 1) {
	      return char; // Remove the space
	    }
	    return match; // Keep the space (it's a normal word boundary)
	  });

	  // Second, collapse multiple consecutive spaces into a single space
	  cleaned = cleaned.replace(/\s{2,}/g, ' ');

	  return cleaned.trim();
	}

	//This is a callback for +page.svelte or the parent component to the
	//SearchBar child component. SearchBar below onsearchResults={handleLoadPdfDataFromPdfTab}.
	//In SearchBar component - onsearchResults?.(result);
	//The result is passed as searchResults and when that variable is set with the results,
	//it executes the below function through it being used as a callback with the data
	//in results. mySearchData, being json data, is taken in by mySearchData, which uses 2
	//interfaces to configure with the json data. Lastly, it steps through the array to
	//input the pdf attributes into creating a PdfBookResult object that is than stored into
	//a pdfBooksAsResultObjects array.
	// Replace the existing handleLoadPdfDataFromPdfTab function with this updated version:
	function handleLoadPdfBlockData(data: ISearchData | string): void {
		mySearchData = data;
		//console.log('Received search results in parent(mySearchData):', mySearchData);

		// Clear checkedResults when a new search is performed
		checkedResults = [];
		checkedResultsGroup = [];
		isCheckAllResults = false;
		//console.log('Cleared checkedResults for new search');

		// Type guard to check if it's a string
		if (typeof mySearchData === 'string') {
			// Handle string cases
			if (mySearchData === 'noSearchTermAndNoPdfs') {
				//console.log('Both search term and PDFs are missing');
				alert('Add a Search Word and choose a Pdf book/books');
			} else if (mySearchData === 'noPdfCheckBoxesChecked') {
				//console.log('NO Pdfs chosen');
				alert('Choose a Pdf.');
			} else if (mySearchData === 'pdfsOverLimit') {
				alert('Pdf book search limit is ' + pdfLimit);
			} else if (mySearchData === 'noSearchTerm') {
				//console.log('No search term provided');
				alert('Add a Search Term');
			}
			return;
		}

		if (mySearchData.results != null && Object.keys(mySearchData.results).length > 0) {
			pdfBooksRetFromSearch = Object.keys(mySearchData.results);
			pdfBooksAsResultObjectsArray = [];
			//console.log(
			// 	'clearing pdfBooksAsResultObjects in handleLoadPdfDataFromPdfTab adding to the ' +
			// 		'results objects'
			// );
			if (pdfBooksRetFromSearch != null) {
				for (let i = 0; i < pdfBooksRetFromSearch.length; i++) {
					const matches = mySearchData.results[pdfBooksRetFromSearch[i]];

					for (const { pageNum, text } of matches) {
            //console.log("The page is ..." + text);
						//const cleanedText = cleanTextSpacing(text);
            //console.log("After cleanup " + cleanedText);
						//const sentence = findSentenceForPdfPage(cleanedText, $searchQueryWritable);
            const sentence = findSentenceForPdfPage(text, $searchQueryWritable);
						//const cleanedSentence = cleanTextSpacing(sentence);
            console.log('Book title strings ' + pdfBooksRetFromSearch[i]);
						pdfBooksAsResultObjectsArray.push(
							//new PdfBookResult(pdfBooksRetFromSearch[i], pageNum, cleanedSentence, cleanedText)
              new PdfBookResult(pdfBooksRetFromSearch[i], pageNum, sentence, text)
						);
					}
				}
			} else {
				pdfBooksAsResultObjectsArray = [];
				//console.log('clearing pdfBooksAsResultObjects - else is null');
			}
		} else {
			alert('Search returned 0 for ' + $searchQueryWritable);
		}
	}

	//In clicking the Download button displayed in the Results tab, this function is executed. The checkedResults
	//data is initialized through the handleCheckboxChangeForPdfBlock function below. handleCheckboxChangeForPdfBlock is
	//a callback for the +page.svelte component or parent to the PdfBlock component or child.
	//Below -> <PdfBlock {result} ondelete={handleDeleteForPdfBlock} onchange={(result, checked) => handleCheckboxChangeForPdfBlock(result, checked)}
	//checkedResults is formatted below to set the downloaded text in a more readable manner.
	async function handleDownloadPdfsForPdfBlock(): Promise<void> {
		//console.log('In handleDownloadPdfsForPdfBlock');
		//console.log('checkedResultsGroup length:', checkedResultsGroup.length);
		//console.log('checkedResultsGroup:', checkedResultsGroup);

		if (checkedResultsGroup.length === 0) {
			alert('Please select at least one PDF block to download');
			return;
		}

		const today = new Date().toISOString().split('T')[0];
		const defaultFilename = `${$searchQueryWritable}-${today}`;

		const checkedResultsContent = checkedResultsGroup
			.map((result) => `${result.bookTitle}, Page ${result.pageNum}: ${result.pageText}\n`)
			.join('\n');

		//console.log('Download content length:', checkedResultsContent.length);

		try {
			const { save } = await import('@tauri-apps/plugin-dialog');
			const { writeTextFile } = await import('@tauri-apps/plugin-fs');

			const filePath = await save({
				defaultPath: defaultFilename,
				filters: [
					{
						name: 'Text',
						extensions: ['txt']
					}
				]
			});

			if (filePath) {
				await writeTextFile(filePath, checkedResultsContent);
				//console.log('File saved successfully to:', filePath);
				alert('File downloaded successfully!');
			}
		} catch (error) {
			console.error('Error saving file:', error);
			alert('Error saving file: ' + error);
		}
	}

	//Used in handleLoadPdfDataFromPdfTab(event) to return the sentence within the page which
	//holds the searchQuery term. The sentence is placed initially in the PdfBlock as a quick
	//reference and in wanting to look further, can click on the block to open the full page.
	const findSentenceForPdfPage = (text: string, subject: string): string => {
		if (!text || !subject) return 'No page text or sentence found';

		const errSubject = subject.toLowerCase();
		const sub = `\\b${subject}\\b`;

		const sentenceRegex = new RegExp(`[^.?!]*${sub}[^.?!]*(?:[.?!]|$)`, 'gi');
		const match = sentenceRegex.exec(text);

		if (match) {
			return match[0].trim();
		} else {
			return `No sentence found containing "${errSubject}".`;
		}
	};

	//handleCheckboxChangeForPdfBlock is a callback for the +page.svelte component
	//or parent to the PdfBlock component or child.
	//Below -> <PdfBlock {result} ondelete={handleDeleteForPdfBlock}
	//onchange={(result, checked) => handleCheckboxChangeForPdfBlock(result, checked)}
	//The parent receives callback from PdfBlock -> onchange(result, checked);
	//checkedResults is set with the proper array of PdfBookResult which has been checked
	//in the Results tab.
	function handleCheckboxChangeForPdfBlock(result: PdfBookResult, checked: boolean): void {
		//console.log('[+page] IN handleCheckboxChangeForPdfBlock');
		//console.log('[+page] result param:', result);
		//console.log('[+page] checked param:', checked);
		result.isChecked = checked;
		//console.log('[+page] result.isChecked set to:', result.isChecked);

		if (checked) {
			checkedResults = [...checkedResults, result];
			//console.log('[+page] checkedResults adding ', checkedResults);
		} else {
			checkedResults = checkedResults.filter((r) => r !== result);
			//console.log('[+page] checkedResults deleting ', checkedResults);
		}

		//console.log('[+page] Checked results:', checkedResults);
		//console.log('[+page] Checked results length:', checkedResults.length);
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
		const checked = target.checked;

		if (checked) {
			pdfBookCheckedStrings_Array = $pdfBookStrings_Array;
		} else {
			pdfBookCheckedStrings_Array = [];
		}
	}

	//handleCheckAllResults(event: Event): void
	//Handles checking/unchecking all PdfBlock results in the Results tab.
	function handleCheckAllResults(event: Event): void {
		//console.log('handleCheckAllResults called');
		const target = event.target as HTMLInputElement;
		const checked = target.checked;
		//console.log('checked:', checked);
		//console.log('pdfBooksAsResultObjectsArray length:', pdfBooksAsResultObjectsArray.length);

		pdfBooksAsResultObjectsArray.forEach((result) => {
			//console.log('Setting result.isChecked to:', checked, 'for:', result.bookTitle);
			result.isChecked = checked;
		});

		// Trigger reactivity by reassigning the array
		pdfBooksAsResultObjectsArray = [...pdfBooksAsResultObjectsArray];
		//console.log(
		// 	'Array reassigned, first result.isChecked:',
		// 	pdfBooksAsResultObjectsArray[0]?.isChecked
		// );

		if (checked) {
			checkedResultsGroup = [...pdfBooksAsResultObjectsArray];
		} else {
			checkedResultsGroup = [];
		}
		//console.log('checkedResultsGroup length:', checkedResultsGroup.length);
	}

	//handleCheckboxChangeForResults(result: PdfBookResult, checked: boolean): void
	//Callback from PdfBlock when individual checkbox is toggled.
	function handleCheckboxChangeForResults(result: PdfBookResult, checked: boolean): void {
		result.isChecked = checked;

		if (checked) {
			if (!checkedResultsGroup.includes(result)) {
				checkedResultsGroup = [...checkedResultsGroup, result];
			}
		} else {
			checkedResultsGroup = checkedResultsGroup.filter((r) => r !== result);
			if (isCheckAllResults) {
				isCheckAllResults = false;
			}
		}
	}

	let isAllChecked = $derived(
		pdfBookCheckedStrings_Array.length === $pdfBookStrings_Array.length &&
			$pdfBookStrings_Array.length > 0
	);
	$effect(() => {
		//console.log('isAllChecked fired !!!');
		isCheckAll = isAllChecked;
	});

	function handleDeleteForPdfBlock(result: PdfBookResult): void {
		pdfBooksAsResultObjectsArray = pdfBooksAsResultObjectsArray.filter((r) => r !== result);
	}
</script>

<svelte:head>
	<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css" />
</svelte:head>

<div
	class="from-primary to-secondary relative grid min-h-screen grid-cols-3 grid-rows-[auto_auto_auto_1fr_auto] gap-1
bg-gradient-to-b p-1 [grid-template-areas:'routing_routing_routing'_'header_header_header'_'download-r-checkall-buttons_tab-bar_pdfsubjects-dropdnlist'_'tab-content_tab-content_tab-content'_'footer_footer_footer']"
>
	{#if activeTab == 'results'}
		<div
			class="ml-[15%] flex flex-col items-start justify-start gap-2 pb-2 [grid-area:download-r-checkall-buttons] sm:flex-row sm:items-end"
		>
			<input
				type="checkbox"
				id="checkall-results-id"
				bind:checked={isCheckAllResults}
				onchange={handleCheckAllResults}
				class="shadow-soft mb-2 ml-5 h-5 w-5 scale-150 cursor-pointer"
			/>
			<input
				type="button"
				id="download-id"
				value="Download"
				onclick={handleDownloadPdfsForPdfBlock}
				class="font-comic shadow-soft mb-1 ml-5 cursor-pointer rounded-md border-[#333333] bg-[#3e228c] px-4
        py-2 !text-base text-white hover:bg-[#3206de] sm:!text-lg md:!text-xl lg:!text-2xl"
			/>
			<div class="total-count ml-5 h-auto w-auto rounded-md sm:ml-0 sm:h-10 sm:w-36">
				<p
					class="font-comic m-0 w-full overflow-visible text-left !text-base font-light whitespace-nowrap text-black sm:text-center
           sm:!text-lg md:!text-xl lg:!text-2xl"
				>
					Results {totalCount}
				</p>
			</div>
		</div>
	{:else}
		<div class="ml-[15%] flex items-end justify-start pb-2 [grid-area:download-r-checkall-buttons]">
			<input
				type="checkbox"
				id="checkall-id"
				bind:checked={isCheckAll}
				onchange={handleCheckAll}
				class="shadow-soft mb-2 ml-5 h-5 w-5 scale-150 cursor-pointer"
			/>
		</div>
	{/if}
	<div class="header text-center [grid-area:header]">
		<h1
			class="font-comic !text-6xl font-normal tracking-wider text-red-500"
			style="text-shadow: 0px 8px 8px rgba(0, 0, 0, 0.3);"
		>
			Pdf Search TS
		</h1>
		{#if activeTab !== 'results'}
			<SearchBar
				selectedSubject={selectedSubjectString}
				pdfBookTitles={pdfBookCheckedStrings_Array}
				onsearchResults={handleLoadPdfBlockData}
				onloadingChange={handleLoadingChange}
			/>
		{/if}
		{#if isLoading}
			<div class="spinner-overlay tw-spinner-overlay">
				<div class="spinner custom-spinner"></div>
			</div>
		{/if}
	</div>
	{#if activeTab !== 'results'}
		<div
			class="pdfsubjects-dropdnlist mr-[15%] ml-auto flex
       w-50 flex-col items-end justify-end text-base [grid-area:pdfsubjects-dropdnlist]"
		>
			<label
				for="pdf-options"
				id="pdf-label"
				class="pdf-label font-comic tracking-wider2 mb-1 w-full self-start text-center
           !text-xl font-black text-gray-900">PDF Subjects:</label
			>
			<select
				onchange={handleSubjectChange}
				class="font-comic w-full rounded-md border border-gray-300 bg-gray-100 p-1 !text-base sm:!text-lg md:!text-xl lg:!text-2xl"
			>
				<!-- <option value="" disabled>Select a subject</option> -->
				{#each pdfSubjectsStrings_Array as pdfSubject}
					<option id="pdfsubject" class="pdfsubject font-comic" value={pdfSubject}
						>{pdfSubject}</option
					>
				{/each}
			</select>
		</div>
	{/if}
	<div
		class="tab-bar mt-2 flex h-10 w-full justify-center
       rounded-md bg-white [grid-area:tab-bar]"
	>
		<div class="w3-row w-full rounded-md" role="tablist">
			<button
				type="button"
				onclick={() => openTab('pdfs')}
				role="tab"
				aria-selected={activeTab === 'pdfs'}
				class="w3-half tablink w3-bottombar w3-hover-light-grey w3-padding
          font-comic tracking-wider2 w-1/2 rounded-md bg-white text-center !text-base font-normal sm:!text-lg md:!text-xl
          lg:!text-2xl {activeTab === 'pdfs' ? 'active w3-border-green' : ''}"
			>
				Pdfs
			</button>
			<button
				type="button"
				onclick={() => openTab('results')}
				role="tab"
				aria-selected={activeTab === 'results'}
				class="w3-half tablink w3-bottombar w3-hover-light-grey w3-padding
          font-comic tracking-wider2 w-1/2 rounded-md bg-white text-center !text-base font-normal sm:!text-lg md:!text-xl
          lg:!text-2xl {activeTab === 'results' ? 'active w3-border-green' : ''}"
			>
				Results
			</button>
		</div>
	</div>
	<div
		class="tab-content mt-3 mr-[5%] ml-[5%] w-[90%] rounded-lg bg-white p-2 [grid-area:tab-content]"
	>
		<div
			id="pdfs"
			class="w3-container tab w-full max-w-full overflow-hidden"
			style:display={activeTab === 'pdfs' ? 'block' : 'none'}
		>
			{#if $pdfBookStrings_Array.length > 0}
				<ul class="pdf-titles-list m-0 w-full list-none p-0 text-left">
					{#each $pdfBookStrings_Array as title}
						<li
							class="pdf-title-block mb-2 flex w-full max-w-full items-start gap-2 border-b border-gray-300 pb-1 hover:bg-gray-100"
						>
							<input
								type="checkbox"
								id={title}
								class="pdf-title-item mt-1 h-4 w-4 flex-shrink-0 scale-150 cursor-pointer"
								bind:group={pdfBookCheckedStrings_Array}
								value={title}
							/>
							<label
								for={title}
								class="pdf-title-label font-comic tracking-wider2 overflow-wrap-anywhere max-w-full min-w-0 flex-1 cursor-pointer overflow-hidden !text-base leading-tight font-bold break-words sm:!text-lg md:!text-xl lg:!text-2xl"
								>{title}</label
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<!-- (result.bookTitle + '-' + result.pageNum) -->
		<div
			id="results"
			class="w3-container tab w-full max-w-full overflow-hidden"
			style:display={activeTab === 'results' ? 'block' : 'none'}
		>
			{#each pdfBooksAsResultObjectsArray as result (result.bookTitle + '-' + result.pageNum)}
				<PdfBlock
					{result}
					isChecked={checkedResultsGroup.includes(result)}
					oncheckchange={handleCheckboxChangeForResults}
					ondelete={handleDeleteForPdfBlock}
				/>
			{/each}
		</div>
	</div>

	<div class="footer [grid-area:footer]">
		<Footer />
	</div>
</div>
