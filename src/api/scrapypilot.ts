import { Scrapybara, ScrapybaraClient } from 'scrapybara';
import { BaseInstance } from 'scrapybara/ScrapybaraClient';
import { BROWSER_SYSTEM_PROMPT } from 'scrapybara/anthropic';
import { computerTool } from 'scrapybara/tools';

import dotenv from 'dotenv';

export class ScrapyPilot {
  private client: ScrapybaraClient;
  private model: Scrapybara.Model;
  private instanceID: string | null = null;
  private instance: BaseInstance | null = null;
  private streamURL: string | null = null;
  private tools: Scrapybara.Tool[] = [];

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

    return this.streamURL;
  }

  async act(userInput: string): Promise<void> {
    this.client.act({
      model: this.model,
      tools: this.tools,
      prompt: userInput,
      system: BROWSER_SYSTEM_PROMPT,
    });

    this.instance?.stop();
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
}
