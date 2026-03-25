import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';

const BASE_URL = 'https://api.frdic.com/api/open/v1';

export interface EudicCategory {
	id: string;
	language: string;
	name: string;
}

export interface EudicWord {
	word: string;
	exp: string;
}

interface EudicCategoriesResponse {
	data: EudicCategory[];
}

interface EudicAddWordsResponse {
	message: string;
}

interface EudicCreateCategoryResponse {
	data: EudicCategory;
}

interface EudicWordsResponse {
	data: EudicWord[];
	total?: number;
}

export class EudicService {
	private token: string;

	constructor(token: string) {
		this.token = token;
	}

	private async request(method: string, path: string, body?: unknown): Promise<RequestUrlResponse> {
		const url = `${BASE_URL}${path}`;
		const options: RequestUrlParam = {
			url,
			method,
			headers: {
				'Authorization': this.token,
				'Content-Type': 'application/json',
			},
			throw: false,
		};

		if (body) {
			options.body = JSON.stringify(body);
		}

		return requestUrl(options);
	}

	async getCategories(language: string = 'en'): Promise<EudicCategory[]> {
		const response = await this.request('GET', `/studylist/category?language=${language}`);
		if (response.status >= 400) {
			throw new Error(`Failed to get categories: ${response.status}`);
		}
		const data = response.json as EudicCategoriesResponse;
		return data.data;
	}

	async addWords(categoryId: string, words: string[], language: string = 'en'): Promise<string> {
		const response = await this.request('POST', '/studylist/words', {
			id: categoryId,
			language,
			words,
		});

		if (response.status >= 400) {
			throw new Error(`Failed to add words: ${response.status} - ${response.text}`);
		}

		const data = response.json as EudicAddWordsResponse;
		return data.message;
	}

	async createCategory(name: string, language: string = 'en'): Promise<EudicCategory> {
		const response = await this.request('POST', '/studylist/category', {
			language,
			name,
		});

		if (response.status >= 400) {
			throw new Error(`Failed to create category: ${response.status}`);
		}

		const data = response.json as EudicCreateCategoryResponse;
		return data.data;
	}

	async getWords(categoryId: string, language: string = 'en', page: number = 0, pageSize: number = 100): Promise<EudicWord[]> {
		const response = await this.request('GET', `/studylist/words/${categoryId}?language=${language}&page=${page}&page_size=${pageSize}`);
		
		if (response.status >= 400) {
			throw new Error(`Failed to get words: ${response.status}`);
		}

		const data = response.json as EudicWordsResponse;
		return data.data || [];
	}

	async deleteWords(categoryId: string, words: string[], language: string = 'en'): Promise<string> {
		const response = await this.request('DELETE', '/studylist/words', {
			id: categoryId,
			language,
			words,
		});

		if (response.status >= 400) {
			throw new Error(`Failed to delete words: ${response.status} - ${response.text}`);
		}

		// Handle empty response (204 No Content or empty body)
		if (!response.text || response.text.trim() === '') {
			return 'success';
		}

		try {
			const data = response.json as EudicAddWordsResponse;
			return data.message || 'success';
		} catch {
			return 'success';
		}
	}

	static validateToken(token: string): boolean {
		return Boolean(token && token.trim().length > 0);
	}
}