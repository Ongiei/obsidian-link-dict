import { App, Modal, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { LinkDictSettings } from './settings';
import { YoudaoService } from './youdao';
import { DictEntry } from './types';
import { t } from './i18n';
import type { Frontmatter } from './sync';

export interface BatchUpdateResult {
	total: number;
	updated: number;
	skipped: number;
	failed: number;
}

export class ProgressModal extends Modal {
	private progressBarFill: HTMLElement | null = null;
	private statusText: HTMLElement | null = null;
	private abortBtn: HTMLButtonElement | null = null;
	private isAborted: boolean = false;

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('link-dict-progress-modal');

		contentEl.createEl('h2', { text: t('commands_batchUpdate') });

		const progressBar = contentEl.createEl('div', { cls: 'progress-bar-container' });
		this.progressBarFill = progressBar.createEl('div', { cls: 'progress-bar-fill' });

		this.statusText = contentEl.createEl('p', { cls: 'progress-status' });
		this.statusText.textContent = t('progress_preparing');

		const btnContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		this.abortBtn = btnContainer.createEl('button', { cls: 'mod-warning' });
		this.abortBtn.textContent = t('progress_abort');
		this.abortBtn.addEventListener('click', () => this.handleAbortClick());
	}

	private handleAbortClick(): void {
		if (this.isAborted) {
			this.close();
			return;
		}
		this.isAborted = true;
		if (this.abortBtn) {
			this.abortBtn.disabled = true;
			this.abortBtn.textContent = t('progress_aborting');
		}
	}

	private handleCompleteClick(): void {
		this.close();
	}

	updateProgress(current: number, total: number, word: string): void {
		if (this.progressBarFill && total > 0) {
			const percent = (current / total) * 100;
			this.progressBarFill.style.width = `${percent}%`;
		}

		if (this.statusText) {
			this.statusText.textContent = t('progress_updating', { current, total, word });
		}
	}

	setComplete(result: BatchUpdateResult): void {
		if (this.statusText) {
			this.statusText.textContent = t('progress_completed', {
				updated: result.updated,
				skipped: result.skipped,
				failed: result.failed,
			});
		}

		if (this.abortBtn) {
			this.abortBtn.textContent = t('progress_close');
			this.abortBtn.disabled = false;
			this.abortBtn.removeClass('mod-warning');
			this.abortBtn.onclick = () => this.handleCompleteClick();
		}
	}

	isAbortedByUser(): boolean {
		return this.isAborted;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.progressBarFill = null;
		this.statusText = null;
		this.abortBtn = null;
	}
}

export class BatchUpdateService {
	private app: App;
	private settings: LinkDictSettings;
	private isRunning: boolean = false;
	private shouldStop: boolean = false;

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

		const result: BatchUpdateResult = { total: 0, updated: 0, skipped: 0, failed: 0 };

		const modal = new ProgressModal(this.app, t('commands_batchUpdate'), () => {
			this.shouldStop = true;
		});
		modal.open();

		try {
			console.log('[BatchUpdate] Finding files needing update...');
			const filesNeedingUpdate = await this.findFilesNeedingUpdate();
			result.total = filesNeedingUpdate.length;

			console.log(`[BatchUpdate] Found ${result.total} files to update`);

			if (filesNeedingUpdate.length === 0) {
				modal.setComplete(result);
				return result;
			}

			// Process files ONE BY ONE with proper error handling
			for (let i = 0; i < filesNeedingUpdate.length; i++) {
				// Check abort conditions
				if (this.shouldStop || modal.isAbortedByUser()) {
					console.log(`[BatchUpdate] Aborted at file ${i + 1}/${result.total}`);
					break;
				}

				const file = filesNeedingUpdate[i];
				if (!file) {
					console.warn(`[BatchUpdate] Null file at index ${i}`);
					continue;
				}

				const word = file.basename;
				modal.updateProgress(i + 1, result.total, word);

				// Wrap each file update in its own try-catch
				try {
					const didUpdate = await this.updateFileSafely(file);
					if (didUpdate) {
						result.updated++;
						console.log(`[BatchUpdate] Updated "${word}" (${i + 1}/${result.total})`);
					} else {
						result.skipped++;
						console.log(`[BatchUpdate] Skipped "${word}" (${i + 1}/${result.total})`);
					}
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : String(err);
					console.error(`[BatchUpdate] Failed "${word}":`, errMsg);
					result.failed++;
				}

				// Small delay between files to avoid overwhelming the system
				await this.delay(100);
			}

			console.log(`[BatchUpdate] Complete. Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
			modal.setComplete(result);
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			console.error('[BatchUpdate] Fatal error:', errMsg);
			modal.setComplete(result);
		} finally {
			this.isRunning = false;
		}

		return result;
	}

	async batchUpdate(): Promise<BatchUpdateResult> {
		return this.batchUpdateWithModal();
	}

	private async updateFileSafely(file: TFile): Promise<boolean> {
		const word = file.basename;

		// Read current content
		const content = await this.app.vault.read(file);
		const fm = this.parseFrontmatter(content);

		// Skip already updated files
		if (fm?.dict_source === 'youdao') {
			return false;
		}

		// Fetch definition
		const entry = await YoudaoService.lookup(word);
		if (!entry) {
			return false;
		}

		// Use vault.process for atomic write
		const newContent = this.generateFullMarkdown(word, entry);
		await this.app.vault.process(file, () => newContent);

		return true;
	}

	private parseFrontmatter(content: string): Frontmatter | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match || !match[1]) {
			return null;
		}

		try {
			return parseYaml(match[1]) as Frontmatter;
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
		const children = folder.children;

		// Process files sequentially to avoid file lock issues
		for (const child of children) {
			if (child instanceof TFile && child.extension === 'md') {
				try {
					const content = await this.app.vault.read(child);
					const fm = this.parseFrontmatter(content);

					// Skip already updated files
					if (fm?.dict_source === 'youdao') {
						continue;
					}

					// Check if file needs update
					if (content.includes('eudic_synced: true') ||
						content.includes('eudic_synced:True') ||
						content.includes('[!info] Eudic Sync')) {
						files.push(child);
					}
				} catch (readErr) {
					console.warn(`[BatchUpdate] Could not read ${child.path}:`, readErr);
				}
			}
		}

		return files;
	}

	private generateFullMarkdown(word: string, entry: DictEntry): string {
		const tags = new Set<string>(['vocabulary']);

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

		const uniqueTags = Array.from(tags);

		const aliases: string[] = [];
		for (const item of entry.exchange) {
			aliases.push(item.value);
		}

		const uniqueAliases = [...new Set(aliases)].filter(a => a && a.trim() !== '');

		const frontmatter: Frontmatter = {
			tags: uniqueTags,
			eudic_synced: true,
			dict_source: 'youdao',
		};

		if (uniqueAliases.length > 0) {
			frontmatter.aliases = uniqueAliases;
		}

		let content = `---\n${stringifyYaml(frontmatter)}---\n\n`;
		content += `# ${word}\n\n`;

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

		return content;
	}

	async updateSingleWord(word: string): Promise<boolean> {
		try {
			const folderPath = this.settings.folderPath;
			const filePath = `${folderPath}/${word}.md`;
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (!(file instanceof TFile)) {
				console.log(`[BatchUpdate] File not found: ${filePath}`);
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