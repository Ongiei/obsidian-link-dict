import { DictEntry } from '../types';
import { t } from '../i18n';

export function renderPhoneticButtons(container: HTMLElement, entry: DictEntry): void {
	if (!entry.ph_uk && !entry.ph_us) return;

	const phoneticContainer = document.createElement('div');
	phoneticContainer.className = 'dict-phonetic-container';

	if (entry.ph_uk) {
		const ukPhoneticBtn = document.createElement('div');
		ukPhoneticBtn.className = 'dict-phonetic-btn';
		ukPhoneticBtn.textContent = `${t('view_uk')} /${entry.ph_uk}/`;
		if (entry.audio_uk) {
			ukPhoneticBtn.addEventListener('click', () => {
				void new Audio(entry.audio_uk!).play();
			});
		}
		phoneticContainer.appendChild(ukPhoneticBtn);
	}

	if (entry.ph_us) {
		const usPhoneticBtn = document.createElement('div');
		usPhoneticBtn.className = 'dict-phonetic-btn';
		usPhoneticBtn.textContent = `${t('view_us')} /${entry.ph_us}/`;
		if (entry.audio_us) {
			usPhoneticBtn.addEventListener('click', () => {
				void new Audio(entry.audio_us!).play();
			});
		}
		phoneticContainer.appendChild(usPhoneticBtn);
	}

	container.appendChild(phoneticContainer);
}