import { Scrapybara, ScrapybaraClient } from 'scrapybara';
import { BaseInstance, BrowserInstance } from 'scrapybara/ScrapybaraClient';
import { BROWSER_SYSTEM_PROMPT } from 'scrapybara/anthropic';
import { computerTool } from 'scrapybara/tools';

import { chromium } from 'playwright';

import dotenv from 'dotenv';

export class ScrapyPilot {
  private client: ScrapybaraClient;
  private model: Scrapybara.Model;
  private instanceID: string | null = null;
  private instance: BaseInstance | null = null;
  private streamURL: string | null = null;
  private cdpURL: string | null = null;
  private tools: Scrapybara.Tool[] = [];
  private actInProgress: boolean = false; // mutex to prevent concurrent act() calls
  private onStep: ((step: any) => void) | null = null;

  constructor() {
    // initialize scrapybara client and anthropic model

    dotenv.config();

    this.client = new ScrapybaraClient({
      apiKey: process.env.SCRAPYBARA_API_KEY,
    });

    this.model = {
      provider: 'anthropic',
      name: 'claude-3-7-sonnet-20250219',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    };
  }

  async init(): Promise<string | null> {
    // start the instance
    const browser = await this.client.startBrowser();
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
        system: BROWSER_SYSTEM_PROMPT,
        onStep: (step) => {
          console.log("[ScrapyPilot Step]", step);
          
          // call the provided callback to update the UI
          if (this.onStep && typeof this.onStep === 'function') {
            this.onStep(step);
          }
        }
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
