import {Editor, MarkdownView, Menu, Notice, Plugin, TFile, TFolder, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, LinkDictSettings, LinkDictSettingTab} from "./settings";
import {DictionaryView} from "./view";
import {DefinitionPopover} from "./popover";
import {YoudaoService} from "./youdao";
import {DictEntry} from "./types";
import {getLemma} from "./lemmatizer";
import {EudicService} from "./eudic";
import {SyncService} from "./sync";
import {AutoLinkService} from "./auto-link";
import {BatchUpdateService} from "./batch-update";
import {ProgressNoticeWidget} from "./modal";
import {t, setLanguage, detectLanguage} from "./i18n";
import {MarkdownGenerator} from "./utils/markdown-generator";

export const VIEW_TYPE_LINK_DICT = 'link-dict-view';

const WORD_REGEX = /^[a-zA-Z\s'-]+$/;

function sanitizeWord(input: string): string {
	return input.trim();
}

function isValidWord(word: string): boolean {
	return word.length > 0 && word.length <= 50 && WORD_REGEX.test(word);
}

export default class LinkDictPlugin extends Plugin {
	settings: LinkDictSettings;
	private eudicService: EudicService | null = null;
	private syncService: SyncService | null = null;
	private autoLinkService: AutoLinkService | null = null;
	private batchUpdateService: BatchUpdateService | null = null;
	private syncTimer: number | null = null;
	private syncTimerRegistered: boolean = false;
	private startupSyncTimeout: number | null = null;
	private syncRibbonIcon: HTMLElement | null = null;
	private batchRibbonIcon: HTMLElement | null = null;
	private autoLinkRibbonIcon: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();
		
		if (this.settings.language === 'auto') {
			setLanguage(detectLanguage());
		} else {
			setLanguage(this.settings.language as 'en' | 'zh');
		}

		this.registerView(VIEW_TYPE_LINK_DICT, (leaf) => new DictionaryView(leaf, this));

		this.addRibbonIcon('book-open', t('commands_openDictionaryView'), () => {
			void this.activateView();
		});

		this.autoLinkService = new AutoLinkService(this.app, this.settings);
		this.batchUpdateService = new BatchUpdateService(this.app, this.settings);

		this.initEudicServices();
		this.updateRibbonIcons();

		this.registerCommands();
		this.registerMenus();
		this.registerEventHandlers();
		this.registerProtocolHandler();
		this.addSettingTab(new LinkDictSettingTab(this.app, this));

		this.initSyncServices();
	}

	onunload() {
		const activePopover = document.querySelector('.link-dict-popover');
		if (activePopover) {
			activePopover.remove();
		}
		this.clearSyncTimer();
		this.clearStartupSyncTimeout();
	}

	private initEudicServices(): void {
		if (!this.settings.eudicToken) return;

		this.eudicService = new EudicService(this.settings.eudicToken);
		this.syncService = new SyncService(
			this.app,
			this.settings,
			this.eudicService,
			() => this.loadData(),
			(data) => this.saveData(data)
		);
	}

	updateRibbonIcons(): void {
		if (this.syncRibbonIcon) {
			this.syncRibbonIcon.remove();
			this.syncRibbonIcon = null;
		}
		if (this.batchRibbonIcon) {
			this.batchRibbonIcon.remove();
			this.batchRibbonIcon = null;
		}
		if (this.autoLinkRibbonIcon) {
			this.autoLinkRibbonIcon.remove();
			this.autoLinkRibbonIcon = null;
		}

		if (this.settings.eudicToken && this.settings.enableSync) {
			this.syncRibbonIcon = this.addRibbonIcon('refresh-cw', t('commands_syncPreview'), () => {
				void this.performSync(false);
			});
		}

		this.batchRibbonIcon = this.addRibbonIcon('layers', t('commands_batchUpdate'), () => {
			void this.performBatchUpdate();
		});

		this.autoLinkRibbonIcon = this.addRibbonIcon('link', t('commands_autoLinkDocument'), () => {
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
				const editor = activeLeaf.view.editor;
				void this.autoLinkDocument(editor);
			} else {
				new Notice(t('notice_pleaseOpenMarkdown'));
			}
		});
	}

	private registerCommands(): void {
		this.addCommand({
			id: 'open-dictionary-view',
			name: t('commands_openDictionaryView'),
			callback: () => {
				void this.activateView();
			}
		});

		this.addCommand({
			id: 'define-selected-word',
			name: t('commands_createLemmaNote'),
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (!selectedText || selectedText.trim() === '') {
					new Notice(t('notice_pleaseSelectWord'));
					return;
				}
				const word = sanitizeWord(selectedText);
				if (!isValidWord(word)) {
					new Notice(t('notice_pleaseSelectValidWord'));
					return;
				}
				void this.searchAndGenerateNote(word, editor);
			}
		});

		this.addCommand({
			id: 'lookup-selection',
			name: t('commands_lookUpSelection'),
			editorCallback: async (editor: Editor, _view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (!selectedText || selectedText.trim() === '') {
					new Notice(t('notice_pleaseSelectWord'));
					return;
				}
				const word = sanitizeWord(selectedText);
				if (!isValidWord(word)) {
					new Notice(t('notice_pleaseSelectValidWord'));
					return;
				}
				const popover = new DefinitionPopover(this, editor, word);
				try {
					const result = await this.findEntry(word, false);
					if (result) {
						popover.setEntry(result.entry);
					} else {
						popover.close();
						new Notice(`${t('ui_noDefinitionFound')} ${word}`);
					}
				} catch (error) {
					popover.close();
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					new Notice(t('notice_syncFailed', { error: errorMsg }));
				}
			}
		});

		this.addCommand({
			id: 'sync-preview',
			name: t('commands_syncPreview'),
			callback: () => {
				void this.performSync(false);
			}
		});

		this.addCommand({
			id: 'auto-link-document',
			name: t('commands_autoLinkDocument'),
			editorCallback: (editor: Editor) => {
				void this.autoLinkDocument(editor);
			}
		});

		this.addCommand({
			id: 'batch-update-definitions',
			name: t('commands_batchUpdate'),
			callback: () => {
				void this.performBatchUpdate();
			}
		});
	}

	private registerMenus(): void {
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, _view: MarkdownView) => {
				const selection = editor.getSelection();

				menu.addItem((item) => {
					item
						.setTitle(t('menu_createLemmaNote'))
						.setIcon('book-open')
						.onClick(() => {
							if (!selection || selection.trim() === '') {
								new Notice(t('notice_pleaseSelectWord'));
								return;
							}
							const word = sanitizeWord(selection);
							if (!isValidWord(word)) {
								new Notice(t('notice_pleaseSelectValidWord'));
								return;
							}
							void this.searchAndGenerateNote(word, editor);
						});
				});

				menu.addItem((item) => {
					item
						.setTitle(t('menu_lookUpSelection'))
						.setIcon('search')
						.onClick(async () => {
							if (!selection || selection.trim() === '') {
								new Notice(t('notice_pleaseSelectWord'));
								return;
							}
							const word = sanitizeWord(selection);
							if (!isValidWord(word)) {
								new Notice(t('notice_pleaseSelectValidWord'));
								return;
							}
							const popover = new DefinitionPopover(this, editor, word);
							try {
								const result = await this.findEntry(word, false);
								if (result) {
									popover.setEntry(result.entry);
								} else {
									popover.close();
									new Notice(`${t('ui_noDefinitionFound')} ${word}`);
								}
							} catch (error) {
								popover.close();
								const errorMsg = error instanceof Error ? error.message : 'Unknown error';
								new Notice(t('notice_syncFailed', { error: errorMsg }));
							}
						});
				});
			})
		);
	}

	private registerEventHandlers(): void {
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					void this.handleFileDeleted(file);
				}
			})
		);
	}

	private registerProtocolHandler(): void {
		this.registerObsidianProtocolHandler('linkdict', async (params) => {
			const cmd = params.cmd;
			const rawWord = params.word || '';
			
			const word = sanitizeWord(rawWord);
			if (!isValidWord(word)) {
				console.warn('[LinkDict] Invalid word in protocol handler:', rawWord);
				return;
			}

			if (cmd === 'update') {
				await this.updateWordFromProtocol(word);
			}
		});
	}

	private async updateWordFromProtocol(word: string): Promise<void> {
		if (!this.batchUpdateService) {
			this.batchUpdateService = new BatchUpdateService(this.app, this.settings);
		}

		const success = await this.batchUpdateService.updateSingleWord(word);
		if (success) {
			new Notice(t('notice_updateSuccess', { word }));
		} else {
			new Notice(t('notice_updateFailed', { word }));
		}
	}

	private initSyncServices(): void {
		if (!this.settings.eudicToken || !this.settings.enableSync) return;

		if (this.settings.syncOnStartup) {
			this.scheduleStartupSync();
		}

		if (this.settings.autoSync) {
			this.startSyncTimer();
		}
	}

	private scheduleStartupSync(): void {
		this.clearStartupSyncTimeout();
		const delayMs = Math.max(0, this.settings.startupDelay) * 1000;
		this.startupSyncTimeout = window.setTimeout(() => {
			void this.performSync(true);
		}, delayMs);
	}

	private clearStartupSyncTimeout(): void {
		if (this.startupSyncTimeout !== null) {
			window.clearTimeout(this.startupSyncTimeout);
			this.startupSyncTimeout = null;
		}
	}

	restartSyncTimer(): void {
		this.clearSyncTimer();
		this.updateRibbonIcons();
		if (this.settings.enableSync && this.settings.autoSync) {
			this.startSyncTimer();
		}
	}

	private startSyncTimer(): void {
		const intervalMs = Math.max(5, this.settings.syncInterval) * 60 * 1000;
		this.syncTimer = window.setInterval(() => {
			void this.performSync(true);
		}, intervalMs);
		if (!this.syncTimerRegistered) {
			this.registerInterval(this.syncTimer);
			this.syncTimerRegistered = true;
		}
	}

	private clearSyncTimer(): void {
		if (this.syncTimer !== null) {
			window.clearInterval(this.syncTimer);
			this.syncTimer = null;
		}
		this.syncTimerRegistered = false;
	}

	async performSync(isAutoSync = false): Promise<void> {
		if (!this.syncService || !this.eudicService) {
			if (!isAutoSync) {
				new Notice(t('notice_noTokenConfigured'));
			}
			return;
		}

		try {
			const dryRunResult = await this.syncService.dryRun();

			const hasChanges = 
				dryRunResult.localAdded.length > 0 || 
				dryRunResult.cloudAdded.length > 0 || 
				dryRunResult.localDeleted.length > 0 || 
				dryRunResult.cloudDeleted.length > 0;

			if (!hasChanges) {
				if (!isAutoSync) {
					new Notice(t('sync_no_changes'), 2000);
				}
				return;
			}

			await this.executeSync(dryRunResult);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			if (!isAutoSync) {
				new Notice(t('notice_syncFailed', { error: errorMsg }));
			}
			console.error('[LinkDict] Sync failed:', errorMsg);
		}
	}

	private async executeSync(dryRunResult: import('./sync').SyncDryRunResult): Promise<void> {
		if (!this.syncService) return;

		const totalOps = dryRunResult.localDeleted.length + 
			dryRunResult.cloudAdded.length + 
			dryRunResult.localAdded.length + 
			dryRunResult.cloudDeleted.length;

		if (totalOps === 0) {
			new Notice(t('sync_no_changes'));
			return;
		}

		const abortSignal = { aborted: false };

		const progressNotice = new ProgressNoticeWidget(
			'sync',
			totalOps,
			() => {
				abortSignal.aborted = true;
			}
		);

		const result = await this.syncService.executeSync(dryRunResult, (current, total, word) => {
			progressNotice.update(current, total, word);
		}, abortSignal);

		if (result.aborted) {
			progressNotice.setAborted(result.stats.uploaded + result.stats.downloaded);
		} else if (result.success) {
			progressNotice.setComplete(result.stats.uploaded, result.stats.downloaded);
		} else if (result.errors.length > 0) {
			progressNotice.hide();
			new Notice(t('notice_syncFailed', { error: result.errors[0] ?? 'Unknown error' }));
		}
	}

	async performBatchUpdate(): Promise<void> {
		if (!this.batchUpdateService) {
			this.batchUpdateService = new BatchUpdateService(this.app, this.settings);
		}

		await this.batchUpdateService.batchUpdateWithModal();
	}

	async autoLinkDocument(editor: Editor): Promise<void> {
		if (!this.autoLinkService) {
			this.autoLinkService = new AutoLinkService(this.app, this.settings);
		}

		this.autoLinkService.invalidateCache();
		const count = await this.autoLinkService.autoLinkCurrentDocument(editor);
		new Notice(t('notice_autoLinkCompleted', { count }));
	}

	private async handleFileDeleted(file: TFile): Promise<void> {
		if (!this.syncService) return;
		await this.syncService.handleFileDeleted(file);
	}

	async loadSettings(): Promise<void> {
		const loaded: unknown = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded as Partial<LinkDictSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async addToEudic(word: string): Promise<boolean> {
		if (!this.eudicService) {
			new Notice(t('notice_pleaseConfigureToken'));
			return false;
		}

		const listId = this.settings.eudicDefaultListId || '0';

		try {
			await this.eudicService.addWords(listId, [word]);
			new Notice(t('notice_addedToEudic', { word, message: '' }));
			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			new Notice(t('notice_failedToAddEudic', { error: errorMessage }));
			return false;
		}
	}

	public async findEntry(word: string, useLemmatizerFlag: boolean = true): Promise<{ entry: DictEntry; word: string } | null> {
		const searchWord = word.toLowerCase().trim();

		if (!searchWord) {
			return null;
		}

		const lookupWord = useLemmatizerFlag ? getLemma(searchWord) : searchWord;

		const entry = await YoudaoService.lookup(lookupWord);

		if (!entry) {
			return null;
		}

		return { entry, word: lookupWord };
	}

	async searchAndGenerateNote(searchWord: string, editor?: Editor): Promise<void> {
		const result = await this.findEntry(searchWord, true);

		if (!result) {
			new Notice(t('notice_wordNotFound', { word: searchWord }));
			return;
		}

		const { entry, word: lemma } = result;

		const isNewFile = await this.createWordFile(lemma, entry, searchWord);

		if (editor) {
			const selectedText = editor.getSelection();
			if (selectedText && selectedText.trim() !== '') {
				const originalText = selectedText.trim();
				if (lemma === originalText) {
					editor.replaceSelection(`[[${lemma}]]`);
				} else {
					editor.replaceSelection(`[[${lemma}|${originalText}]]`);
				}
			}
		}
	}

	generateMarkdown(word: string, entry: DictEntry, originalWord?: string): string {
		return MarkdownGenerator.generate(word, entry, {
			saveTags: this.settings.saveTags,
			originalWord,
		});
	}

	async createWordFile(word: string, entry: DictEntry, originalWord?: string): Promise<boolean> {
		const folderPath = this.settings.folderPath;
		const fileName = `${word}.md`;
		const filePath = `${folderPath}/${fileName}`;
		let isNewFile = false;

		try {
			const folderExists = await this.app.vault.adapter.exists(folderPath);
			if (!folderExists) {
				await this.app.vault.createFolder(folderPath);
			}

			const fileExists = await this.app.vault.adapter.exists(filePath);
			const markdown = this.generateMarkdown(word, entry, originalWord);

			if (fileExists) {
				const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
				if (abstractFile instanceof TFile) {
					await this.app.vault.modify(abstractFile, markdown);
					new Notice(`Updated word file: ${fileName}`);
				}
			} else {
				await this.app.vault.create(filePath, markdown);
				new Notice(`Created word file: ${fileName}`);
				isNewFile = true;
			}

			await this.app.workspace.openLinkText(filePath, '', true);
		} catch (error) {
			new Notice(`Failed to create word file: ${fileName}`);
			console.error('Error creating word file:', error);
		}

		return isNewFile;
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_LINK_DICT);

		let leaf: WorkspaceLeaf | null = leaves[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_LINK_DICT, active: true });
			}
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}
}