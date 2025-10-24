import { getSubjects } from '$lib/tauri-db';

/**
 * Loads PDF subjects data directly from database via Tauri
 * @returns Object containing the PDF subjects data
 */
export const load = async () => {
  try {
    const dataPdfSubjects = await getSubjects();
    return { dataPdfSubjects };
  } catch (error) {
    console.error('Load function error:', error);
    return { dataPdfSubjects: [] };
  }
};
