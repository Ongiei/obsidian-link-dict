import {requestUrl} from 'obsidian';

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
}

interface DictEntry {
	word: string;
	ph_en: string;
	ph_am: string;
	mp3_en: string;
	mp3_am: string;
	definitions: { pos: string; trans: string }[];
	tags: string[];
	exchange: { name: string; value: string }[];
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
		if (!data.ec || !data.ec.word || data.ec.word.length === 0) {
			return null;
		}

		const entryData = data.ec.word[0];
		if (!entryData) {
			return null;
		}

		const ph_en = entryData.ukphone || "";
		const ph_am = entryData.usphone || "";

		let mp3_en = "";
		let mp3_am = "";
		if (entryData.ukspeech) {
			mp3_en = entryData.ukspeech.startsWith('http') 
				? entryData.ukspeech 
				: `http://dict.youdao.com/dictvoice?audio=${entryData.ukspeech}`;
		}
		if (entryData.usspeech) {
			mp3_am = entryData.usspeech.startsWith('http') 
				? entryData.usspeech 
				: `http://dict.youdao.com/dictvoice?audio=${entryData.usspeech}`;
		}

		const definitions: { pos: string; trans: string }[] = [];
		if (entryData.trs) {
			entryData.trs.forEach(tr => {
				if (tr.tr && tr.tr[0] && tr.tr[0].l && tr.tr[0].l.i && tr.tr[0].l.i[0]) {
					let pos = tr.tr[0].pos || "";
					let trans = tr.tr[0].l.i[0];

					if (!pos) {
						const posMatch = trans.match(/^([a-z]+\.\s+)/i);
						if (posMatch && posMatch[1]) {
							pos = posMatch[1].trim();
							trans = trans.substring(posMatch[0].length);
						}
					}

					definitions.push({ pos, trans });
				}
			});
		}

		const tags = data.ec.exam_type || [];

		const exchange: { name: string; value: string }[] = [];
		if (entryData.wfs) {
			entryData.wfs.forEach(item => {
				if (item.wf) {
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

		if (definitions.length > 0 || ph_en || ph_am) {
			return entry;
		}

		return null;
	}
}
