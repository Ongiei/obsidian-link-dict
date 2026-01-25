import {AbstractInputSuggest, App, ButtonComponent, PluginSettingTab, Setting, TAbstractFile, TFolder} from "obsidian";
import LinkDictPlugin from "./main";

export interface LinkDictSettings {
	folderPath: string;
	replaceWithLink: boolean;
}

export const DEFAULT_SETTINGS: LinkDictSettings = {
	folderPath: 'LinkDict',
	replaceWithLink: true
}

export class LinkDictSettingTab extends PluginSettingTab {
	plugin: LinkDictPlugin;
	downloadButtonComponent: ButtonComponent | null = null;

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
			.setName('Replace selection with link')
			.setDesc('Automatically replace selected text with a wikilink to created note (e.g. [[lemma|original]])')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.replaceWithLink)
					.onChange(async (value) => {
						this.plugin.settings.replaceWithLink = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Offline dictionary')
			.setDesc('Download offline dictionary data (dictionary.json). If already exists, it will be overwritten.')
			.addButton(async (button) => {
				this.downloadButtonComponent = button;
				
				const dictionaryExists = await this.app.vault.adapter.exists(`${this.plugin.manifest.dir}/dictionary.json`);
				const buttonText = dictionaryExists ? 'Redownload' : 'Download';
				
				button
					.setButtonText(buttonText)
					.setClass('mod-cta')
					.onClick(async () => {
						button.setButtonText('Downloading...');
						button.setDisabled(true);
						await this.plugin.downloadDictionary();
						button.setButtonText('Redownload');
						button.setDisabled(false);
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
			folder.toLowerCase().contains(lowerCaseInputStr)
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
