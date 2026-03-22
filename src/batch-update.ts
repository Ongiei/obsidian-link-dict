import { App, Modal, TFile, TFolder, parseYaml, stringifyYaml, setIcon } from 'obsidian';
import { LinkDictSettings } from './settings';
import { YoudaoService } from './youdao';
import { DictEntry } from './types';
import { t } from './i18n';
import type { DictSource, Frontmatter } from './sync';

export interface BatchUpdateResult {
	total: number;
	updated: number;
	skipped: number;
	failed: number;
}

export class ProgressModal extends Modal {
	private title: string;
	private current: number = 0;
	private total: number = 0;
	private word: string = '';
	private progressBar: HTMLElement;
	private statusText: HTMLElement;
	private abortBtn: HTMLButtonElement;
	private onAbort: () => void;
	private isAborted: boolean = false;

	constructor(app: App, title: string, onAbort: () => void) {
		super(app);
		this.title = title;
		this.onAbort = onAbort;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('link-dict-progress-modal');

		contentEl.createEl('h2', { text: this.title });

		this.progressBar = contentEl.createEl('div', { cls: 'progress-bar-container' });
		this.progressBar.createEl('div', { cls: 'progress-bar-fill' });

		this.statusText = contentEl.createEl('p', { cls: 'progress-status' });
		this.statusText.textContent = t('progress_preparing');

		const btnContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		this.abortBtn = btnContainer.createEl('button', { cls: 'mod-warning' });
		this.abortBtn.textContent = t('progress_abort');
		this.abortBtn.addEventListener('click', () => {
			this.isAborted = true;
			this.onAbort();
			this.abortBtn.disabled = true;
			this.abortBtn.textContent = t('progress_aborting');
		});
	}

	updateProgress(current: number, total: number, word: string) {
		this.current = current;
		this.total = total;
		this.word = word;

		if (this.progressBar) {
			const fill = this.progressBar.querySelector('.progress-bar-fill') as HTMLElement;
			if (fill && total > 0) {
				const percent = (current / total) * 100;
				fill.style.width = `${percent}%`;
			}
		}

		if (this.statusText) {
			this.statusText.textContent = t('progress_updating', { current, total, word });
		}
	}

	setComplete(result: BatchUpdateResult) {
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
			this.abortBtn.classList.remove('mod-warning');
			this.abortBtn.addEventListener('click', () => this.close());
		}
	}

	isAbortedByUser(): boolean {
		return this.isAborted;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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
			const filesNeedingUpdate = await this.findFilesNeedingUpdate();
			result.total = filesNeedingUpdate.length;

			if (filesNeedingUpdate.length === 0) {
				modal.setComplete(result);
				return result;
			}

			for (let i = 0; i < filesNeedingUpdate.length; i++) {
				if (this.shouldStop || modal.isAbortedByUser()) {
					break;
				}

				const file = filesNeedingUpdate[i];
				if (!file) continue;

				const word = file.basename;
				modal.updateProgress(i + 1, result.total, word);

				try {
					const didUpdate = await this.updateFileSafely(file);
					if (didUpdate) {
						result.updated++;
					} else {
						result.skipped++;
					}
				} catch (error) {
					console.error(`Failed to update ${word}:`, error);
					result.failed++;
				}

				await this.delay(100);
			}

			modal.setComplete(result);
		} catch (error) {
			console.error('Batch update error:', error);
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

		try {
			const content = await this.app.vault.read(file);
			const fm = this.parseFrontmatter(content);

			if (fm?.dict_source === 'youdao') {
				return false;
			}

			const entry = await YoudaoService.lookup(word);
			if (!entry) {
				return false;
			}

			await this.app.vault.process(file, () => {
				return this.generateFullMarkdown(word, entry);
			});

			return true;
		} catch (error) {
			console.error(`Failed to update ${word}:`, error);
			throw error;
		}
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
			return [];
		}

		const files: TFile[] = [];

		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === 'md') {
				const content = await this.app.vault.read(file);
				const fm = this.parseFrontmatter(content);

				if (fm?.dict_source === 'youdao') {
					continue;
				}

				if (content.includes('eudic_synced: true') || 
					content.includes('eudic_synced:True') ||
					content.includes('[!info] Eudic Sync')) {
					files.push(file);
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
				return false;
			}

			return await this.updateFileSafely(file);
		} catch (error) {
			console.error(`Failed to update ${word}:`, error);
			return false;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}