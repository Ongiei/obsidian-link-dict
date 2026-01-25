import {Editor, MarkdownView, Menu, Notice, Plugin, requestUrl, TFile, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, LinkDictSettings, LinkDictSettingTab} from "./settings";
import {DictionaryView} from "./view";

export const VIEW_TYPE_LINK_DICT = 'link-dict-view';

interface DictEntry {
	p?: string;
	t?: string;
	e?: string;
	g?: string;
}

interface DictionaryDB {
	[key: string]: DictEntry;
}

export default class LinkDictPlugin extends Plugin {
	settings: LinkDictSettings;
	dictionary: DictionaryDB = new Object() as DictionaryDB;

	async onload() {
		await this.loadSettings();
		await this.loadDictionary();

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
			name: 'Define selected word',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (!selectedText || selectedText.trim() === '') {
					new Notice('Please select a word to define');
					return;
				}
				void this.searchAndGenerateNote(selectedText.trim().toLowerCase(), editor);
			}
		});

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (selectedText && selectedText.trim() !== '') {
					const displayText = selectedText.length > 15 
						? selectedText.substring(0, 15) + '...' 
						: selectedText;
					
					menu.addItem((item) => {
						item
							.setTitle(`LinkDict: Define "${displayText}"`)
							.setIcon('book-open')
							.onClick(() => {
								void this.searchAndGenerateNote(selectedText.trim().toLowerCase(), editor);
							});
					});
				}
			})
		);

		this.addSettingTab(new LinkDictSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<LinkDictSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadDictionary() {
		try {
			const dictionaryPath = `${this.manifest.dir}/dictionary.json`;
			const fileExists = await this.app.vault.adapter.exists(dictionaryPath);
			
			if (!fileExists) {
				new Notice('Dictionary file missing, please download in settings.\n检测到缺少词典文件，请前往插件设置页进行下载。');
				return;
			}
			
			const dictionaryContent = await this.app.vault.adapter.read(dictionaryPath);
			this.dictionary = JSON.parse(dictionaryContent) as DictionaryDB;
			new Notice(`Dictionary loaded: ${Object.keys(this.dictionary).length} entries`);
		} catch (error) {
			new Notice('Failed to load dictionary.json');
			console.error('Error loading dictionary:', error);
		}
	}

	async downloadDictionary() {
		try {
			const url = `https://github.com/Ongiei/obsidian-link-dict/releases/download/${this.manifest.version}/dictionary.json`;
			const dictionaryContent = await requestUrl({url});
			
			if (dictionaryContent.status !== 200) {
				throw new Error(`HTTP error! status: ${dictionaryContent.status}`);
			}
			
			const dictionaryPath = `${this.manifest.dir}/dictionary.json`;
			
			await this.app.vault.adapter.write(dictionaryPath, dictionaryContent.text);
			
			await this.loadDictionary();
			
			new Notice('词典下载成功！');
		} catch (error) {
			new Notice('Failed to download dictionary');
			console.error('Error downloading dictionary:', error);
		}
	}

	async searchAndGenerateNote(searchWord: string, editor?: Editor): Promise<void> {
		let finalEntry: DictEntry | null = null;
		let lemma = searchWord;

		const entry = this.dictionary[searchWord];
		if (!entry) {
			new Notice(`Word "${searchWord}" not found in dictionary`);
			return;
		}

		if (entry.e && entry.e.startsWith('0:')) {
			const lemmaMatch = entry.e.match(/^0:([a-zA-Z]+)/);
			if (lemmaMatch && lemmaMatch[1]) {
				lemma = lemmaMatch[1];
				const lemmaEntry = this.dictionary[lemma];
				if (lemmaEntry) {
					finalEntry = lemmaEntry;
				} else {
					new Notice(`Lemma "${lemma}" not found in dictionary`);
					return;
				}
			}
		} else {
			finalEntry = entry;
		}

		if (!finalEntry) {
			new Notice(`No entry found for "${lemma}"`);
			return;
		}

		await this.createWordFile(lemma, finalEntry);

		if (this.settings.replaceWithLink && editor) {
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

	extractPosTags(translation: string | undefined): string[] {
		const posTags: string[] = [];
		if (!translation) return posTags;

		const lines = translation.split('\\n');
		const posRegex = /^([a-z]+)\./;

		for (const line of lines) {
			const match = line.match(posRegex);
			if (match) {
				const pos = match[1];
				posTags.push(`pos/${pos}`);
			}
		}

		return posTags;
	}

	extractAliases(entry: DictEntry): string[] {
		const aliases: string[] = [];
		if (!entry.e) return aliases;

		const parts = entry.e.split('/');
		for (const part of parts) {
			if (part && part.includes(':')) {
				const [, word] = part.split(':');
				if (word && word.trim() !== '') {
					aliases.push(word.trim());
				}
			}
		}

		return [...new Set(aliases)].sort();
	}

	formatExchange(exchange: string | undefined): string[] {
		if (!exchange) return [];

		const typeNames: { [key: string]: string } = {
			p: '过去式',
			d: '过去分词',
			i: '现在分词',
			3: '第三人称单数',
			r: '形容词比较级',
			t: '形容词最高级',
			s: '名词复数形式',
			0: '原型',
			1: '变换形式'
		};

		const parts = exchange.split('/');
		const formattedParts: string[] = [];

		for (const part of parts) {
			if (part && part.includes(':')) {
				const [type, word] = part.split(':');
				if (word && type && typeNames[type]) {
					formattedParts.push(`- ${word} (${typeNames[type]})`);
				}
			}
		}

		return formattedParts;
	}

	generateMarkdown(word: string, entry: DictEntry): string {
		const tags: string[] = ['vocabulary'];

		const posTags = this.extractPosTags(entry.t);
		tags.push(...posTags);

		const uniqueTags = [...new Set(tags)];

		const aliases = this.extractAliases(entry);

		let yaml = '---\n';
		yaml += 'tags:\n';
		for (const tag of uniqueTags) {
			yaml += `  - ${tag}\n`;
		}
		if (aliases.length > 0) {
			yaml += 'aliases:\n';
			for (const alias of aliases) {
				yaml += `  - ${alias}\n`;
			}
		}
		yaml += '---\n\n';

		let content = `# ${word}\n\n`;

		if (entry.p) {
			content += `音标: \`/${entry.p}/\`\n\n`;
		}

		if (entry.t) {
			const translation = entry.t.replace(/\\n/g, '\n');
			const lines = translation.split('\n').filter(line => line.trim() !== '');
			if (lines.length > 0) {
				content += '## 释义\n\n';
				for (const line of lines) {
					const escapedLine = line.trim().replace(/\[/g, '\\[');
					content += `- ${escapedLine}\n`;
				}
				content += '\n';
			}
		}

		if (entry.e) {
			const formattedExchange = this.formatExchange(entry.e);
			if (formattedExchange.length > 0) {
				content += '## 变形\n\n';
				for (const item of formattedExchange) {
					content += `${item}\n`;
				}
				content += '\n';
			}
		}

		return yaml + content;
	}

	async createWordFile(word: string, entry: DictEntry) {
		const folderPath = this.settings.folderPath;
		const fileName = `${word}.md`;
		const filePath = `${folderPath}/${fileName}`;

		try {
			const folderExists = await this.app.vault.adapter.exists(folderPath);
			if (!folderExists) {
				await this.app.vault.createFolder(folderPath);
			}

			const fileExists = await this.app.vault.adapter.exists(filePath);
			const markdown = this.generateMarkdown(word, entry);

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

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_LINK_DICT);

		if (leaves.length > 0) {
			leaf = leaves[0] ?? null;
		} else {
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
