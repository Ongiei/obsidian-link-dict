import { App, Notice, TFile } from 'obsidian';
import { EudicService } from './eudic';
import { LinkDictSettings } from './settings';
import { LedgerService } from './ledger';
import { DictEntry } from './types';
import { getLemma } from './lemmatizer';
import { t } from './i18n';

export type SyncDirection = 'to-eudic' | 'from-eudic' | 'bidirectional';

export interface SyncPreview {
	toUpload: number;
	toDownload: number;
	toDeleteFromCloud: number;
	localFilesToMarkDeleted: number;
}

export interface SyncResult {
	success: boolean;
	uploaded: number;
	downloaded: number;
	deleted: number;
	markedDeleted: number;
	skipped: number;
	errors: string[];
}

const DELETE_DELAY_MS = 500;
const DELETE_WARNING_THRESHOLD = 5;

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeYamlString(str: string): string {
	if (!str) return str;
	if (str.includes(':') || str.includes("'") || str.includes('"') || str.includes('\n') || str.includes('#')) {
		return `'${str.replace(/'/g, "''")}'`;
	}
	return str;
}

export class SyncService {
	private app: App;
	private settings: LinkDictSettings;
	private eudicService: EudicService;
	private ledger: LedgerService;
	private isSyncing: boolean = false;

	constructor(
		app: App, 
		settings: LinkDictSettings, 
		eudicService: EudicService,
		ledger: LedgerService
	) {
		this.app = app;
		this.settings = settings;
		this.eudicService = eudicService;
		this.ledger = ledger;
	}

	async previewSync(direction: SyncDirection): Promise<SyncPreview> {
		this.ledger.syncLocalFiles(this.settings.folderPath);

		const preview: SyncPreview = {
			toUpload: 0,
			toDownload: 0,
			toDeleteFromCloud: 0,
			localFilesToMarkDeleted: 0,
		};

		if (direction === 'to-eudic' || direction === 'bidirectional') {
			const needsSync = this.ledger.getEntriesNeedingSync();
			preview.toUpload = needsSync.toUpload.length;
			preview.toDeleteFromCloud = needsSync.toDeleteFromCloud.length;
		}

		if (direction === 'from-eudic' || direction === 'bidirectional') {
			const listId = this.settings.eudicDefaultListId || '0';
			const allCloudWords: { word: string; exp?: string; id?: string }[] = [];
			let page = 1;
			const pageSize = 100;

			while (true) {
				const words = await this.eudicService.getWords(listId, 'en', page, pageSize);
				if (words.length === 0) break;
				for (const w of words) {
					allCloudWords.push({ word: w.word, exp: w.exp, id: undefined });
				}
				if (words.length < pageSize) break;
				page++;
			}

			this.ledger.syncCloudWords(allCloudWords);

			const needsSync = this.ledger.getEntriesNeedingSync();
			preview.toDownload = needsSync.toDownload.length;
			preview.localFilesToMarkDeleted = needsSync.cloudDeleted.length;
		}

		return preview;
	}

	needsDeleteConfirmation(preview: SyncPreview): boolean {
		return preview.toDeleteFromCloud > DELETE_WARNING_THRESHOLD || 
			   preview.localFilesToMarkDeleted > DELETE_WARNING_THRESHOLD;
	}

