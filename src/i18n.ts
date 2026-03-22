type TranslationKey = string;
type Translations = Record<string, string>;

const en: Translations = {
	settings_wordStorageFolder: 'Word storage folder',
	settings_wordStorageFolderDesc: 'Folder where word notes will be saved',
	settings_saveExamTags: 'Save exam tags',
	settings_saveExamTagsDesc: 'Save exam tags to note frontmatter',
	settings_displayPreferences: 'Display preferences',
	settings_showWebTranslations: 'Show web translations',
	settings_showWebTranslationsDesc: 'Display web translations in sidebar view and generated notes',
	settings_showBilingualExamples: 'Show bilingual examples',
	settings_showBilingualExamplesDesc: 'Display example sentences with translations',
	settings_linkSettings: 'Auto-link settings',
	settings_autoLinkFirstOnly: 'Link first occurrence only',
	settings_autoLinkFirstOnlyDesc: 'Only add wiki-links to the first occurrence of each word in a document',
	settings_autoAddToEudic: 'Auto-add to eudic',
	settings_autoAddToEudicDesc: 'Automatically add new words to eudic when created in the vocabulary folder',
	settings_eudicIntegration: 'Eudic integration',
	settings_eudicApiToken: 'Eudic API token',
	settings_eudicApiTokenDesc: 'Get your token from the eudic website (my.eudic.net)',
	settings_defaultVocabularyList: 'Default vocabulary list',
	settings_defaultVocabularyListDesc: 'Default list ID for adding words (use "0" for default list)',
	settings_syncSettings: 'Sync settings',
	settings_enableSync: 'Enable sync',
	settings_enableSyncDesc: 'Enable bidirectional sync between Eudic and Obsidian',
	settings_autoSync: 'Auto sync',
	settings_autoSyncDesc: 'Automatically sync at regular intervals',
	settings_syncInterval: 'Sync interval (minutes)',
	settings_syncIntervalDesc: 'How often to sync (in minutes, minimum 5)',
	settings_syncOnStartup: 'Sync on startup',
	settings_syncOnStartupDesc: 'Sync when plugin loads',
	settings_startupDelay: 'Startup delay (seconds)',
	settings_startupDelayDesc: 'Delay before syncing on startup (in seconds)',
	settings_batchSettings: 'Batch update settings',
	settings_batchChunkSize: 'Chunk size',
	settings_batchChunkSizeDesc: 'Number of words to process in each batch (1-100)',
	settings_batchDelay: 'Delay between batches (seconds)',
	settings_batchDelayDesc: 'Wait time between batches to avoid API rate limits',
	settings_dictionarySource: 'Dictionary source',
	settings_dictionarySourceDesc: 'Choose dictionary source for word definitions during sync and batch update',
	settings_sourceEudic: 'Eudic Dictionary',
	settings_sourceYoudao: 'Youdao Dictionary',
	settings_syncConcurrency: 'Sync concurrency',
	settings_syncConcurrencyDesc: 'Number of concurrent API requests during sync (1-10)',
	
	commands_openDictionaryView: 'Open dictionary view',
	commands_createLemmaNote: 'Create lemma note',
	commands_lookUpSelection: 'Look up selection',
	commands_syncPreview: 'Preview Eudic sync',
	commands_autoLinkDocument: 'Auto-link words in current document',
	commands_batchUpdate: 'Batch update missing definitions',
	
	menu_createLemmaNote: 'Create lemma note',
	menu_lookUpSelection: 'Look up selection',
	
	ui_inputWord: 'Input word...',
	ui_search: 'Search',
	ui_createLemmaNote: 'Create lemma note',
	ui_pleaseEnterWord: 'Please enter a word to search.',
	ui_noDefinitionFound: 'No definition found for:',
	ui_loading: 'Loading...',
	
	notice_pleaseSelectWord: 'Please select a word first.',
	notice_pleaseSelectValidWord: 'Please select a valid word',
	notice_pleaseConfigureToken: 'Please configure eudic API token in settings',
	notice_addedToEudic: 'Added "{word}" to eudic vocabulary. {message}',
	notice_failedToAddEudic: 'Failed to add word to eudic: {error}',
	notice_wordNotFound: 'Word "{word}" not found in dictionary',
	notice_syncStarted: 'Sync started...',
	notice_syncCompleted: 'Sync completed. Added {count} words.',
	notice_syncCompletedWithStats: 'Sync completed. Uploaded: {uploaded}, Downloaded: {downloaded}',
	notice_syncFailed: 'Sync failed: {error}',
	notice_noTokenConfigured: 'Please configure eudic API token first',
	notice_syncCancelled: 'Sync cancelled',
	notice_autoLinkCompleted: 'Auto-link completed. Added {count} links.',
	notice_updateSuccess: 'Updated definition for "{word}"',
	notice_updateFailed: 'Failed to update "{word}"',
	
	confirm_cancel: 'Cancel',
	confirm_continue: 'Confirm Sync',
	
	view_pronunciation: 'Pronunciation',
	view_definitions: 'Definitions',
	view_webTranslations: 'Web translations',
	view_examples: 'Examples',
	view_wordForms: 'Word forms',
	view_uk: 'UK',
	view_us: 'US',
	
	sync_confirm_title: 'Sync Preview',
	sync_confirm_description: 'This sync will perform the following actions:',
	sync_no_changes: 'No changes detected. Local and cloud are already in sync.',
	sync_dry_run_running: 'Analyzing sync changes...',
	sync_action_download: 'Download from cloud',
	sync_action_upload: 'Upload to cloud',
	sync_action_mark_deleted: 'Mark as cloud-deleted',
	sync_action_delete_cloud: 'Delete from cloud',
	sync_reason_remote_only: 'New word in cloud, not in local',
	sync_reason_cloud_deleted: 'Previously synced but now missing from cloud',
	sync_reason_local_new: 'New local word, not yet synced',
	sync_reason_local_deleted: 'Deleted locally, remove from cloud',
	sync_errors: 'Errors',
	sync_clickToUpdate: 'Click to update with Youdao',
	
	progress_preparing: 'Preparing...',
	progress_updating: 'Updating {current}/{total}: {word}',
	progress_completed: 'Completed. Updated: {updated}, Skipped: {skipped}, Failed: {failed}',
	progress_abort: 'Abort',
	progress_aborting: 'Aborting...',
	progress_close: 'Close',
};

