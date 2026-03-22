import {AbstractInputSuggest, App, PluginSettingTab, Setting, TAbstractFile, TFolder} from "obsidian";
import LinkDictPlugin from "./main";
import {t, detectLanguage, setLanguage} from "./i18n";

export type DictionarySource = 'eudic' | 'youdao';

export interface LinkDictSettings {
	folderPath: string;
	saveTags: boolean;
	showWebTrans: boolean;
	showExamples: boolean;
	eudicToken: string;
	eudicDefaultListId: string;
	enableSync: boolean;
	autoSync: boolean;
	syncInterval: number;
	syncOnStartup: boolean;
	startupDelay: number;
	language: string;
	autoLinkFirstOnly: boolean;
	autoAddToEudic: boolean;
	batchChunkSize: number;
	batchDelayMs: number;
	dictionarySource: DictionarySource;
	syncConcurrency: number;
	apiDelayMs: number;
	pendingDeletes: string[];
}

export const DEFAULT_SETTINGS: LinkDictSettings = {
	folderPath: 'LinkDict',
	saveTags: true,
	showWebTrans: true,
	showExamples: true,
	eudicToken: '',
	eudicDefaultListId: '',
	enableSync: false,
	autoSync: false,
	syncInterval: 30,
	syncOnStartup: false,
	startupDelay: 10,
	language: 'auto',
	autoLinkFirstOnly: true,
	autoAddToEudic: true,
	batchChunkSize: 20,
	batchDelayMs: 10000,
	dictionarySource: 'eudic',
	syncConcurrency: 3,
	apiDelayMs: 200,
	pendingDeletes: [],
};

export class LinkDictSettingTab extends PluginSettingTab {
	plugin: LinkDictPlugin;

	constructor(app: App, plugin: LinkDictPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		this.renderGeneralSettings(containerEl);
		this.renderDisplaySettings(containerEl);
		this.renderLinkSettings(containerEl);
		this.renderEudicSettings(containerEl);
		this.renderSyncSettings(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
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
							new Notice('路径包含非法字符，已自动清理');
						}
						this.plugin.settings.folderPath = sanitized || 'LinkDict';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t('settings_saveExamTags'))
			.setDesc(t('settings_saveExamTagsDesc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.saveTags)
					.onChange(async (value) => {
						this.plugin.settings.saveTags = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Language / 语言')
			.setDesc('Choose display language / 选择显示语言')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('auto', 'Auto / 自动')
					.addOption('en', 'English')
					.addOption('zh', '中文')
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value;
						if (value === 'auto') {
							setLanguage(detectLanguage());
						} else {
							setLanguage(value as 'en' | 'zh');
						}
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private renderDisplaySettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_displayPreferences'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('settings_showWebTranslations'))
			.setDesc(t('settings_showWebTranslationsDesc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showWebTrans)
					.onChange(async (value) => {
						this.plugin.settings.showWebTrans = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t('settings_showBilingualExamples'))
			.setDesc(t('settings_showBilingualExamplesDesc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showExamples)
					.onChange(async (value) => {
						this.plugin.settings.showExamples = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private renderLinkSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_linkSettings'))
			.setHeading();

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

		new Setting(containerEl)
			.setName(t('settings_autoAddToEudic'))
			.setDesc(t('settings_autoAddToEudicDesc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoAddToEudic)
					.onChange(async (value) => {
						this.plugin.settings.autoAddToEudic = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private renderEudicSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_eudicIntegration'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('settings_dictionarySource'))
			.setDesc(t('settings_dictionarySourceDesc'))
			.addDropdown((dropdown) => {
				dropdown
					.addOption('eudic', t('settings_sourceEudic'))
					.addOption('youdao', t('settings_sourceYoudao'))
					.setValue(this.plugin.settings.dictionarySource)
					.onChange(async (value) => {
						this.plugin.settings.dictionarySource = value as 'eudic' | 'youdao';
						await this.plugin.saveSettings();
					});
			});

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
					});
				text.inputEl.type = 'password';
			});

		if (this.plugin.settings.eudicToken) {
			const warningEl = containerEl.createEl('p', { 
				cls: 'setting-item-description',
				attr: { style: 'color: var(--text-warning); margin-top: -8px; margin-bottom: 12px;' }
			});
			warningEl.setText('⚠️ Token 以明文存储在插件数据中。请勿将 data.json 分享或上传到公开仓库。');
		}

		new Setting(containerEl)
			.setName(t('settings_defaultVocabularyList'))
			.setDesc(t('settings_defaultVocabularyListDesc'))
			.addText((text) => {
				text
					.setPlaceholder('0')
					.setValue(this.plugin.settings.eudicDefaultListId)
					.onChange(async (value) => {
						this.plugin.settings.eudicDefaultListId = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private renderSyncSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings_syncSettings'))
			.setHeading();

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

		if (!this.plugin.settings.enableSync) return;

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
					});
			});

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

		new Setting(containerEl)
			.setName(t('settings_batchSettings'))
			.setHeading();

		new Setting(containerEl)
			.setName(t('settings_syncConcurrency'))
			.setDesc(t('settings_syncConcurrencyDesc'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.syncConcurrency))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 10) {
							this.plugin.settings.syncConcurrency = num;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.type = 'number';
			});

		new Setting(containerEl)
			.setName(t('settings_batchChunkSize'))
			.setDesc(t('settings_batchChunkSizeDesc'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.batchChunkSize))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 100) {
							this.plugin.settings.batchChunkSize = num;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.type = 'number';
			});

		new Setting(containerEl)
			.setName(t('settings_batchDelay'))
			.setDesc(t('settings_batchDelayDesc'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.batchDelayMs / 1000))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1) {
							this.plugin.settings.batchDelayMs = num * 1000;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.type = 'number';
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