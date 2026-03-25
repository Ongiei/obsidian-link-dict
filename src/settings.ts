import {AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TAbstractFile, TFolder, Modal} from "obsidian";
import LinkDictPlugin from "./main";
import {t, setLanguage, detectLanguage} from "./i18n";
import {EudicService, EudicCategory} from "./eudic";

export type DictionarySource = 'eudic' | 'youdao';

export interface LinkDictSettings {
	folderPath: string;
	saveTags: boolean;
	eudicToken: string;
	eudicDefaultListId: string;
	syncCategoryIds: string[];
	defaultUploadCategoryId: string;
	enableSync: boolean;
	autoSync: boolean;
	syncInterval: number;
	syncOnStartup: boolean;
	startupDelay: number;
	autoLinkFirstOnly: boolean;
	dictionarySource: DictionarySource;
	apiDelayMs: number;
	language: string;
}

export const DEFAULT_SETTINGS: LinkDictSettings = {
	folderPath: 'LinkDict',
	saveTags: true,
	eudicToken: '',
	eudicDefaultListId: '',
	syncCategoryIds: [],
	defaultUploadCategoryId: '',
	enableSync: false,
	autoSync: false,
	syncInterval: 30,
	syncOnStartup: false,
	startupDelay: 10,
	autoLinkFirstOnly: true,
	dictionarySource: 'youdao',
	apiDelayMs: 500,
	language: 'auto',
};