const zh: Translations = {
	settings_wordStorageFolder: '单词存储文件夹',
	settings_wordStorageFolderDesc: '保存单词笔记的文件夹',
	settings_saveExamTags: '保存考试标签',
	settings_saveExamTagsDesc: '将考试标签保存到笔记 frontmatter',
	settings_displayPreferences: '显示设置',
	settings_showWebTranslations: '显示网络翻译',
	settings_showWebTranslationsDesc: '在侧边栏视图和生成的笔记中显示网络翻译',
	settings_showBilingualExamples: '显示双语例句',
	settings_showBilingualExamplesDesc: '显示带有翻译的例句',
	settings_linkSettings: '自动链接设置',
	settings_autoLinkFirstOnly: '仅链接首次出现',
	settings_autoLinkFirstOnlyDesc: '只给文档中每个单词的第一次出现添加双链',
	settings_autoAddToEudic: '自动添加到欧路',
	settings_autoAddToEudicDesc: '在词库文件夹中新建单词时自动添加到欧路生词本',
	settings_eudicIntegration: '欧路词典集成',
	settings_eudicApiToken: '欧路词典 API token',
	settings_eudicApiTokenDesc: '从欧路词典官网 获取你的 token',
	settings_defaultVocabularyList: '默认生词本',
	settings_defaultVocabularyListDesc: '添加单词的默认生词本 ID（默认生词本使用 "0"）',
	settings_syncSettings: '同步设置',
	settings_enableSync: '启用同步',
	settings_enableSyncDesc: '启用欧路词典和 Obsidian 之间的双向同步',
	settings_autoSync: '自动同步',
	settings_autoSyncDesc: '按固定间隔自动同步',
	settings_syncInterval: '同步间隔（分钟）',
	settings_syncIntervalDesc: '同步频率（分钟，最小 5 分钟）',
	settings_syncOnStartup: '启动时同步',
	settings_syncOnStartupDesc: '插件加载时自动同步',
	settings_startupDelay: '启动延迟（秒）',
	settings_startupDelayDesc: '启动时同步前的延迟时间（秒）',
	settings_batchSettings: '批量更新设置',
	settings_batchChunkSize: '每批数量',
	settings_batchChunkSizeDesc: '每批处理的单词数量（1-100）',
	settings_batchDelay: '批次间隔（秒）',
	settings_batchDelayDesc: '批次之间的等待时间，避免 API 限流',
	settings_dictionarySource: '词典数据源',
	settings_dictionarySourceDesc: '选择同步和批量更新时使用的词典数据来源',
	settings_sourceEudic: '欧路词典',
	settings_sourceYoudao: '有道词典',
	settings_syncConcurrency: '同步并发数',
	settings_syncConcurrencyDesc: '同步时的并发请求数量（1-10）',
	
	commands_openDictionaryView: '打开词典视图',
	commands_createLemmaNote: '创建词元笔记',
	commands_lookUpSelection: '查询选中内容',
	commands_syncPreview: '预检欧路同步',
	commands_autoLinkDocument: '自动链接当前文档',
	commands_batchUpdate: '批量更新缺失释义',
	
	menu_createLemmaNote: '创建词元笔记',
	menu_lookUpSelection: '查询选中内容',
	
	ui_inputWord: '输入单词...',
	ui_search: '搜索',
	ui_createLemmaNote: '创建词元笔记',
	ui_pleaseEnterWord: '请输入要查询的单词。',
	ui_noDefinitionFound: '未找到定义：',
	ui_loading: '加载中...',
	
	notice_pleaseSelectWord: '请先选择一个单词。',
	notice_pleaseSelectValidWord: '请选择一个有效的单词',
	notice_pleaseConfigureToken: '请在设置中配置欧路词典 API token',
	notice_addedToEudic: '已将 "{word}" 添加到欧路生词本。{message}',
	notice_failedToAddEudic: '添加到欧路失败：{error}',
	notice_wordNotFound: '词典中未找到单词 "{word}"',
	notice_syncStarted: '同步开始...',
	notice_syncCompleted: '同步完成。添加了 {count} 个单词。',
	notice_syncCompletedWithStats: '同步完成。上传：{uploaded}，下载：{downloaded}',
	notice_syncFailed: '同步失败：{error}',
	notice_noTokenConfigured: '请先配置欧路词典 API token',
	notice_syncCancelled: '同步已取消',
	notice_autoLinkCompleted: '自动链接完成。添加了 {count} 个链接。',
	notice_updateSuccess: '已更新 "{word}" 的释义',
	notice_updateFailed: '更新 "{word}" 失败',
	
	confirm_cancel: '取消',
	confirm_continue: '确认同步',
	
	view_pronunciation: '发音',
	view_definitions: '释义',
	view_webTranslations: '网络翻译',
	view_examples: '例句',
	view_wordForms: '词形变化',
	view_uk: '英',
	view_us: '美',
	
	sync_confirm_title: '同步预检',
	sync_confirm_description: '本次同步将执行以下操作：',
	sync_no_changes: '未检测到变更。本地与云端已同步。',
	sync_dry_run_running: '正在分析同步变更...',
	sync_action_download: '从云端下载',
	sync_action_upload: '上传到云端',
	sync_action_mark_deleted: '标记为云端已删除',
	sync_action_delete_cloud: '从云端删除',
	sync_reason_remote_only: '云端新增，本地不存在',
	sync_reason_cloud_deleted: '之前已同步但现在云端已删除',
	sync_reason_local_new: '本地新词，尚未同步',
	sync_reason_local_deleted: '本地已删除，从云端移除',
	sync_errors: '错误',
	sync_clickToUpdate: '点击使用有道更新',
	
	progress_preparing: '准备中...',
	progress_updating: '正在更新 {current}/{total}: {word}',
	progress_completed: '完成。更新: {updated}, 跳过: {skipped}, 失败: {failed}',
	progress_abort: '终止',
	progress_aborting: '正在终止...',
	progress_close: '关闭',
};

type Language = 'en' | 'zh';

let currentLanguage: Language = 'en';

export function setLanguage(lang: Language): void {
	currentLanguage = lang;
}

export function getLanguage(): Language {
	return currentLanguage;
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
	const translations = currentLanguage === 'zh' ? zh : en;
	let text = translations[key] || key;
	
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			text = text.replace(`{${k}}`, String(v));
		}
	}
	
	return text;
}

export function detectLanguage(): Language {
	if (typeof navigator !== 'undefined' && navigator.language) {
		const lang = navigator.language.toLowerCase();
		if (lang.startsWith('zh')) {
			return 'zh';
		}
	}
	return 'en';
}