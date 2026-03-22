import { App, Notice, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { EudicService } from './eudic';
import { LinkDictSettings } from './settings';
import { t } from './i18n';

export type DictSource = 'eudic' | 'youdao';

export interface SyncChange {
	word: string;
	action: 'download' | 'upload' | 'mark_deleted' | 'delete_from_cloud';
	reason: string;
}

export interface SyncDryRunResult {
	toDownload: SyncChange[];
	toUpload: SyncChange[];
	toMarkDeleted: SyncChange[];
	toDeleteFromCloud: SyncChange[];
	errors: string[];
}

export interface SyncResult {
	success: boolean;
	uploaded: number;
	downloaded: number;
	deletedFromCloud: number;
	markedDeleted: number;
	skipped: number;
	errors: string[];
}

export interface Frontmatter {
	tags?: string[];
	aliases?: string[];
	eudic_synced?: boolean;
	dict_source?: DictSource;
	[key: string]: unknown;
}

export interface EudicWordData {
	word: string;
	exp?: string;
}

const DEFAULT_API_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export class SyncService {
	private app: App;
	private settings: LinkDictSettings;
	private eudicService: EudicService;
	private saveSettings: () => Promise<void>;
	private isSyncing: boolean = false;
	private shouldAbort: boolean = false;

	constructor(
		app: App,
		settings: LinkDictSettings,
		eudicService: EudicService,
		saveSettings: () => Promise<void>
	) {
		this.app = app;
		this.settings = settings;
		this.eudicService = eudicService;
		this.saveSettings = saveSettings;
	}

	isSyncInProgress(): boolean {
		return this.isSyncing;
	}

	abort(): void {
		this.shouldAbort = true;
	}

	async dryRun(): Promise<SyncDryRunResult> {
		const result: SyncDryRunResult = {
			toDownload: [],
			toUpload: [],
			toMarkDeleted: [],
			toDeleteFromCloud: [],
			errors: [],
		};

		try {
			const remoteData = await this.fetchRemoteWordData();
			const localData = await this.fetchLocalWordData();

			const remoteSet = new Set(remoteData.keys());
			const localSet = new Set(localData.keys());

			for (const [word, data] of remoteData) {
				if (!localSet.has(word)) {
					result.toDownload.push({
						word,
						action: 'download',
						reason: t('sync_reason_remote_only'),
					});
				}
			}

			for (const [word, data] of localData) {
				if (!remoteSet.has(word)) {
					if (data.eudicSynced === true) {
						result.toMarkDeleted.push({
							word,
							action: 'mark_deleted',
							reason: t('sync_reason_cloud_deleted'),
						});
					} else {
						result.toUpload.push({
							word,
							action: 'upload',
							reason: t('sync_reason_local_new'),
						});
					}
				}
			}

			for (const word of this.settings.pendingDeletes) {
				if (remoteSet.has(word)) {
					result.toDeleteFromCloud.push({
						word,
						action: 'delete_from_cloud',
						reason: t('sync_reason_local_deleted'),
					});
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(errorMsg);
		}

		return result;
	}

	async executeSync(dryRunResult: SyncDryRunResult, progressCallback?: (current: number, total: number, word: string) => void): Promise<SyncResult> {
		if (this.isSyncing) {
			return {
				success: false,
				uploaded: 0,
				downloaded: 0,
				deletedFromCloud: 0,
				markedDeleted: 0,
				skipped: 0,
				errors: ['Sync already in progress'],
			};
		}

		this.isSyncing = true;
		this.shouldAbort = false;

		const result: SyncResult = {
			success: false,
			uploaded: 0,
			downloaded: 0,
			deletedFromCloud: 0,
			markedDeleted: 0,
			skipped: 0,
			errors: [...dryRunResult.errors],
		};

		try {
			const totalOps = dryRunResult.toDeleteFromCloud.length + 
				dryRunResult.toDownload.length + 
				dryRunResult.toUpload.length + 
				dryRunResult.toMarkDeleted.length;
			
			let current = 0;

			for (const change of dryRunResult.toDeleteFromCloud) {
				if (this.shouldAbort) break;
				current++;
				progressCallback?.(current, totalOps, change.word);
				await this.executeDeleteFromCloud(change.word, result);
				await delay(this.settings.apiDelayMs || DEFAULT_API_DELAY_MS);
			}

			this.settings.pendingDeletes = this.settings.pendingDeletes.filter(
				w => !dryRunResult.toDeleteFromCloud.some(c => c.word === w)
			);
			await this.saveSettings();

			const remoteData = await this.fetchRemoteWordData();

			for (const change of dryRunResult.toDownload) {
				if (this.shouldAbort) break;
				current++;
				progressCallback?.(current, totalOps, change.word);
				const wordData = remoteData.get(change.word);
				await this.executeDownload(change.word, wordData?.exp, result);
				await delay(this.settings.apiDelayMs || DEFAULT_API_DELAY_MS);
			}

			for (const change of dryRunResult.toUpload) {
				if (this.shouldAbort) break;
				current++;
				progressCallback?.(current, totalOps, change.word);
				await this.executeUpload(change.word, result);
				await delay(this.settings.apiDelayMs || DEFAULT_API_DELAY_MS);
			}

			for (const change of dryRunResult.toMarkDeleted) {
				if (this.shouldAbort) break;
				current++;
				progressCallback?.(current, totalOps, change.word);
				await this.executeMarkDeleted(change.word, result);
				await delay(this.settings.apiDelayMs || DEFAULT_API_DELAY_MS);
			}

			result.success = this.shouldAbort || result.errors.length === 0;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(errorMsg);
		} finally {
			this.isSyncing = false;
		}

		return result;
	}

	private async fetchRemoteWordData(): Promise<Map<string, EudicWordData>> {
		const data = new Map<string, EudicWordData>();
		const listId = this.settings.eudicDefaultListId || '0';
		let page = 1;
		const pageSize = 100;

		while (true) {
			try {
				const batch = await this.eudicService.getWords(listId, 'en', page, pageSize);
				if (batch.length === 0) break;

				for (const w of batch) {
					const word = w.word?.trim().toLowerCase();
					if (word) {
						data.set(word, { word, exp: w.exp });
					}
				}

				if (batch.length < pageSize) break;
				page++;
			} catch (error) {
				console.error('Failed to fetch remote words:', error);
				break;
			}
		}

		return data;
	}

	private async fetchLocalWordData(): Promise<Map<string, { eudicSynced: boolean; dictSource?: DictSource }>> {
		const data = new Map<string, { eudicSynced: boolean; dictSource?: DictSource }>();
		const folderPath = this.settings.folderPath;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			return data;
		}

		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === 'md') {
				const word = file.basename.toLowerCase();
				try {
					const content = await this.app.vault.read(file);
					const fm = this.parseFrontmatter(content);
					data.set(word, {
						eudicSynced: fm?.eudic_synced === true,
						dictSource: fm?.dict_source as DictSource | undefined,
					});
				} catch {
					data.set(word, { eudicSynced: false });
				}
			}
		}

		return data;
	}

	private parseFrontmatter(content: string): Frontmatter | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match || !match[1]) {
			return null;
		}

		try {
			return parseYaml(match[1]) as Frontmatter;
		} catch (error) {
			console.error('Failed to parse frontmatter:', error);
			return null;
		}
	}

	private async executeDeleteFromCloud(word: string, result: SyncResult): Promise<void> {
		try {
			const listId = this.settings.eudicDefaultListId || '0';
			await this.eudicService.deleteWords(listId, [word]);
			result.deletedFromCloud++;
		} catch (error) {
			console.error(`Failed to delete "${word}" from cloud:`, error);
			result.errors.push(`Delete "${word}" from cloud failed`);
		}
	}

	private async executeDownload(word: string, eudicExp: string | undefined, result: SyncResult): Promise<void> {
		try {
			const folderPath = this.settings.folderPath;
			const filePath = `${folderPath}/${word}.md`;

			const exists = await this.app.vault.adapter.exists(filePath);
			if (exists) {
				result.skipped++;
				return;
			}

			await this.ensureFolderExists(folderPath);

			const frontmatter: Frontmatter = {
				tags: ['vocabulary'],
				eudic_synced: true,
				dict_source: 'eudic',
			};

			let content = `---\n${stringifyYaml(frontmatter)}---\n\n`;
			content += `# ${word}\n\n`;
			content += `## ${t('view_definitions')}\n\n`;
			
			if (eudicExp) {
				content += `- ${eudicExp}\n\n`;
			} else {
				content += `*Definition pending update*\n\n`;
			}

			content += `> [!info] Eudic Sync\n`;
			content += `> [🔄 ${t('sync_clickToUpdate')}](obsidian://linkdict?action=update&word=${encodeURIComponent(word)})\n`;

			await this.app.vault.create(filePath, content);
			result.downloaded++;
		} catch (error) {
			console.error(`Failed to download "${word}":`, error);
			result.errors.push(`Download "${word}" failed`);
		}
	}

	private async executeUpload(word: string, result: SyncResult): Promise<void> {
		try {
			const listId = this.settings.eudicDefaultListId || '0';
			await this.eudicService.addWords(listId, [word]);

			const folderPath = this.settings.folderPath;
			const filePath = `${folderPath}/${word}.md`;
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (file instanceof TFile) {
				await this.processFile(file, (content, fm) => {
					fm.eudic_synced = true;
					return content;
				});
			}

			result.uploaded++;
		} catch (error) {
			console.error(`Failed to upload "${word}":`, error);
			result.errors.push(`Upload "${word}" failed`);
		}
	}

	private async executeMarkDeleted(word: string, result: SyncResult): Promise<void> {
		try {
			const folderPath = this.settings.folderPath;
			const filePath = `${folderPath}/${word}.md`;
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (!(file instanceof TFile)) {
				result.skipped++;
				return;
			}

			await this.processFile(file, (content, fm) => {
				if (!fm.tags) {
					fm.tags = ['vocabulary'];
				}
				if (!fm.tags.includes('linkdict/cloud-deleted')) {
					fm.tags.push('linkdict/cloud-deleted');
				}
				fm.eudic_synced = false;
				return content;
			});

			result.markedDeleted++;
		} catch (error) {
			console.error(`Failed to mark "${word}" as deleted:`, error);
			result.errors.push(`Mark "${word}" deleted failed`);
		}
	}

	async processFile(file: TFile, processor: (content: string, frontmatter: Frontmatter) => string): Promise<void> {
		await this.app.vault.process(file, (data) => {
			const match = data.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
			
			let fm: Frontmatter;
			let body: string;

			if (match && match[1] && match[2]) {
				try {
					fm = parseYaml(match[1].replace(/^---\n/, '').replace(/\n---\n$/, '')) as Frontmatter;
				} catch {
					fm = { tags: ['vocabulary'] };
				}
				body = match[2];
			} else {
				fm = { tags: ['vocabulary'] };
				body = data;
			}

			const newBody = processor(body, fm);
			const newFm = `---\n${stringifyYaml(fm)}---\n`;
			return newFm + newBody;
		});
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	async handleFileCreated(file: TFile): Promise<void> {
		if (file.extension !== 'md') return;

		const folderPath = this.settings.folderPath;
		if (!file.path.startsWith(folderPath)) return;

		const word = file.basename;
		if (!word || !/^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(word)) return;

		if (!this.settings.autoAddToEudic) return;

		try {
			const listId = this.settings.eudicDefaultListId || '0';
			await this.eudicService.addWords(listId, [word]);
			await this.processFile(file, (content, fm) => {
				fm.eudic_synced = true;
				return content;
			});
			console.debug(`Auto-added "${word}" to eudic`);
		} catch (error) {
			console.error(`Failed to auto-add "${word}" to eudic:`, error);
		}
	}

	handleFileDeleted(file: TFile): void {
		if (file.extension !== 'md') return;

		const folderPath = this.settings.folderPath;
		if (!file.path.startsWith(folderPath)) return;

		const word = file.basename;
		if (!word) return;

		const lowerWord = word.toLowerCase();

		if (!this.settings.pendingDeletes.includes(lowerWord)) {
			this.settings.pendingDeletes.push(lowerWord);
			void this.saveSettings();
		}
	}

	clearPendingDeletes(): void {
		this.settings.pendingDeletes = [];
		void this.saveSettings();
	}

	getPendingDeletesCount(): number {
		return this.settings.pendingDeletes.length;
	}
}