import {requestUrl} from 'obsidian';
import {DictEntry} from './types';

interface YoudaoJsonResponse {
	ec?: {
		word?: {
			usphone?: string;
			ukphone?: string;
			usspeech?: string;
			ukspeech?: string;
			trs?: {
				tr?: {
					pos?: string;
					l?: {
						i?: string[];
					};
				}[];
			}[];
			wfs?: {
				wf?: {
					name: string;
					value: string;
				};
			}[];
		}[];
		exam_type?: string[];
	};
	web_trans?: {
		'web-translation'?: {
			'@key'?: string;
			key?: string;
			trans?: {
				value?: string;
			}[];
		}[];
	};
	blng_sents_part?: {
		'sentence-pair'?: {
			sentence?: string;
			'sentence-translation'?: string;
		}[];
	};
}

export class YoudaoService {
	private static readonly BASE_URL = 'https://dict.youdao.com/jsonapi';

	static async lookup(word: string): Promise<DictEntry | null> {
		try {
			const url = `${this.BASE_URL}?q=${encodeURIComponent(word)}`;
			const response = await requestUrl({
				url: url,
				method: 'GET',
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				}
			});

			if (response.status !== 200) {
				console.error('YoudaoService: HTTP error', response.status);
				return null;
			}

			const data = response.json as YoudaoJsonResponse;
			return this.parseJson(data, word);
		} catch (error) {
			console.error('Youdao JSON API Error:', error);
			return null;
		}
	}

	private static parseJson(data: YoudaoJsonResponse, originalWord: string): DictEntry | null {
		if (!data?.ec?.word || data.ec.word.length === 0) {
			return null;
		}

		const entryData = data.ec.word[0];
		if (!entryData) {
			return null;
		}

		const ph_en = entryData.ukphone ?? "";
		const ph_am = entryData.usphone ?? "";

		let mp3_en = "";
		let mp3_am = "";
		if (entryData.ukspeech) {
			mp3_en = entryData.ukspeech.startsWith('http') 
				? entryData.ukspeech 
				: `https://dict.youdao.com/dictvoice?audio=${entryData.ukspeech}`;
		}
		if (entryData.usspeech) {
			mp3_am = entryData.usspeech.startsWith('http') 
				? entryData.usspeech 
				: `https://dict.youdao.com/dictvoice?audio=${entryData.usspeech}`;
		}

		const definitions: { pos: string; trans: string }[] = [];
		if (entryData.trs) {
			entryData.trs.forEach(tr => {
				try {
					if (tr?.tr?.[0]?.l?.i?.[0]) {
						let pos = tr.tr[0].pos ?? "";
						let trans = tr.tr[0].l.i[0];

						if (!pos) {
							const posMatch = trans.match(/^([a-z]+\.\s+)/i);
							if (posMatch?.[1]) {
								pos = posMatch[1].trim();
								trans = trans.substring(posMatch[0].length);
							}
						}

						definitions.push({ pos, trans });
					}
				} catch (e) {
					console.warn('Error parsing definition:', e);
				}
			});
		}

		const tags = data.ec.exam_type ?? [];

		const exchange: { name: string; value: string }[] = [];
		if (entryData.wfs) {
			entryData.wfs.forEach(item => {
				if (item?.wf?.name && item?.wf?.value) {
					exchange.push({
						name: item.wf.name,
						value: item.wf.value
					});
				}
			});
		}

		const entry: DictEntry = {
			word: originalWord,
			ph_en,
			ph_am,
			mp3_en,
			mp3_am,
			definitions,
			tags,
			exchange
		};

		try {
			const webTransRaw = data.web_trans?.['web-translation'];
			if (webTransRaw && Array.isArray(webTransRaw)) {
				const queryLower = originalWord.toLowerCase().trim();
				entry.webTrans = webTransRaw
					.map((item: any) => ({
						key: item['@key'] ?? item.key,
						value: item.trans?.map((t: any) => t?.value).filter(Boolean) ?? []
					}))
					.filter(item => {
						const itemKey = item.key?.toLowerCase().trim();
						return itemKey === queryLower && item.value.length > 0;
					});
			}

			const bilingualRaw = data.blng_sents_part?.['sentence-pair'];
			if (bilingualRaw && Array.isArray(bilingualRaw)) {
				entry.bilingualExamples = bilingualRaw
					.slice(0, 5)
					.map((item: any) => ({
						eng: item.sentence ?? '',
						chn: item['sentence-translation'] ?? ''
					}))
					.filter(item => item.eng && item.chn);
			}
		} catch (error) {
			console.error('Extended info parsing failed:', error);
		}

		if (definitions.length > 0 || ph_en || ph_am) {
			return entry;
		}

		return null;
	}
}