import {Editor, MarkdownView, Menu, Notice, Plugin, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, LinkDictSettings, LinkDictSettingTab} from "./settings";
import {DictionaryView} from "./view";
import {DefinitionPopover} from "./popover";
import {YoudaoService} from "./youdao";
import {DictEntry} from "./types";

import winkLemmatizer from 'wink-lemmatizer';

export const VIEW_TYPE_LINK_DICT = 'link-dict-view';

export default class LinkDictPlugin extends Plugin {
	settings: LinkDictSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_LINK_DICT, (leaf) => new DictionaryView(leaf, this));

		this.addRibbonIcon('book-open', 'Open dictionary view', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-dictionary-view',
			name: 'Open dictionary view',
			callback: () => {
				void this.activateView();
			}
		});

		this.addCommand({
			id: 'define-selected-word',
			name: 'Create lemma note',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (!selectedText || selectedText.trim() === '') {
					new Notice('Please select a word to define');
					return;
				}
				void this.searchAndGenerateNote(selectedText.trim().toLowerCase(), editor);
			}
		});

		this.addCommand({
			id: 'lookup-selection',
			name: 'Look up selection',
			editorCallback: async (editor: Editor, _view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (!selectedText || selectedText.trim() === '') {
					new Notice('Please select a word to look up');
					return;
				}
				const popover = new DefinitionPopover(this, editor, selectedText);
				const result = await this.findEntry(selectedText, false);
				if (result) {
					popover.setEntry(result.entry);
				} else {
					popover.close();
					new Notice(`No definition found for: ${selectedText}`);
				}
			}
		});

		this.registerEvent(
			this.app.workspace.on('editor-menu', async (menu: Menu, editor: Editor, _view: MarkdownView) => {
				const selection = editor.getSelection();

				menu.addItem((item) => {
					item
						.setTitle('Create lemma note')
						.setIcon('book-open')
						.onClick(() => {
							if (!selection || selection.trim() === '') {
								new Notice('Please select a word first.');
								return;
							}
							void this.searchAndGenerateNote(selection, editor);
						});
				});

				menu.addItem((item) => {
					item
						.setTitle('Look up selection')
						.setIcon('search')
						.onClick(async () => {
							if (!selection || selection.trim() === '') {
								new Notice('Please select a word first.');
								return;
							}
							const popover = new DefinitionPopover(this, editor, selection);
							const result = await this.findEntry(selection, false);
							if (result) {
								popover.setEntry(result.entry);
							} else {
								popover.close();
								new Notice(`No definition found for: ${selection}`);
							}
						});
				});
			})
		);

		this.addSettingTab(new LinkDictSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	public async findEntry(word: string, useLemmatizer: boolean = true): Promise<{ entry: DictEntry; word: string } | null> {
		const searchWord = word.toLowerCase().trim();

		if (!searchWord) {
			return null;
		}

		let lookupWord = searchWord;

		if (useLemmatizer) {
			const nounLemma = winkLemmatizer.noun(searchWord);
			if (nounLemma !== searchWord) {
				lookupWord = nounLemma;
			}

			const verbLemma = winkLemmatizer.verb(searchWord);
			if (verbLemma !== searchWord && verbLemma !== nounLemma) {
				lookupWord = verbLemma;
			}

			const adjectiveLemma = winkLemmatizer.adjective(searchWord);
			if (adjectiveLemma !== searchWord && adjectiveLemma !== nounLemma && adjectiveLemma !== verbLemma) {
				lookupWord = adjectiveLemma;
			}
		}

		const entry = await YoudaoService.lookup(lookupWord);

		if (!entry) {
			return null;
		}

		return { entry, word: lookupWord };
	}

	async searchAndGenerateNote(searchWord: string, editor?: Editor): Promise<void> {
		const result = await this.findEntry(searchWord, true);

		if (!result) {
			new Notice(`Word "${searchWord}" not found in dictionary`);
			return;
		}

		const { entry, word: lemma } = result;

		await this.createWordFile(lemma, entry, searchWord);

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
		const tags = new Set<string>(['vocabulary']);

		if (this.settings.saveTags && entry.tags.length > 0) {
			entry.tags.forEach(t => tags.add(`exam/${t}`));
		}

		entry.definitions.forEach(def => {
			if (def.pos) {
				const posTag = def.pos.replace(/\./g, '');
				tags.add(`pos/${posTag}`);
			}
		});

		const uniqueTags = Array.from(tags);

		const aliases: string[] = [];
		entry.exchange.forEach(item => {
			aliases.push(item.value);
		});

		if (originalWord && originalWord.toLowerCase() !== word.toLowerCase()) {
			aliases.push(originalWord);
		}

		const uniqueAliases = [...new Set(aliases)].filter(a => a && a.trim() !== '');

		let yaml = '---\n';
		yaml += 'tags:\n';
		for (const tag of uniqueTags) {
			yaml += `  - ${tag}\n`;
		}
		if (uniqueAliases.length > 0) {
			yaml += 'aliases:\n';
			for (const alias of uniqueAliases) {
				yaml += `  - ${alias}\n`;
			}
		}
		yaml += '---\n\n';

		let content = `# ${word}\n\n`;

		if (entry.ph_en || entry.ph_am) {
			content += '## 发音\n\n';
			if (entry.ph_en) {
				content += `- 英: \`/${entry.ph_en}/\`\n`;
			}
			if (entry.ph_am) {
				content += `- 美: \`/${entry.ph_am}/\`\n`;
			}
			content += '\n';
		}

		if (entry.definitions.length > 0) {
			content += '## 释义\n\n';
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

		if (entry.webTrans && entry.webTrans.length > 0) {
			content += '## 网络释义\n\n';
			for (const item of entry.webTrans) {
				const numberedValues = item.value.map((v, i) => `${i + 1}. ${v}`).join(' ');
				content += `- **${item.key}**: ${numberedValues}\n`;
			}
			content += '\n';
		}

		if (entry.bilingualExamples && entry.bilingualExamples.length > 0) {
			content += '## 例句\n\n';
			for (const example of entry.bilingualExamples) {
				content += `- ${example.eng}\n`;
				content += `  - ${example.chn}\n`;
			}
			content += '\n';
		}

		if (entry.exchange.length > 0) {
			content += '## 变形\n\n';
			for (const item of entry.exchange) {
				content += `- ${item.name}: ${item.value}\n`;
			}
			content += '\n';
		}

		return yaml + content;
	}

	async createWordFile(word: string, entry: DictEntry, originalWord?: string) {
		const folderPath = this.settings.folderPath;
		const fileName = `${word}.md`;
		const filePath = `${folderPath}/${fileName}`;

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
			}

			await this.app.workspace.openLinkText(filePath, '', true);
		} catch (error) {
			new Notice(`Failed to create word file: ${fileName}`);
			console.error('Error creating word file:', error);
		}
	}

	async activateView() {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_LINK_DICT);

		let leaf = leaves[0];
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