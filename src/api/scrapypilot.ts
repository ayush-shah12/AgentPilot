import Anthropic from "@anthropic-ai/sdk";
import {
  BetaToolResultBlockParam,
  BetaMessageParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { ScrapybaraClient } from "scrapybara";
import { Instance } from "scrapybara/wrapper/ScrapybaraClient";
import { chromium } from "playwright";
import { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  BashRequest,
  ComputerRequest,
  EditRequest,
} from "scrapybara/api/index";
import { ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources";

import { BetaToolUseBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { DownloadFileRequest, FileManager } from "./file-manager";

import dotenv from "dotenv";
dotenv.config();

export interface ToolResult {
  output?: string;
  error?: string;
  base64_image?: string;
  system?: any;
}

export class ScrapyPilot {
  private scrapybaraClient: ScrapybaraClient;
  private anthropicClient: Anthropic;
  private instanceId: string | null = null;
  private instance: Instance | null = null;
  private tools: BetaToolUnion[];
  private SYSTEM_PROMPT: string;
  private cpdURL: string | null = null;

  constructor() {
    this.scrapybaraClient = new ScrapybaraClient({
      apiKey: process.env.SCRAPYBARA_API_KEY,
    });
    this.anthropicClient = new Anthropic(); // loaded from .env
    this.tools = [
      {
        type: "computer_20241022",
        name: "computer",
        display_width_px: 1024,
        display_height_px: 768,
        display_number: 1,
      },
      {
        name: "bash",
        type: "bash_20241022",
      },
      {
        name: "str_replace_editor",
        type: "text_editor_20241022",
      },
      {
        name: "download_file",
        description:
          "Download file from remote instance to local pc. Call this tool whenever a user requests a file download.",
        input_schema: {
          type: "object",
          properties: {
            fileName: {
              type: "string",
              description:
                "A descriptive name of the file to download without the extension.",
            },
            fileContent: {
              type: "string",
              description: "The content of the file to download.",
            },
            fileEncoding: {
              type: "string",
              description:
                "The encoding of the file to download either base64 or raw text.",
            },
            fileExtension: {
              type: "string",
              description: "The file extension of the file to download.",
            },
          },
          required: [
            "fileName",
            "fileContent",
            "fileEncoding",
            "fileExtension",
          ],
        },
      },
    ];

    this.SYSTEM_PROMPT = `   
    <SYSTEM_CAPABILITY>
    * You are utilising an Ubuntu virtual machine using linux architecture with internet access.
    * You can feel free to install Ubuntu applications with your bash tool. Use curl instead of wget.
    * To open Chrome, please just click on the Chrome icon. Note, Chrome is what is installed on your system.
    * Using bash tool you can start GUI applications, but you need to set export DISPLAY=:1 and use a subshell. For example "(DISPLAY=:1 xterm &)". GUI apps run with bash tool will appear within your desktop environment, but they may take some time to appear. Take a screenshot to confirm it did.
    * When using your bash tool with commands that are expected to output very large quantities of text, redirect into a tmp file and use str_replace_editor or grep -n -B <lines before> -A <lines after> <query> <filename> to confirm output.
    * When viewing a page it can be helpful to zoom out so that you can see everything on the page. Either that, or make sure you scroll down to see everything before deciding something isn't available.
    * When using your computer function calls, they take a while to run and send back to you. Where possible/feasible, try to chain multiple of these calls all into one function calls request.
    * The current date is {{ time_now }}
    </SYSTEM_CAPABILITY>

    <IMPORTANT>
    * When using Chrome, if a startup wizard appears, IGNORE IT. Do not even click "skip this step". Instead, click on the address bar where it says "Search or enter address", and enter the appropriate search term or URL there.
    * If the item you are looking at is a pdf, if after taking a single screenshot of the pdf it seems that you want to read the entire document instead of trying to continue to read the pdf from your screenshots + navigation, determine the URL, use curl to download the pdf, install and use pdftotext to convert it to a text file, and then read that text file directly with your StrReplaceEditTool.
    * If you are at the beginning of the conversation and take a screenshot, the screen may show up black. In this case just move the mouse to the center of the screen and do a left click. Then screenshot again.
    * If something is not working for second time, stop trying, make final message without tool calls and ask user for help.
    * Sometimes you start at ALREADY open page. If you want to search something, make sure you use CHROME SEARCH BAR, not the website one if it has one. Do not get confused!
    * Please do not try to login or try to get access to information behind login page, it is still in development.
    * If you are interrupted by stupid popups close them as fast as possible, do not try to refresh the page or wait.
    * If you are asked to download a file to a users local computer, utilize the download_file tool, Everything that is not an image or pdf should be saved as raw text with a correct extension. If you are saving a pdf, save it as a pdf.
    </IMPORTANT>

    Guidelines:
    - Launch GUI apps using bash with DISPLAY=:1 
    - Take screenshots to verify your actions
    - Look for compelling reasons to engage
    - When you are done, submit a final message to user with the final results"
  `;
  }

  async startInstance(
    instanceType: "small" | "medium" | "large" = "small",
    timeoutHours = 0.05
  ): Promise<string | null> {
    try {
      const instance: Instance = await this.scrapybaraClient.start({
        instanceType,
        timeoutHours,
      });
      console.log("Started instance");
      this.instance = instance;
      this.instanceId = instance.id;
      return instance.id;
    } catch (error) {
      console.error(`Error starting instance: ${error}`);
      return null;
    }
  }

  async stopInstance(): Promise<void> {
    if (!this.instanceId) return;
    try {
      if (this.instance) {
        await this.instance.stop();
        this.instanceId = null;
        console.log("Stopped instance");
      }
    } catch (error) {
      console.error(`Error stopping instance: ${error}`);
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.cpdURL) {
      if (this.instance) {
        this.cpdURL = (await this.instance?.browser.start()).cdpUrl;
        const browser = await chromium.connectOverCDP(this.cpdURL);
        const page = await browser.newPage();
        await page.goto(url);
      }
    }
  }

  response_to_params(response: BetaMessage): BetaMessageParam[] {
    let messages: BetaMessageParam[] = [];
    for (const message of response.content) {
      if (message.type === "text") {
        messages.push({ role: "assistant", content: message.text });
      } else if (message.type === "tool_use") {
        const toolUseBlock: BetaToolUseBlockParam = {
          id: message.id,
          input: message.input,
          name: message.name,
          type: "tool_use",
        };

        messages.push({
          role: "assistant",
          content: [toolUseBlock],
        });
      }
    }
    return messages;
  }

  make_api_tool_result(
    result: ToolResult,
    tool_use_id: string
  ): BetaToolResultBlockParam | string {
    let tool_result: string | Array<TextBlockParam | ImageBlockParam> = [];
    let is_error: boolean = false;

    if (result.error) {
      is_error = true;
      tool_result = result.error;
    } else {
      if (result.output) {
        tool_result.push({ type: "text", text: result.output });
      }
      if (result.base64_image) {
        tool_result.push({
          type: "image",
          source: {
            type: "base64",
            data: result.base64_image,
            media_type: "image/png",
          },
        });
      }
    }

    return {
      type: "tool_result",
      content: tool_result as Array<TextBlockParam | ImageBlockParam> | string,
      is_error: is_error,
      tool_use_id: tool_use_id,
    };
  }

  async run(userPrompt: string, filePath?: string): Promise<void> {
    try {
      if (!this.instanceId) await this.startInstance();

      console.log("Navigating to Google");
      await this.navigateTo("https://www.google.com");
      console.log("Navigated to Google");

      let messages: BetaMessageParam[] = [
        { role: "user", content: userPrompt },
      ];

      while (true) {
        let response: BetaMessage;
        try {
          response = await this.anthropicClient.beta.messages.create({
            model: "claude-3-5-sonnet-latest",
            max_tokens: 4096,
            messages: messages,
            system: [{ type: "text", text: this.SYSTEM_PROMPT }],
            tools: this.tools,
            betas: ["computer-use-2024-10-22"],
          });
        } catch (error) {
          console.error("Error during Claude Call:", error);
          await this.stopInstance();
          return;
        }

        const response_params = this.response_to_params(response);
        const tool_result_content: BetaToolResultBlockParam[] = [];

        for (const content_block of response_params) {
          if (typeof content_block.content === "string") {
            // means type was text
            console.log("Assistant Response:");
            console.log(content_block.content);
          } else if (Array.isArray(content_block.content)) {
            console.log("Tool use requested");
            if (content_block.content[0].type === "tool_use") {
              console.log(
                content_block.content[0].name +
                " " +
                content_block.content[0].input
              );

              let tool_use_id: string = content_block.content[0].id;

              let result: ToolResult | null = null;

              if (content_block.content[0].name === "computer") {
                let r = await this.instance?.computer(
                  content_block.content[0].input as ComputerRequest
                );
                result = r as ToolResult;
              } else if (content_block.content[0].name === "bash") {
                let r = await this.instance?.bash(
                  content_block.content[0].input as BashRequest
                );
                result = r as ToolResult;
              } else if (
                content_block.content[0].name === "str_replace_editor"
              ) {
                let r = await this.instance?.edit(
                  content_block.content[0].input as EditRequest
                );
                result = r as ToolResult;
              } else if (content_block.content[0].name === "download_file") {
                let request = content_block.content[0]
                  .input as DownloadFileRequest;
                let file = new FileManager();
                let r = await file.createAndSaveFile(request);
                result = r as ToolResult;
              } else {
                console.log("Tool not found");
              }

              if (result) {
                let tool_result: BetaToolResultBlockParam | string;

                tool_result = this.make_api_tool_result(result, tool_use_id);
                if (result.output) {
                  console.log("Tool Output:");
                  console.log(result.output);
                }
                if (result.error) {
                  console.log("Tool Error:");
                  console.log(result.error);
                }

                tool_result_content.push(
                  tool_result as BetaToolResultBlockParam
                );
              } else {
                console.log("Tool result is null");
              }
            }
          }
        }

        for (const betaMessage of response_params) {
          if (betaMessage.content) {
            messages.push({
              role: "assistant",
              content: betaMessage.content,
            });
          }
        }

        if (tool_result_content.length > 0) {
          messages.push({
            role: "user",
            content: tool_result_content,
          });
        } else {
          await this.stopInstance();
          console.log("End of sampling loop");
          break;
        }
      }
    } catch (error) {
      console.error(`Error in run method: ${error}`);
      await this.stopInstance();
    }
  }
}