class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;
	private isConfirmState = false;

	constructor(app: App, message: string, onConfirm: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.addClass('linkdict-confirm-modal');

		contentEl.createEl('p', {text: this.message});

		const btnContainer = contentEl.createEl('div', {cls: 'linkdict-confirm-buttons'});

		const confirmBtn = btnContainer.createEl('button', {cls: 'mod-warning'});
		confirmBtn.textContent = t('confirm_dangerous');
		confirmBtn.onclick = () => {
			if (!this.isConfirmState) {
				this.isConfirmState = true;
				confirmBtn.textContent = t('confirm_dangerous_confirm');
				confirmBtn.addClass('mod-danger');
			} else {
				this.close();
				this.onConfirm();
			}
		};

		const cancelBtn = btnContainer.createEl('button');
		cancelBtn.textContent = t('confirm_cancel');
		cancelBtn.onclick = () => this.close();
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

export class LinkDictSettingTab extends PluginSettingTab {
	plugin: LinkDictPlugin;
	private categories: EudicCategory[] = [];
	private categoriesLoaded = false;

	constructor(app: App, plugin: LinkDictPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.addClass('linkdict-settings');

		this.renderDictionarySection(containerEl);
		this.renderSyncSection(containerEl);
		this.renderAdvancedSection(containerEl);

		if (this.plugin.settings.eudicToken) {
			this.loadCategories();
		}
	}

	private async loadCategories(): Promise<void> {
		if (this.categoriesLoaded) return;

		try {
			const service = new EudicService(this.plugin.settings.eudicToken);
			this.categories = await service.getCategories('en');
			this.categoriesLoaded = true;
			this.display();
		} catch (error) {
			console.error('[LinkDict] Failed to load categories:', error);
		}
	}

	private renderDictionarySection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_sectionDictionary'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('settings_wordStorageFolder'))
			.setDesc(t('settings_wordStorageFolderDesc'))
			.addText((text) => {
				new FolderSuggest(this.app, text.inputEl);
				text
					.setPlaceholder(t('ui_inputWord'))
					.setValue(this.plugin.settings.folderPath)
					.onChange(async (value) => {
						const sanitized = value.replace(/\.\./g, '').replace(/^\/+/, '');
						if (sanitized !== value) {
							new Notice(t('settings_pathSanitized'));
						}
						this.plugin.settings.folderPath = sanitized || 'LinkDict';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t('settings_dictionarySource'))
			.setDesc(t('settings_dictionarySourceDesc'))
			.addDropdown((dropdown) => {
				dropdown
					.addOption('youdao', t('settings_sourceYoudao'))
					.setValue(this.plugin.settings.dictionarySource)
					.onChange(async (value) => {
						this.plugin.settings.dictionarySource = value as 'eudic' | 'youdao';
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(t('settings_apiDelay'))
			.setDesc(t('settings_apiDelayDesc'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.apiDelayMs))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.apiDelayMs = num;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.type = 'number';
			});

		new Setting(containerEl)
			.setName(t('settings_autoLinkFirstOnly'))
			.setDesc(t('settings_autoLinkFirstOnlyDesc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoLinkFirstOnly)
					.onChange(async (value) => {
						this.plugin.settings.autoLinkFirstOnly = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private renderSyncSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_sectionSync'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('settings_eudicApiToken'))
			.setDesc(t('settings_eudicApiTokenDesc'))
			.addText((text) => {
				text
					.setPlaceholder(t('settings_eudicApiToken'))
					.setValue(this.plugin.settings.eudicToken)
					.onChange(async (value) => {
						this.plugin.settings.eudicToken = value.trim();
						await this.plugin.saveSettings();
						this.categoriesLoaded = false;
						this.categories = [];
						this.display();
					});
				text.inputEl.type = 'password';
			});

		if (this.plugin.settings.eudicToken) {
			const warningEl = containerEl.createEl('p', { 
				cls: 'linkdict-warning-text',
			});
			warningEl.setText(t('settings_tokenWarning'));

			if (this.categories.length === 0 && !this.categoriesLoaded) {
				containerEl.createEl('p', {text: t('settings_loadingCategories')});
				return;
			}

			if (this.categories.length > 0) {
				new Setting(containerEl)
					.setName(t('settings_syncCategories'))
					.setDesc(t('settings_syncCategoriesDesc'));

				const categoryContainer = containerEl.createEl('div', {cls: 'linkdict-category-checkboxes'});

				for (const cat of this.categories) {
					const isChecked = this.plugin.settings.syncCategoryIds.includes(cat.id);
					
					const label = categoryContainer.createEl('label', {cls: 'linkdict-checkbox-label'});
					const checkbox = label.createEl('input', {type: 'checkbox'});
					checkbox.checked = isChecked;
					checkbox.addEventListener('change', async () => {
						if (checkbox.checked) {
							if (!this.plugin.settings.syncCategoryIds.includes(cat.id)) {
								this.plugin.settings.syncCategoryIds.push(cat.id);
							}
						} else {
							this.plugin.settings.syncCategoryIds = this.plugin.settings.syncCategoryIds.filter(id => id !== cat.id);
						}
						await this.plugin.saveSettings();
					});
					label.createSpan({text: cat.name});
				}

				new Setting(containerEl)
					.setName(t('settings_defaultUploadCategory'))
					.setDesc(t('settings_defaultUploadCategoryDesc'))
					.addDropdown((dropdown) => {
						for (const cat of this.categories) {
							dropdown.addOption(cat.id, cat.name);
						}
						dropdown
							.setValue(this.plugin.settings.defaultUploadCategoryId || this.categories[0]?.id || '')
							.onChange(async (value) => {
								this.plugin.settings.defaultUploadCategoryId = value;
								await this.plugin.saveSettings();
							});
					});
			}
		}

		new Setting(containerEl)
			.setName(t('settings_enableSync'))
			.setDesc(t('settings_enableSyncDesc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableSync)
					.onChange(async (value) => {
						this.plugin.settings.enableSync = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.enableSync) {
			new Setting(containerEl)
				.setName(t('settings_syncOnStartup'))
				.setDesc(t('settings_syncOnStartupDesc'))
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.syncOnStartup)
						.onChange(async (value) => {
							this.plugin.settings.syncOnStartup = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName(t('settings_startupDelay'))
				.setDesc(t('settings_startupDelayDesc'))
				.addText((text) => {
					text
						.setValue(String(this.plugin.settings.startupDelay))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num >= 0) {
								this.plugin.settings.startupDelay = num;
								await this.plugin.saveSettings();
							}
						});
					text.inputEl.type = 'number';
				});

			new Setting(containerEl)
				.setName(t('settings_autoSync'))
				.setDesc(t('settings_autoSyncDesc'))
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoSync)
						.onChange(async (value) => {
							this.plugin.settings.autoSync = value;
							await this.plugin.saveSettings();
							this.plugin.restartSyncTimer();
							this.display();
						});
				});

			if (this.plugin.settings.autoSync) {
				new Setting(containerEl)
					.setName(t('settings_syncInterval'))
					.setDesc(t('settings_syncIntervalDesc'))
					.addText((text) => {
						text
							.setValue(String(this.plugin.settings.syncInterval))
							.onChange(async (value) => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num >= 5) {
									this.plugin.settings.syncInterval = num;
									await this.plugin.saveSettings();
									this.plugin.restartSyncTimer();
								}
							});
						text.inputEl.type = 'number';
					});
			}
		}
	}

	private renderAdvancedSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_sectionAdvanced'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('settings_language'))
			.setDesc(t('settings_languageDesc'))
			.addDropdown((dropdown) => {
				dropdown
					.addOption('auto', t('settings_languageAuto'))
					.addOption('zh', '中文')
					.addOption('en', 'English')
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
						if (value === 'auto') {
							setLanguage(detectLanguage());
						} else {
							setLanguage(value as 'en' | 'zh');
						}
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(t('settings_clearManifest'))
			.setDesc(t('settings_clearManifestDesc'))
			.addButton((btn) => {
				btn
					.setButtonText(t('settings_clearManifest'))
					.setWarning()
					.onClick(() => {
						new ConfirmModal(
							this.app,
							t('settings_clearManifestDesc'),
							async () => {
								await this.plugin.saveData({ syncManifest: { lastSyncTime: '', syncedWords: [] } });
								new Notice(t('settings_clearManifestConfirm'));
							}
						).open();
					});
			});

		new Setting(containerEl)
			.setName(t('settings_resetPlugin'))
			.setDesc(t('settings_resetPluginDesc'))
			.addButton((btn) => {
				btn
					.setButtonText(t('settings_resetPlugin'))
					.setWarning()
					.onClick(() => {
						new ConfirmModal(
							this.app,
							t('settings_resetPluginDesc'),
							async () => {
								this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
								await this.plugin.saveSettings();
								this.display();
								new Notice(t('settings_resetPluginConfirm'));
							}
						).open();
					});
			});
	}
}

class FolderSuggest extends AbstractInputSuggest<string> {
	inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): string[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: string[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((folder: TAbstractFile) => {
			if (folder instanceof TFolder) {
				folders.push(folder.path);
			}
		});

		return folders.filter((folder: string) =>
			folder.toLowerCase().includes(lowerCaseInputStr)
		);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.inputEl.value = value;
		this.inputEl.trigger('input');
		this.close();
	}
}