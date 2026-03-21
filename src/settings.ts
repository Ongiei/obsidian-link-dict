import {AbstractInputSuggest, App, PluginSettingTab, Setting, TAbstractFile, TFolder} from "obsidian";
import LinkDictPlugin from "./main";

export interface LinkDictSettings {
	folderPath: string;
	saveTags: boolean;
	showWebTrans: boolean;
	showExamples: boolean;
}

export const DEFAULT_SETTINGS: LinkDictSettings = {
	folderPath: 'LinkDict',
	saveTags: true,
	showWebTrans: true,
	showExamples: true
}

export class LinkDictSettingTab extends PluginSettingTab {
	plugin: LinkDictPlugin;

	constructor(app: App, plugin: LinkDictPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Word storage folder')
			.setDesc('Folder where word notes will be saved')
			.addText((text) => {
				new FolderSuggest(this.app, text.inputEl);
				text
					.setPlaceholder('Enter folder path')
					.setValue(this.plugin.settings.folderPath)
					.onChange(async (value) => {
						this.plugin.settings.folderPath = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Save exam tags')
			.setDesc('Save exam tags to note frontmatter')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.saveTags)
					.onChange(async (value) => {
						this.plugin.settings.saveTags = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Display options')
			.setHeading();

		new Setting(containerEl)
			.setName('Show web translations')
			.setDesc('Display web translations in sidebar view and generated notes')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showWebTrans)
					.onChange(async (value) => {
						this.plugin.settings.showWebTrans = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Show bilingual examples')
			.setDesc('Display example sentences with translations')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showExamples)
					.onChange(async (value) => {
						this.plugin.settings.showExamples = value;
						await this.plugin.saveSettings();
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