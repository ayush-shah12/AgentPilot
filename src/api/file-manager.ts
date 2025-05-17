import { writeFile } from "fs/promises";
import { ToolResult } from "./scrapypilot";
import * as path from "path";
import { mkdir } from "fs/promises";

export interface DownloadFileRequest {
  fileName: string;
  fileContent: string;
  fileEncoding: string;
  fileExtension: string;
}

export class FileManager {
  private downloadPath: string;

  constructor(downloadPath: string = path.join(__dirname, "../downloads")) {
    this.downloadPath = downloadPath;
  }

  async createAndSaveFile(request: DownloadFileRequest): Promise<ToolResult> {
    const filePath = path.join(
      this.downloadPath,
      `${request.fileName}.${request.fileExtension}`
    );

    try {

      await mkdir(this.downloadPath, { recursive: true });

      if (request.fileEncoding === "base64") {
        const buffer = Buffer.from(request.fileContent, "base64");
        await writeFile(filePath, buffer);
        return {
          output: filePath,
        } as ToolResult;
      } else {
        await writeFile(filePath, request.fileContent);
        return {
          output: filePath,
        } as ToolResult;
      }
    } catch (error) {
      return {
        error: error,
      } as ToolResult;
    }
  }
}
