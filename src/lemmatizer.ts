import {noun, verb, adjective} from 'wink-lemmatizer';

function getNoun(word: string): string {
	return noun(word);
}

function getVerb(word: string): string {
	return verb(word);
}

function getAdjective(word: string): string {
	return adjective(word);
}

export function getLemma(word: string): string {
	const nounLemma = getNoun(word);
	if (nounLemma !== word) return nounLemma;
	
	const verbLemma = getVerb(word);
	if (verbLemma !== word) return verbLemma;
	
	const adjLemma = getAdjective(word);
	if (adjLemma !== word) return adjLemma;
	
	return word;
}