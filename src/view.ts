import {ItemView, MarkdownRenderer, WorkspaceLeaf} from 'obsidian';
import LinkDictPlugin from './main';

export class DictionaryView extends ItemView {
	plugin: LinkDictPlugin;
	searchInput: HTMLInputElement;
	resultContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: LinkDictPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return 'link-dict-view';
	}

	getDisplayText() {
		return 'Link dictionary';
	}

	getIcon() {
		return 'book-open';
	}

	async onOpen() {
		this.containerEl.empty();

		const contentEl = this.containerEl.createEl('div', { cls: 'dict-view-content' });

		const searchBarEl = contentEl.createEl('div', { cls: 'dict-search-bar' });

		this.searchInput = searchBarEl.createEl('input', {
			type: 'text',
			cls: 'dict-search-input',
			attr: { placeholder: 'Input word...' }
		});

		const searchButton = searchBarEl.createEl('button', {
			cls: 'dict-search-button',
			text: 'Search'
		});

		this.resultContainer = contentEl.createEl('div', { cls: 'dict-result-container' });

		this.searchInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				void this.performSearch();
			}
		});

		searchButton.addEventListener('click', () => {
			void this.performSearch();
		});
	}

	async onClose() {
	}

	async performSearch() {
		const word = this.searchInput.value.trim();
		
		if (!word) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('link-dict-message');
			message.setText('Please enter a word to search.');
			return;
		}

		if (Object.keys(this.plugin.dictionary).length === 0) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('link-dict-error');
			message.setText('Dictionary not loaded.');
			return;
		}

		const searchWord = word.toLowerCase();
		const entry = this.plugin.dictionary[searchWord];

		if (!entry) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('link-dict-message');
			const textSpan = message.createEl('span');
			textSpan.setText('No definition found for: ');
			const strongSpan = message.createEl('strong');
			strongSpan.setText(word);
			return;
		}

		let finalEntry = entry;
		let lemma = searchWord;

		if (entry.e && entry.e.startsWith('0:')) {
			const lemmaMatch = entry.e.match(/^0:([a-zA-Z]+)/);
			if (lemmaMatch && lemmaMatch[1]) {
				lemma = lemmaMatch[1];
				const lemmaEntry = this.plugin.dictionary[lemma];
				if (lemmaEntry) {
					finalEntry = lemmaEntry;
				}
			}
		}

		const markdown = this.plugin.generateMarkdown(lemma, finalEntry);
		this.resultContainer.empty();
		await MarkdownRenderer.render(this.app, markdown, this.resultContainer, '', this);
	}
}
