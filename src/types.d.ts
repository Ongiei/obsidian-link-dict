declare module 'wink-lemmatizer' {
	const winkLemmatizer: {
		noun(word: string): string;
		verb(word: string): string;
		adjective(word: string): string;
	};
	export default winkLemmatizer;
}

export interface DictEntry {
	word: string;
	ph_en: string;
	ph_am: string;
	mp3_en: string;
	mp3_am: string;
	definitions: { pos: string; trans: string }[];
	tags: string[];
	exchange: { name: string; value: string }[];
	webTrans?: { key: string; value: string[] }[];
	bilingualExamples?: { eng: string; chn: string }[];
}

export interface EditorWithCM {
	cm: {
		coordsAtPos(pos: number): { top: number; left: number; bottom: number; height: number; right: number } | null;
	};
}