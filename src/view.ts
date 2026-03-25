import {ItemView, WorkspaceLeaf, setIcon, setTooltip} from 'obsidian';
import EudicBridgePlugin from './main';
import {DictEntry} from './types';
import {renderPhoneticButtons} from './ui/phonetic-renderer';

export class DictionaryView extends ItemView {
	plugin: EudicBridgePlugin;
	searchInput: HTMLInputElement;
	resultContainer: HTMLElement;
	private currentWord: string = '';
	private currentEntry: DictEntry | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: EudicBridgePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return 'eudic-bridge-view';
	}

	getDisplayText() {
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		return 'Eudic Bridge';
	}

	getIcon() {
		return 'book-open';
	}

	async onOpen() {
		this.containerEl.empty();

		const contentEl = this.containerEl.createEl('div', { cls: 'dict-view-content' });
		contentEl.classList.add('eudic-bridge-sidebar-view');
		contentEl.classList.remove('eudic-bridge-popover');

		const searchBarEl = contentEl.createEl('div', { cls: 'eudic-bridge-search-box' });

		const inputWrapper = searchBarEl.createEl('div', { cls: 'eudic-bridge-input-wrapper' });

		this.searchInput = inputWrapper.createEl('input', {
			type: 'text',
			cls: 'eudic-bridge-search-input',
			attr: { placeholder: '输入单词...' }
		});

		const searchButton = inputWrapper.createEl('button', {
			cls: 'eudic-bridge-search-btn-inside'
		});
		setIcon(searchButton, 'search');
		setTooltip(searchButton, '搜索');
		searchButton.addEventListener('click', () => {
			void this.performSearch();
		});

		const createNoteButton = searchBarEl.createEl('button', {
			cls: 'eudic-bridge-action-btn',
			attr: { 'aria-label': '创建词元笔记' }
		});
		setIcon(createNoteButton, 'file-plus');
		setTooltip(createNoteButton, '创建词元笔记');
		createNoteButton.addEventListener('click', () => {
			const word = this.searchInput.value.trim();
			if (word) {
				void this.plugin.searchAndGenerateNote(word);
			}
		});

		this.resultContainer = contentEl.createEl('div', { cls: 'dict-result-container' });

		this.searchInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				void this.performSearch();
			}
		});
	}

	async onClose() {
	}

	async performSearch() {
		const word = this.searchInput.value.trim();
		
		if (!word) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('eudic-bridge-message');
			message.setText('请输入要查询的单词。');
			return;
		}

		try {
			const result = await this.plugin.findEntry(word, false);

			if (!result) {
				this.resultContainer.empty();
				const message = this.resultContainer.createEl('p');
				message.addClass('eudic-bridge-message');
				const textSpan = message.createEl('span');
				textSpan.setText('未找到定义： ');
				const strongSpan = message.createEl('strong');
				strongSpan.setText(word);
				return;
			}

			const { entry, word: lemma } = result;
			this.currentWord = lemma;
			this.currentEntry = entry;

			this.resultContainer.empty();
			this.renderEntry(entry, lemma);
		} catch (error) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('eudic-bridge-message');
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			message.setText(`Error: ${errorMsg}`);
		}
	}

	private renderEntry(entry: DictEntry, word: string) {
		const container = this.resultContainer.createEl('div', { cls: 'dict-entry' });

		const headerContainer = container.createEl('div', { cls: 'dict-header-container' });

		const headerLeft = headerContainer.createEl('div', { cls: 'dict-header-left' });

		const title = headerLeft.createEl('h1', { cls: 'dict-title' });
		title.textContent = word;

		renderPhoneticButtons(headerLeft, entry);

		if (entry.definitions.length > 0) {
			const definitionsList = container.createEl('div', { cls: 'dict-definitions-list' });
			entry.definitions.forEach((def) => {
				const defRow = definitionsList.createEl('div', { cls: 'dict-def-row' });
				if (def.pos) {
					const posEl = defRow.createEl('span', { cls: 'dict-pos-label' });
					posEl.textContent = def.pos;
				}
				const transEl = defRow.createEl('span', { cls: 'dict-def-text' });
				transEl.textContent = def.trans.replace(/\[/g, '\\[');
			});
		}

		if (entry.tags.length > 0 || entry.exchange.length > 0) {
			const footer = container.createEl('div', { cls: 'dict-footer' });

			if (entry.tags.length > 0) {
				const tagsContainer = footer.createEl('div', { cls: 'dict-tags-container' });
				entry.tags.forEach((tag) => {
					const tagEl = tagsContainer.createEl('span', { cls: 'dict-tag-exam' });
					tagEl.textContent = tag;
				});
			}

			if (entry.exchange.length > 0) {
				const formsList = footer.createEl('div', { cls: 'dict-exchange-list' });
				entry.exchange.forEach((item) => {
					const formItem = formsList.createEl('span', { cls: 'dict-tag-form' });
					const label = formItem.createEl('span', { cls: 'dict-form-label' });
					label.textContent = `${item.name}:`;
					const value = formItem.createEl('span', { cls: 'dict-form-value' });
					value.textContent = item.value;
				});
			}
		}

		this.renderExtendedData(container, entry);
	}

	private renderExtendedData(container: HTMLElement, entry: DictEntry) {
		if (entry.webTrans && entry.webTrans.length > 0) {
			this.renderSection(container, '网络翻译', 'dict-web-trans', entry.webTrans, (section) => {
				const webList = section.createEl('ul', { cls: 'dict-web-list' });
				entry.webTrans!.forEach(item => {
					const li = webList.createEl('li', { cls: 'dict-web-item' });
					const keyEl = li.createEl('span', { cls: 'dict-web-key' });
					keyEl.textContent = `${item.key}: `;
					const valueEl = li.createEl('span', { cls: 'dict-web-value' });
					valueEl.textContent = item.value.map((v, i) => `${i + 1}. ${v}`).join(' ');
				});
			});
		}

		if (entry.bilingualExamples && entry.bilingualExamples.length > 0) {
			this.renderSection(container, '例句', 'dict-examples', entry.bilingualExamples, (section) => {
				const examplesList = section.createEl('div', { cls: 'dict-examples-list' });
				entry.bilingualExamples!.forEach(example => {
					const exampleRow = examplesList.createEl('div', { cls: 'dict-example-row' });
					const enEl = exampleRow.createEl('p', { cls: 'dict-example-en' });
					enEl.textContent = example.eng;
					const cnEl = exampleRow.createEl('p', { cls: 'dict-example-cn' });
					cnEl.textContent = example.chn;
				});
			});
		}
	}

	private renderSection<T>(
		container: HTMLElement,
		title: string,
		className: string,
		data: T | undefined,
		renderContentFn: (section: HTMLElement) => void
	): void {
		if (!data) {
			return;
		}

		const section = container.createEl('div', { cls: `dict-section ${className}` });
		const titleEl = section.createEl('h3', { cls: 'dict-section-title' });
		titleEl.textContent = title;
		renderContentFn(section);
	}
}