	async sync(direction: SyncDirection): Promise<SyncResult> {
		if (this.isSyncing) {
			return { 
				success: false, 
				uploaded: 0, 
				downloaded: 0, 
				deleted: 0, 
				markedDeleted: 0, 
				skipped: 0, 
				errors: ['Sync already in progress'] 
			};
		}

		this.isSyncing = true;
		const result: SyncResult = { 
			success: false, 
			uploaded: 0, 
			downloaded: 0, 
			deleted: 0, 
			markedDeleted: 0, 
			skipped: 0, 
			errors: [] 
		};

		try {
			new Notice(t('notice_syncStarted'));

			this.ledger.syncLocalFiles(this.settings.folderPath);

			if (direction === 'from-eudic' || direction === 'bidirectional') {
				await this.syncFromEudic(result);
			}

			if (direction === 'to-eudic' || direction === 'bidirectional') {
				await this.syncToEudic(result);
			}

			await this.handleCloudDeletedFiles(result);

			await this.ledger.save();

			result.success = result.errors.length === 0;

			if (result.success) {
				new Notice(t('notice_syncCompletedWithStats', { 
					uploaded: result.uploaded, 
					downloaded: result.downloaded 
				}));
			} else {
				new Notice(t('notice_syncFailed', { error: result.errors[0] ?? 'Unknown error' }));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(errorMessage);
			new Notice(t('notice_syncFailed', { error: errorMessage }));
		} finally {
			this.isSyncing = false;
		}

		return result;
	}

	private async syncFromEudic(result: SyncResult): Promise<void> {
		try {
			console.debug(t('sync_fetchingWords'));
			const listId = this.settings.eudicDefaultListId || '0';

			const allCloudWords: { word: string; exp?: string; id?: string }[] = [];
			let page = 1;
			const pageSize = 100;

			while (true) {
				const words = await this.eudicService.getWords(listId, 'en', page, pageSize);
				if (words.length === 0) break;
				for (const w of words) {
					allCloudWords.push({ word: w.word, exp: w.exp, id: undefined });
				}
				if (words.length < pageSize) break;
				page++;
			}

			this.ledger.syncCloudWords(allCloudWords);

			console.debug(t('sync_creatingNotes'));

			const folderPath = this.settings.folderPath;
			await this.ensureFolderExists(folderPath);

			const wordsToCreate = allCloudWords.filter(cloudWord => {
				const word = cloudWord.word?.trim();
				if (!word) return false;
				const normalizedWord = word.toLowerCase();
				const lemma = getLemma(normalizedWord);
				const filePath = `${folderPath}/${lemma}.md`;
				return !this.app.vault.getAbstractFileByPath(filePath);
			});

			const total = wordsToCreate.length;
			const concurrency = this.settings.syncConcurrency;
			let current = 0;

			for (let i = 0; i < wordsToCreate.length; i += concurrency) {
				const batch = wordsToCreate.slice(i, i + concurrency);
				
				await Promise.all(batch.map(async (cloudWord) => {
					const word = cloudWord.word?.trim();
					if (!word) return;

					const normalizedWord = word.toLowerCase();
					const lemma = getLemma(normalizedWord);

					current++;
					new Notice(t('notice_syncProgress', { current, total }));

					try {
						await this.createWordNoteFromSync(lemma, null, cloudWord.exp || word);
						this.ledger.markActive(lemma);
						result.downloaded++;
					} catch (wordError) {
						const errorMsg = wordError instanceof Error ? wordError.message : 'Unknown error';
						console.error(`Failed to sync word "${lemma}":`, errorMsg);
						result.errors.push(`"${lemma}": ${errorMsg}`);
					}
				}));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(errorMessage);
		}
	}

	private async syncToEudic(result: SyncResult): Promise<void> {
		try {
			console.debug(t('sync_uploadingWords'));

			const needsSync = this.ledger.getEntriesNeedingSync();

			const concurrency = this.settings.syncConcurrency;
			
			for (let i = 0; i < needsSync.toUpload.length; i += concurrency) {
				const batch = needsSync.toUpload.slice(i, i + concurrency);
				
				await Promise.all(batch.map(async (word) => {
					try {
						const listId = this.settings.eudicDefaultListId || '0';
						await this.eudicService.addWords(listId, [word]);
						this.ledger.markActive(word);
						result.uploaded++;
					} catch (error) {
						console.error(`Failed to upload ${word}:`, error);
						result.errors.push(`Upload "${word}" failed`);
					}
				}));
			}

			for (const word of needsSync.toDeleteFromCloud) {
				try {
					const listId = this.settings.eudicDefaultListId || '0';
					await this.eudicService.deleteWords(listId, [word]);
					this.ledger.deleteEntry(word);
					result.deleted++;
					await delay(DELETE_DELAY_MS);
				} catch (error) {
					console.error(`Failed to delete ${word} from cloud:`, error);
					result.errors.push(`Delete "${word}" from cloud failed`);
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(errorMessage);
		}
	}

	private async handleCloudDeletedFiles(result: SyncResult): Promise<void> {
		const needsSync = this.ledger.getEntriesNeedingSync();

		for (const word of needsSync.cloudDeleted) {
			try {
				const folderPath = this.settings.folderPath;
				const filePath = `${folderPath}/${word}.md`;
				const file = this.app.vault.getAbstractFileByPath(filePath);

				if (file instanceof TFile) {
					const trashFolder = this.settings.cloudDeletedFolder;
					await this.ensureFolderExists(trashFolder);

					const trashPath = `${trashFolder}/${word}.md`;
					const existingTrashFile = this.app.vault.getAbstractFileByPath(trashPath);

					if (existingTrashFile instanceof TFile) {
						await this.app.fileManager.trashFile(existingTrashFile);
					}

					await this.app.fileManager.renameFile(file, trashPath);

					const movedFile = this.app.vault.getAbstractFileByPath(trashPath);
					if (movedFile instanceof TFile) {
						const content = await this.app.vault.read(movedFile);
						const taggedContent = this.addCloudDeletedTag(content);
						await this.app.vault.modify(movedFile, taggedContent);
					}

					this.ledger.deleteEntry(word);
					result.markedDeleted++;
				}
			} catch (error) {
				console.error(`Failed to mark ${word} as cloud deleted:`, error);
			}
		}
	}

	private addCloudDeletedTag(content: string): string {
		if (content.includes('tags:')) {
			return content.replace(/tags:\n/, 'tags:\n  - linkdict/cloud-deleted\n');
		}

		const yamlEnd = content.indexOf('\n---\n');
		if (yamlEnd !== -1) {
			const beforeYaml = content.slice(0, yamlEnd + 5);
			const afterYaml = content.slice(yamlEnd + 5);
			return `${beforeYaml}\ntags:\n  - linkdict/cloud-deleted\n---\n\n${afterYaml}`;
		}

		return `---\ntags:\n  - linkdict/cloud-deleted\n---\n\n${content}`;
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	private async createWordNoteFromSync(word: string, entry: DictEntry | null, fallbackDef?: string): Promise<void> {
		const folderPath = this.settings.folderPath;
		const filePath = `${folderPath}/${word}.md`;

		const fileExists = await this.app.vault.adapter.exists(filePath);
		if (fileExists) {
			return;
		}

		const markdown = this.generateMarkdownForSync(word, entry, fallbackDef);
		await this.app.vault.create(filePath, markdown);
	}

	private generateMarkdownForSync(word: string, entry: DictEntry | null, fallbackDef?: string): string {
		const tags = new Set<string>(['vocabulary']);

		if (entry) {
			if (this.settings.saveTags && entry.tags.length > 0) {
				for (const tag of entry.tags) {
					tags.add(`exam/${tag}`);
				}
			}

			for (const def of entry.definitions) {
				if (def.pos) {
					const posTag = def.pos.replace(/\./g, '');
					tags.add(`pos/${posTag}`);
				}
			}
		}

		const uniqueTags = Array.from(tags);

		const aliases: string[] = [];
		if (entry?.exchange) {
			for (const item of entry.exchange) {
				aliases.push(item.value);
			}
		}

		const uniqueAliases = [...new Set(aliases)].filter(a => a && a.trim() !== '');

		let yaml = '---\n';
		yaml += 'tags:\n';
		for (const tag of uniqueTags) {
			yaml += `  - ${escapeYamlString(tag)}\n`;
		}
		if (uniqueAliases.length > 0) {
			yaml += 'aliases:\n';
			for (const alias of uniqueAliases) {
				yaml += `  - ${escapeYamlString(alias)}\n`;
			}
		}
		yaml += 'status: eudic-sync\n';
		yaml += '---\n\n';

		let content = `# ${word}\n\n`;

		if (entry) {
			if (entry.ph_uk || entry.ph_us) {
				content += `## ${t('view_pronunciation')}\n\n`;
				if (entry.ph_uk) {
					content += `- ${t('view_uk')}: \`/${entry.ph_uk}/\`\n`;
				}
				if (entry.ph_us) {
					content += `- ${t('view_us')}: \`/${entry.ph_us}/\`\n`;
				}
				content += '\n';
			}

			if (entry.definitions.length > 0) {
				content += `## ${t('view_definitions')}\n\n`;
				for (const def of entry.definitions) {
					const escapedTrans = def.trans.replace(/\[/g, '\\[');
					if (def.pos) {
						content += `- ***${def.pos}*** ${escapedTrans}\n`;
					} else {
						content += `- ${escapedTrans}\n`;
					}
				}
				content += '\n';
			}

			if (this.settings.showWebTrans && entry.webTrans && entry.webTrans.length > 0) {
				content += `## ${t('view_webTranslations')}\n\n`;
				for (const item of entry.webTrans) {
					const numberedValues = item.value.map((v, i) => `${i + 1}. ${v}`).join(' ');
					content += `- **${item.key}**: ${numberedValues}\n`;
				}
				content += '\n';
			}

			if (this.settings.showExamples && entry.bilingualExamples && entry.bilingualExamples.length > 0) {
				content += `## ${t('view_examples')}\n\n`;
				for (const example of entry.bilingualExamples) {
					content += `- ${example.eng}\n`;
					content += `  - ${example.chn}\n`;
				}
				content += '\n';
			}

			if (entry.exchange.length > 0) {
				content += `## ${t('view_wordForms')}\n\n`;
				for (const item of entry.exchange) {
					content += `- ${item.name}: ${item.value}\n`;
				}
				content += '\n';
			}
		} else if (fallbackDef) {
			content += `## ${t('view_definitions')}\n\n`;
			content += `- ${fallbackDef}\n\n`;
		}

		content += `> [!info] Eudic Sync\n`;
		content += `> This note was created from eudic sync. [🔄 Click here to update dictionary details](obsidian://linkdict?action=update&word=${encodeURIComponent(word)})\n`;

		return yaml + content;
	}

	isSyncInProgress(): boolean {
		return this.isSyncing;
	}

	async handleFileCreated(file: TFile): Promise<void> {
		if (file.extension !== 'md') return;
		
		const folderPath = this.settings.folderPath;
		if (!file.path.startsWith(folderPath)) return;

		const word = file.basename;
		if (!word || !/^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(word)) return;

		if (!this.settings.eudicToken || !this.settings.autoAddToEudic) return;

		try {
			const listId = this.settings.eudicDefaultListId || '0';
			await this.eudicService.addWords(listId, [word]);
			this.ledger.markActive(word);
			await this.ledger.save();
			console.debug(`Auto-added "${word}" to eudic`);
		} catch (error) {
			console.error(`Failed to auto-add "${word}" to eudic:`, error);
		}
	}

	async handleFileDeleted(file: TFile): Promise<void> {
		if (file.extension !== 'md') return;

		const folderPath = this.settings.folderPath;
		if (!file.path.startsWith(folderPath)) return;

		const word = file.basename;
		if (!word) return;

		this.ledger.markDeleted(word);
		await this.ledger.save();
	}
}