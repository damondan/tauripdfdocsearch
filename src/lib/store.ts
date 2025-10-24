import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export const searchQueryWritable: Writable<string> = writable('');
export const previousSearchesWritable = writable<string[]>([]);