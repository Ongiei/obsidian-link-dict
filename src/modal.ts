import { App, Modal, Setting } from 'obsidian';
import { t } from './i18n';
import type { SyncDryRunResult } from './sync';

export class SyncConfirmationModal extends Modal {
	private dryRunResult: SyncDryRunResult;
	private onConfirm: () => void;
	private onCancel: () => void;

	constructor(
		app: App,
		dryRunResult: SyncDryRunResult,
		onConfirm: () => void,
		onCancel: () => void
	) {
		super(app);
		this.dryRunResult = dryRunResult;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('link-dict-sync-modal');

		contentEl.createEl('h2', { text: t('sync_confirm_title') });

		const totalChanges = this.dryRunResult.toDownload.length +
			this.dryRunResult.toUpload.length +
			this.dryRunResult.toMarkDeleted.length +
			this.dryRunResult.toDeleteFromCloud.length;

		if (totalChanges === 0) {
			contentEl.createEl('p', { text: t('sync_no_changes') });
			
			new Setting(contentEl)
				.addButton((btn) => {
					btn
						.setButtonText(t('confirm_cancel'))
						.onClick(() => this.close());
				});
			return;
		}

		contentEl.createEl('p', { text: t('sync_confirm_description') });

		const list = contentEl.createEl('ul', { cls: 'sync-change-list' });

		if (this.dryRunResult.toDownload.length > 0) {
			const li = list.createEl('li', { cls: 'sync-change-item sync-change-download' });
			li.createEl('strong', { text: `${t('sync_action_download')} (${this.dryRunResult.toDownload.length})` });
			const wordList = li.createEl('span', { cls: 'sync-word-preview' });
			wordList.textContent = ': ' + this.dryRunResult.toDownload.slice(0, 5).map(c => c.word).join(', ') +
				(this.dryRunResult.toDownload.length > 5 ? ' ...' : '');
		}

		if (this.dryRunResult.toUpload.length > 0) {
			const li = list.createEl('li', { cls: 'sync-change-item sync-change-upload' });
			li.createEl('strong', { text: `${t('sync_action_upload')} (${this.dryRunResult.toUpload.length})` });
			const wordList = li.createEl('span', { cls: 'sync-word-preview' });
			wordList.textContent = ': ' + this.dryRunResult.toUpload.slice(0, 5).map(c => c.word).join(', ') +
				(this.dryRunResult.toUpload.length > 5 ? ' ...' : '');
		}

		if (this.dryRunResult.toMarkDeleted.length > 0) {
			const li = list.createEl('li', { cls: 'sync-change-item sync-change-mark-deleted' });
			li.createEl('strong', { text: `${t('sync_action_mark_deleted')} (${this.dryRunResult.toMarkDeleted.length})` });
			const wordList = li.createEl('span', { cls: 'sync-word-preview' });
			wordList.textContent = ': ' + this.dryRunResult.toMarkDeleted.slice(0, 5).map(c => c.word).join(', ') +
				(this.dryRunResult.toMarkDeleted.length > 5 ? ' ...' : '');
		}

		if (this.dryRunResult.toDeleteFromCloud.length > 0) {
			const li = list.createEl('li', { cls: 'sync-change-item sync-change-delete-cloud' });
			li.createEl('strong', { text: `${t('sync_action_delete_cloud')} (${this.dryRunResult.toDeleteFromCloud.length})` });
			const wordList = li.createEl('span', { cls: 'sync-word-preview' });
			wordList.textContent = ': ' + this.dryRunResult.toDeleteFromCloud.slice(0, 5).map(c => c.word).join(', ') +
				(this.dryRunResult.toDeleteFromCloud.length > 5 ? ' ...' : '');
		}

		if (this.dryRunResult.errors.length > 0) {
			const errorDiv = contentEl.createEl('div', { cls: 'sync-error-list' });
			errorDiv.createEl('strong', { text: t('sync_errors') + ':' });
			for (const err of this.dryRunResult.errors) {
				errorDiv.createEl('div', { text: err, cls: 'sync-error-item' });
			}
		}

		new Setting(contentEl)
			.addButton((btn) => {
				btn
					.setButtonText(t('confirm_cancel'))
					.onClick(() => {
						this.close();
						this.onCancel();
					});
			})
			.addButton((btn) => {
				btn
					.setButtonText(t('confirm_continue'))
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm();
					});
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}