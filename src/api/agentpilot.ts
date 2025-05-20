import { Scrapybara, ScrapybaraClient } from 'scrapybara';
import { BaseInstance, BrowserInstance } from 'scrapybara/ScrapybaraClient';
import { BROWSER_SYSTEM_PROMPT } from 'scrapybara/anthropic';
import { computerTool } from 'scrapybara/tools';

import { chromium } from 'playwright';


export interface ModelConfig {
  provider: 'anthropic' | 'openai';
  name: string;
}

export interface APIConfig {
  scrapybaraKey: string;
  anthropicKey?: string;
  openaiKey?: string;
}

export const AVAILABLE_MODELS = {
  anthropic: [
    'claude-3-7-sonnet-20250219',
    'claude-3-7-sonnet-20250219-thinking',
    'claude-3-5-sonnet-20241022',
  ],
  openai: ['computer-use-preview'],
};

export class AgentPilot {
  private client: ScrapybaraClient;
  private model: Scrapybara.Model;
  private instanceID: string | null = null;
  private instance: BaseInstance | null = null;
  private streamURL: string | null = null;
  private cdpURL: string | null = null;
  private tools: Scrapybara.Tool[] = [];
  private actInProgress: boolean = false; // mutex to prevent concurrent act() calls
  private onStep: ((step: any) => void) | null = null;

  constructor(modelConfig?: ModelConfig, apiConfig?: APIConfig) {
    // initialize scrapybara client and anthropic model
    if (!apiConfig?.scrapybaraKey) {
      throw new Error('Scrapybara API key is required');
    }

    this.client = new ScrapybaraClient({
      apiKey: apiConfig.scrapybaraKey,
    });

    const anthropicKey = apiConfig?.anthropicKey || undefined;
    const openaiKey = apiConfig?.openaiKey || undefined;

    // Use the provided model configuration or default to Claude 3.7 Sonnet
    if (modelConfig) {
      if (modelConfig.provider === 'anthropic') {
        this.model = {
          provider: 'anthropic',
          name: modelConfig.name,
          apiKey: anthropicKey,
        };
      } else if (modelConfig.provider === 'openai') {
        this.model = {
          provider: 'openai',
          name: modelConfig.name,
          apiKey: openaiKey,
        };
      } else {
        // Default to Claude 3.7 Sonnet if invalid provider
        this.model = {
          provider: 'anthropic',
          name: 'claude-3-7-sonnet-20250219',
          apiKey: anthropicKey,
        };
      }
    } else {
      // Default model if none provided
      this.model = {
        provider: 'anthropic',
        name: 'claude-3-7-sonnet-20250219',
        apiKey: anthropicKey,
      };
    }
  }

  async init(): Promise<string | null> {
    // start the instance
    const browser = await this.client.startBrowser({}, { timeoutInSeconds: 1000 });
    this.instance = browser;
    this.instanceID = browser.id;
    this.tools.push(computerTool(this.instance));
    this.streamURL = (await this.instance.getStreamUrl()).streamUrl;

    // utilize playwright to navigate to bing to avoid google bot detection
    this.cdpURL = (await (this.instance as BrowserInstance).getCdpUrl()).cdpUrl;
    const b = await chromium.connectOverCDP(this.cdpURL);
    const page = await b.newPage();
    await page.goto('https://www.bing.com');

    return this.streamURL;
  }

  async act(userInput: string): Promise<void> {
    // Return early if an act is already in progress
    if (this.actInProgress) {
      return;
    }

    this.actInProgress = true;

    try {
      for await (const step of this.client.actStream({
        model: this.model,
        tools: this.tools,
        prompt: userInput,
        system: BROWSER_SYSTEM_PROMPT + '\n\n' + 'If you are given a specific URL, you must use the search bar at the very top of the page to navigate to that URL. Do not use the search bar in the middle of the page if you are given a specific URL.',
        onStep: step => {
          console.log('[AgentPilot Step]', step);

          // call the provided callback to update the UI
          if (this.onStep && typeof this.onStep === 'function') {
            this.onStep(step);
          }
        },
      })) {
      }
    } finally {
      // unlock
      this.actInProgress = false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.stop();
      this.instance = null;
      this.instanceID = null;
      this.streamURL = null;
      this.tools = [];
    }
  }

  async pause(): Promise<void> {
    if (this.instance) {
      await this.instance.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.instance) {
      await this.instance.resume();
    }
  }

  getInstanceId(): string | null {
    return this.instanceID;
  }

  setOnStep(callback: (step: any) => void): void {
    this.onStep = callback;
  }

  getOnStep(): ((step: any) => void) | null {
    return this.onStep;
  }
}
