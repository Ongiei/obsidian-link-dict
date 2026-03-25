import { App, Modal, Setting } from 'obsidian';
import { Notice } from 'obsidian';
import { t } from './i18n';

export interface BatchUpdateStats {
	total: number;
	updated: number;
	pending: number;
}

export class ProgressNoticeWidget {
	private notice: Notice;
	private titleEl: HTMLElement;
	private wordEl: HTMLElement;
	private progressBar: HTMLProgressElement;
	private abortBtn: HTMLButtonElement;
	private isAborted = false;
	private onComplete: (() => void) | null = null;

	constructor(type: 'sync' | 'update', total: number, onAbort: () => void) {
		this.notice = new Notice('', 0);
		this.notice.noticeEl.addClass('linkdict-progress-notice');
		this.notice.noticeEl.empty();

		this.titleEl = this.notice.noticeEl.createEl('div', { cls: 'linkdict-notice-title' });
		this.titleEl.textContent = type === 'sync' ? t('notice_syncing') : t('notice_updating');

		this.wordEl = this.notice.noticeEl.createEl('div', { cls: 'linkdict-notice-word' });

		this.progressBar = this.notice.noticeEl.createEl('progress', { cls: 'linkdict-notice-progress' });
		this.progressBar.value = 0;
		this.progressBar.max = total;

		this.abortBtn = this.notice.noticeEl.createEl('button', { cls: 'linkdict-notice-abort mod-warning' });
		this.abortBtn.textContent = t('notice_abort');
		this.abortBtn.onclick = () => {
			this.isAborted = true;
			this.abortBtn.textContent = t('notice_aborting');
			this.abortBtn.disabled = true;
			onAbort();
		};
	}

	update(current: number, total: number, word: string): void {
		this.progressBar.value = current;
		this.progressBar.max = total;
		this.wordEl.textContent = t('notice_wordProgress', { word, current, total });
	}

	isAbortedByUser(): boolean {
		return this.isAborted;
	}

	setAborted(count: number): void {
		this.notice.noticeEl.empty();
		this.notice.noticeEl.addClass('linkdict-notice-complete');
		this.notice.noticeEl.createEl('div', { cls: 'linkdict-notice-result' })
			.textContent = t('notice_aborted', { count });
		setTimeout(() => this.hide(), 3000);
	}

	setComplete(uploaded: number, downloaded: number): void {
		this.notice.noticeEl.empty();
		this.notice.noticeEl.addClass('linkdict-notice-complete');
		this.notice.noticeEl.createEl('div', { cls: 'linkdict-notice-result' })
			.textContent = t('notice_syncCompletedWithStats', { uploaded, downloaded });
		setTimeout(() => this.hide(), 3000);
	}

	hide(): void {
		this.notice.hide();
		if (this.onComplete) {
			this.onComplete();
		}
	}

	setOnComplete(callback: () => void): void {
		this.onComplete = callback;
	}
}

export class BatchUpdateModal extends Modal {
	private stats: BatchUpdateStats;
	private onStart: () => void;
	private handleClose: () => void;

	constructor(
		app: App,
		stats: BatchUpdateStats,
		onStart: () => void,
		handleClose: () => void
	) {
		super(app);
		this.stats = stats;
		this.onStart = onStart;
		this.handleClose = handleClose;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('linkdict-modal-container', 'linkdict-batch-update-modal');

		contentEl.createEl('h2', { text: t('batch_title') });

		const statsGrid = contentEl.createEl('div', { cls: 'linkdict-stats-grid' });

		const totalCard = statsGrid.createEl('div', { cls: 'linkdict-stat-card' });
		totalCard.createEl('div', { cls: 'linkdict-stat-value', text: String(this.stats.total) });
		totalCard.createEl('div', { cls: 'linkdict-stat-label', text: t('batch_totalWords') });

		const updatedCard = statsGrid.createEl('div', { cls: 'linkdict-stat-card linkdict-stat-success' });
		updatedCard.createEl('div', { cls: 'linkdict-stat-value', text: String(this.stats.updated) });
		updatedCard.createEl('div', { cls: 'linkdict-stat-label', text: `✅ ${t('batch_updated')}` });

		const pendingCard = statsGrid.createEl('div', { cls: 'linkdict-stat-card linkdict-stat-warning' });
		pendingCard.createEl('div', { cls: 'linkdict-stat-value', text: String(this.stats.pending) });
		pendingCard.createEl('div', { cls: 'linkdict-stat-label', text: `⏳ ${t('batch_pending')}` });

		if (this.stats.pending === 0) {
			contentEl.createEl('p', { text: t('batch_noPending'), cls: 'linkdict-no-pending' });
			new Setting(contentEl)
				.addButton((btn) => {
					btn
						.setButtonText(t('progress_close'))
						.onClick(() => this.close());
				});
		} else {
			new Setting(contentEl)
				.addButton((btn) => {
					btn
						.setButtonText(t('batch_startUpdate'))
						.setCta()
						.onClick(() => {
							this.close();
							this.onStart();
						});
				})
				.addButton((btn) => {
					btn
						.setButtonText(t('confirm_cancel'))
						.onClick(() => this.close());
				});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.handleClose();
	}
}