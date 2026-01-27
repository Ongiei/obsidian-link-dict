import {ItemView, WorkspaceLeaf, setIcon, setTooltip} from 'obsidian';
import LinkDictPlugin, {DictEntry} from './main';

/**
 * 字典视图类
 * 用于在侧边栏显示词典搜索和词条详情
 */
export class DictionaryView extends ItemView {
	plugin: LinkDictPlugin; // 插件实例
	searchInput: HTMLInputElement; // 搜索输入框
	resultContainer: HTMLElement; // 结果容器

	/**
	 * 构造函数
	 * @param leaf - 工作区叶子节点
	 * @param plugin - 插件实例
	 */
	constructor(leaf: WorkspaceLeaf, plugin: LinkDictPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * 获取视图类型
	 */
	getViewType() {
		return 'link-dict-view';
	}

	/**
	 * 获取显示文本
	 */
	getDisplayText() {
		return 'Link dictionary';
	}

	/**
	 * 获取图标
	 */
	getIcon() {
		return 'book-open';
	}

	/**
	 * 视图打开时调用
	 */
	async onOpen() {
		this.containerEl.empty();

		// 创建内容容器
		const contentEl = this.containerEl.createEl('div', { cls: 'dict-view-content' });
		contentEl.classList.add('link-dict-sidebar-view');
		contentEl.classList.remove('link-dict-popover');

		// 创建搜索栏
		const searchBarEl = contentEl.createEl('div', { cls: 'link-dict-search-box' });

		// 创建搜索输入框
		this.searchInput = searchBarEl.createEl('input', {
			type: 'text',
			cls: 'link-dict-search-input',
			attr: { placeholder: 'Input word...' }
		});

		// 创建搜索按钮
		const searchButton = searchBarEl.createEl('button', {
			cls: 'link-dict-search-btn'
		});
		setIcon(searchButton, 'search');

		// 创建笔记按钮
		const createNoteButton = searchBarEl.createEl('button', {
			cls: 'link-dict-search-btn',
			attr: { 'aria-label': 'Create lemma note' }
		});
		setIcon(createNoteButton, 'file-plus');
		setTooltip(createNoteButton, 'Create lemma note');
		createNoteButton.addEventListener('click', () => {
			const word = this.searchInput.value.trim();
			if (word) {
				void this.plugin.searchAndGenerateNote(word);
			}
		});

		// 创建结果容器
		this.resultContainer = contentEl.createEl('div', { cls: 'dict-result-container' });

		// 绑定回车键搜索事件
		this.searchInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				void this.performSearch();
			}
		});

		// 绑定点击搜索按钮事件
		searchButton.addEventListener('click', () => {
			void this.performSearch();
		});
	}

	/**
	 * 视图关闭时调用
	 */
	async onClose() {
	}

	/**
	 * 执行搜索
	 */
	async performSearch() {
		const word = this.searchInput.value.trim();
		
		// 检查输入是否为空
		if (!word) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('link-dict-message');
			message.setText('Please enter a word to search.');
			return;
		}

		// 查找词条
		const result = await this.plugin.findEntry(word, false);

		// 未找到词条
		if (!result) {
			this.resultContainer.empty();
			const message = this.resultContainer.createEl('p');
			message.addClass('link-dict-message');
			const textSpan = message.createEl('span');
			textSpan.setText('No definition found for: ');
			const strongSpan = message.createEl('strong');
			strongSpan.setText(word);
			return;
		}

		const { entry, word: lemma } = result;

		this.resultContainer.empty();

		// 渲染词条详情
		this.renderEntry(entry, lemma);
	}

	/**
	 * 渲染词条详情
	 * @param entry - 词条数据
	 * @param word - 词条单词
	 */
	private renderEntry(entry: DictEntry, word: string) {
		const container = this.resultContainer.createEl('div', { cls: 'dict-entry' });

		// 创建头部容器
		const headerContainer = container.createEl('div', { cls: 'dict-header-container' });

		const headerLeft = headerContainer.createEl('div', { cls: 'dict-header-left' });

		// 显示单词标题
		const title = headerLeft.createEl('h1', { cls: 'dict-title' });
		title.textContent = word;

		// 显示音标和发音按钮
		if (entry.ph_en || entry.ph_am) {
			const phoneticContainer = headerLeft.createEl('div', { cls: 'dict-phonetic-container' });

			// 英式音标
			if (entry.ph_en) {
				const ukPhoneticBtn = phoneticContainer.createEl('div', { cls: 'dict-phonetic-btn' });
				ukPhoneticBtn.textContent = `英 /${entry.ph_en}/ 🔊`;
				if (entry.mp3_en) {
					ukPhoneticBtn.addEventListener('click', () => {
						void new Audio(entry.mp3_en).play();
					});
				}
				phoneticContainer.appendChild(ukPhoneticBtn);
			}

			// 美式音标
			if (entry.ph_am) {
				const usPhoneticBtn = phoneticContainer.createEl('div', { cls: 'dict-phonetic-btn' });
				usPhoneticBtn.textContent = `美 /${entry.ph_am}/ 🔊`;
				if (entry.mp3_am) {
					usPhoneticBtn.addEventListener('click', () => {
						void new Audio(entry.mp3_am).play();
					});
				}
				phoneticContainer.appendChild(usPhoneticBtn);
			}

			headerLeft.appendChild(phoneticContainer);
		}

		// 显示释义列表
		if (entry.definitions.length > 0) {
			const definitionsList = container.createEl('div', { cls: 'dict-definitions-list' });
			entry.definitions.forEach((def: { pos: string; trans: string }) => {
				const defRow = definitionsList.createEl('div', { cls: 'dict-def-row' });
				// 显示词性
				if (def.pos) {
					const posEl = defRow.createEl('span', { cls: 'dict-pos-label' });
					posEl.textContent = def.pos;
				}
				// 显示翻译
				const transEl = defRow.createEl('span', { cls: 'dict-def-text' });
				transEl.textContent = def.trans.replace(/\[/g, '\\[');
			});
		}

		// 显示标签和词形变化
		if (entry.tags.length > 0 || entry.exchange.length > 0) {
			const footer = container.createEl('div', { cls: 'dict-footer' });

			// 显示标签
			if (entry.tags.length > 0) {
				const tagsContainer = footer.createEl('div', { cls: 'dict-tags-container' });
				entry.tags.forEach((tag: string) => {
					const tagEl = tagsContainer.createEl('span', { cls: 'dict-tag-exam' });
					tagEl.textContent = tag;
				});
			}

			// 显示词形变化
			if (entry.exchange.length > 0) {
				const formsList = footer.createEl('div', { cls: 'dict-exchange-list' });
				entry.exchange.forEach((item: { name: string; value: string }) => {
					const formItem = formsList.createEl('span', { cls: 'dict-tag-form' });
					const label = formItem.createEl('span', { cls: 'dict-form-label' });
					label.textContent = `${item.name}:`;
					const value = formItem.createEl('span', { cls: 'dict-form-value' });
					value.textContent = item.value;
				});
			}
		}
	}
}
