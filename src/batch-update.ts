import { App, TFile, TFolder, parseYaml } from 'obsidian';
import { LinkDictSettings } from './settings';
import { YoudaoService } from './youdao';
import { DictEntry } from './types';
import { t } from './i18n';
import { MarkdownGenerator } from './utils/markdown-generator';
import { BatchUpdateModal, BatchUpdateStats, ProgressNoticeWidget } from './modal';

export interface BatchUpdateResult {
	total: number;
	updated: number;
	skipped: number;
	failed: number;
}

interface LocalFrontmatter {
	tags?: string[];
	aliases?: string[];
	dict_source?: string;
	[key: string]: unknown;
}

export class BatchUpdateService {
	private app: App;
	private settings: LinkDictSettings;
	private isRunning: boolean = false;
	private shouldStop: boolean = false;
	private progressNotice: ProgressNoticeWidget | null = null;

	constructor(app: App, settings: LinkDictSettings) {
		this.app = app;
		this.settings = settings;
	}

	stop(): void {
		this.shouldStop = true;
	}

	isInProgress(): boolean {
		return this.isRunning;
	}

	async batchUpdateWithModal(): Promise<BatchUpdateResult> {
		if (this.isRunning) {
			return { total: 0, updated: 0, skipped: 0, failed: 0 };
		}

		this.isRunning = true;
		this.shouldStop = false;

		const stats = await this.scanFiles();

		return new Promise((resolve) => {
			const modal = new BatchUpdateModal(
				this.app,
				stats,
				() => {
					void this.executeBatchUpdate(stats.pending, resolve);
				},
				() => {
					this.isRunning = false;
					resolve({ total: stats.total, updated: 0, skipped: 0, failed: 0 });
				}
			);
			modal.open();
		});
	}

	private async scanFiles(): Promise<BatchUpdateStats> {
		const folderPath = this.settings.folderPath;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		const stats: BatchUpdateStats = { total: 0, updated: 0, pending: 0 };

		if (!(folder instanceof TFolder)) {
			console.log(`[BatchUpdate] Folder not found: ${folderPath}`);
			return stats;
		}

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				try {
					const content = await this.app.vault.read(child);
					const fm = this.parseFrontmatter(content);

					stats.total++;

					if (fm?.dict_source === 'youdao') {
						stats.updated++;
					} else if (fm?.dict_source === 'eudic' || content.includes('[!info] Eudic Sync')) {
						stats.pending++;
					}
				} catch (readErr) {
					console.warn(`[BatchUpdate] Could not read ${child.path}:`, readErr);
				}
			}
		}

		return stats;
	}

	private async executeBatchUpdate(
		totalPending: number,
		onComplete: (result: BatchUpdateResult) => void
	): Promise<void> {
		const result: BatchUpdateResult = { total: totalPending, updated: 0, skipped: 0, failed: 0 };

		this.progressNotice = new ProgressNoticeWidget(
			'update',
			totalPending,
			() => {
				this.shouldStop = true;
			}
		);

		try {
			const filesNeedingUpdate = await this.findFilesNeedingUpdate();

			let current = 0;
			for (const file of filesNeedingUpdate) {
				if (this.shouldStop || this.progressNotice?.isAbortedByUser()) {
					this.progressNotice?.setAborted(result.updated);
					console.log(`[BatchUpdate] Aborted. Updated: ${result.updated}`);
					this.isRunning = false;
					this.progressNotice = null;
					onComplete(result);
					return;
				}

				current++;
				const cache = this.app.metadataCache.getFileCache(file);
				const word = cache?.frontmatter?.word || file.basename;
				this.progressNotice?.update(current, totalPending, word);

				try {
					const didUpdate = await this.updateFileSafely(file);
					if (didUpdate) {
						result.updated++;
						console.log(`[BatchUpdate] Updated "${word}" (${current}/${totalPending})`);
					} else {
						result.skipped++;
					}
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : String(err);
					console.error(`[BatchUpdate] Failed "${word}":`, errMsg);
					result.failed++;
				}

				await this.delay(this.settings.apiDelayMs);
			}

			this.progressNotice?.setComplete(result.updated, result.failed);
			console.log(`[BatchUpdate] Complete. Updated: ${result.updated}, Failed: ${result.failed}`);
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			console.error('[BatchUpdate] Fatal error:', errMsg);
			this.progressNotice?.setComplete(result.updated, result.failed);
		} finally {
			this.isRunning = false;
			this.progressNotice = null;
		}

		onComplete(result);
	}

	async batchUpdate(): Promise<BatchUpdateResult> {
		return this.batchUpdateWithModal();
	}

	private async updateFileSafely(file: TFile): Promise<boolean> {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		let word = fm?.word || file.basename;

		const content = await this.app.vault.read(file);
		const parsedFm = this.parseFrontmatter(content);

		if (parsedFm?.dict_source === 'youdao') {
			return false;
		}

		const entry = await this.fetchDictionaryEntry(word);
		if (!entry) {
			return false;
		}

		const dictSource = this.settings.dictionarySource;
		const newContent = MarkdownGenerator.generate(word, entry, {
			saveTags: this.settings.saveTags,
			dictSource: dictSource,
		});

		await this.app.vault.process(file, () => newContent);
		return true;
	}

	private async fetchDictionaryEntry(word: string): Promise<DictEntry | null> {
		const source = this.settings.dictionarySource;

		if (source === 'youdao') {
			return await YoudaoService.lookup(word);
		}

		console.warn(`[BatchUpdate] Dictionary source "${source}" not implemented, falling back to Youdao`);
		return await YoudaoService.lookup(word);
	}

	private parseFrontmatter(content: string): LocalFrontmatter | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match || !match[1]) {
			return null;
		}

		try {
			return parseYaml(match[1]) as LocalFrontmatter;
		} catch {
			return null;
		}
	}

	private async findFilesNeedingUpdate(): Promise<TFile[]> {
		const folderPath = this.settings.folderPath;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			console.log(`[BatchUpdate] Folder not found: ${folderPath}`);
			return [];
		}

		const files: TFile[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				try {
					const content = await this.app.vault.read(child);
					const fm = this.parseFrontmatter(content);

					if (fm?.dict_source === 'youdao') {
						continue;
					}

					if (fm?.dict_source === 'eudic' || content.includes('[!info] Eudic Sync')) {
						files.push(child);
					}
				} catch (readErr) {
					console.warn(`[BatchUpdate] Could not read ${child.path}:`, readErr);
				}
			}
		}

		return files;
	}

	async updateSingleWord(word: string): Promise<boolean> {
		try {
			const folderPath = this.settings.folderPath;
			
			const possibleFilenames = [
				`${word}.md`,
				`${word.toLowerCase()}.md`,
			];
			
			let file: TFile | null = null;
			for (const filename of possibleFilenames) {
				const filePath = `${folderPath}/${filename}`;
				const found = this.app.vault.getAbstractFileByPath(filePath);
				if (found instanceof TFile) {
					file = found;
					break;
				}
			}

			if (!file) {
				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (folder instanceof TFolder) {
					for (const child of folder.children) {
						if (child instanceof TFile && child.extension === 'md') {
							const cache = this.app.metadataCache.getFileCache(child);
							const fmWord = cache?.frontmatter?.word;
							if (fmWord && fmWord.toLowerCase() === word.toLowerCase()) {
								file = child;
								break;
							}
						}
					}
				}
			}

			if (!file) {
				console.log(`[BatchUpdate] File not found for word: ${word}`);
				return false;
			}

			return await this.updateFileSafely(file);
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			console.error(`[BatchUpdate] Failed to update ${word}:`, errMsg);
			return false;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}