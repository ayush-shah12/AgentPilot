import { ipcRenderer } from 'electron';
import { debug } from '../shared/utils';

class SettingsWindow {
  private elements: {
    closeButton: HTMLElement;
    settingsForm: HTMLFormElement;
    scrapybaraKey: HTMLInputElement;
    anthropicKey: HTMLInputElement;
    openaiKey: HTMLInputElement;
    clearButton: HTMLElement;
  };

  constructor() {
    debug.log('SettingsWindow initializing...');
    this.elements = {
      closeButton: document.getElementById('close-settings')!,
      settingsForm: document.getElementById('settings-form') as HTMLFormElement,
      scrapybaraKey: document.getElementById('scrapybara-key') as HTMLInputElement,
      anthropicKey: document.getElementById('anthropic-key') as HTMLInputElement,
      openaiKey: document.getElementById('openai-key') as HTMLInputElement,
      clearButton: document.getElementById('clear-settings')!,
    };

    this.initializeEventListeners();
    this.loadSettings();
  }

  private initializeEventListeners() {
    this.elements.closeButton.addEventListener('click', () => {
      window.close();
    });

    this.elements.clearButton.addEventListener('click', async () => {
        try {
          await ipcRenderer.invoke('clear-settings');
          this.elements.scrapybaraKey.value = '';
          this.elements.anthropicKey.value = '';
          this.elements.openaiKey.value = '';
        } catch (error) {
          debug.error('Failed to clear settings:', error);
        }
      }
    );

    this.elements.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });
  }

  private async loadSettings() {
    try {
      const settings = await ipcRenderer.invoke('get-settings');
      if (settings) {
        this.elements.scrapybaraKey.value = settings.scrapybaraKey || '';
        this.elements.anthropicKey.value = settings.anthropicKey || '';
        this.elements.openaiKey.value = settings.openaiKey || '';
      }
    } catch (error) {
      debug.error('Failed to load settings:', error);
    }
  }

  private async saveSettings() {
    try {
      const settings = {
        scrapybaraKey: this.elements.scrapybaraKey.value,
        anthropicKey: this.elements.anthropicKey.value,
        openaiKey: this.elements.openaiKey.value,
      };

      await ipcRenderer.invoke('save-settings', settings);
      window.close();
    } catch (error) {
      debug.error('Failed to save settings:', error);
    }
  }
}

new SettingsWindow(); 