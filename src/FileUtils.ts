import { Processor, Reader, Writer } from "@rdfc/js-runner";
import path from "path";
import { memoryUsage } from "node:process";
import { access, readdir, readFile } from "fs/promises";
import { glob } from "glob";
import AdmZip from "adm-zip";
import * as zlib from "node:zlib";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";

type GlobReadInp = {
  globPattern: string,
  writer: Writer,
  wait: number,
  closeOnEnd: boolean,
  binary: boolean,
}
export class GlobRead extends Processor<GlobReadInp> {
  files: Buffer<ArrayBufferLike>[] = []

  async init(this: GlobReadInp & this): Promise<void> {
    this.wait = this.wait ?? 0;
    this.closeOnEnd = this.closeOnEnd ?? true;
    this.binary = this.binary ?? false;
    const jsfiles = await glob(this.globPattern, {});

    console.log("JsFiles " + JSON.stringify(jsfiles));
    this.files = await Promise.all(
      jsfiles.map((x) => {
        this.logger.info(`Reading file '${x}' (from glob pattern '${this.globPattern}')`);
        return readFile(x);
      }),
    );
  }
  async transform(this: GlobReadInp & this): Promise<void> {
    // nothing
  }
  async produce(this: GlobReadInp & this): Promise<void> {
    for (const file of this.files) {

      // If it is larger then 5 mega bytes, stream it over
      if (file.length > 5 * 1024 * 1024) {
        await this.writer.stream((async function*() { yield file })());
      } else {
        await this.writer.buffer(file);
      }
      await new Promise((res) => setTimeout(res, this.wait));
    }

    if (this.closeOnEnd) {
      // Signal that all files were streamed
      await this.writer.close();
    }
  }
}

async function* readFileInChunks(filePath: string, highWaterMark: number | undefined = 1024) {
  const stream = createReadStream(filePath, { highWaterMark })

  for await (const chunk of stream) {
    yield chunk;
  }
}

type ReadFolderArg = {
  folder: string,
  writer: Writer,
  maxMemory: number,
  pause: number,
}
export class ReadFolder extends Processor<ReadFolderArg> {
  fileNames: string[]
  normalizedPath: string
  async init(this: ReadFolderArg & this): Promise<void> {
    this.maxMemory = this.maxMemory ?? 3;
    this.pause = this.pause ?? 5000;

    this.normalizedPath = path.normalize(this.folder);

    // Check folder exists
    await access(this.normalizedPath);

    // Read folder content and iterate over each file
    this.fileNames = await readdir(this.normalizedPath, { recursive: true });
    this.logger.info(`Reading these files: ${this.fileNames}`);
  }
  async transform(this: ReadFolderArg & this): Promise<void> {
    // nothing
  }
  async produce(this: ReadFolderArg & this): Promise<void> {
    for (const fileName of this.fileNames) {
      // Monitor process memory to avoid high-water memory crashes
      this.logger.info(`[readFolder] processing '${fileName}'`);
      if (memoryUsage().heapUsed > this.maxMemory * 1024 * 1024 * 1024) {
        this.logger.warn(`[readFolder] Phew! too much data (used ${Math.round((memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} Mb)...waiting for ${this.pause / 1000}s`);
        await sleep(this.pause);
      }

      const stats = await stat(path.join(this.normalizedPath))

      if (stats.size > 5 * 1024 * 1024) {
        await this.writer.stream(readFileInChunks(path.join(this.normalizedPath, fileName)))
      } else {
        const msg = await readFile(path.join(this.normalizedPath, fileName))
        await this.writer.buffer(msg);
      }
    }

    // Signal that all files were streamed
    await this.writer.close();
  }

}

function sleep(x: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, x));
}

type SubstituteArgs = {
  reader: Reader,
  writer: Writer,
  source: string,
  replace: string,
  regexp: boolean,
}

export class Substitute extends Processor<SubstituteArgs> {
  reg: RegExp | string;
  async init(this: SubstituteArgs & this): Promise<void> {
    this.reg = this.regexp ? new RegExp(this.source) : this.source;
  }
  async transform(this: SubstituteArgs & this): Promise<void> {
    for await (const msg of this.reader.strings()) {
      this.logger.info(`Replacing '${this.source}' by '${this.replace}' on input text`);
      await this.writer.string(msg.replaceAll(this.reg, this.replace));
    }
    this.logger.info("Writer closed, so closing reader as well.");
    await this.writer.close()
  }
  async produce(this: SubstituteArgs & this): Promise<void> {
    // nothing
  }
}

type EnvSubArgs = {
  reader: Reader, writer: Writer
}
export class Envsub extends Processor<EnvSubArgs> {
  async init(this: EnvSubArgs & this): Promise<void> {
    // nothing
  }
  async transform(this: EnvSubArgs & this): Promise<void> {
    const env = process.env;
    for await (let x of this.reader.strings()) {
      this.logger.info("Replacing environment variable on input text");
      Object.keys(env).forEach(key => {
        const v = env[key];
        if (v) {
          x = x.replaceAll(`\${${key}}`, v);
        }
      });

      await this.writer.string(x);
    }
    await this.writer.close()
  }
  async produce(this: EnvSubArgs & this): Promise<void> {
    // nothing
  }
}

type GetFileFromFolderArgs = {
  reader: Reader, folderPath: string, writer: Writer
}

export class GetFileFromFolder extends Processor<GetFileFromFolderArgs> {
  async init(this: GetFileFromFolderArgs & this): Promise<void> {
    // nothing
  }
  async transform(this: GetFileFromFolderArgs & this): Promise<void> {
    for await (const name of this.reader.strings()) {

      const filePath = path.join(path.resolve(this.folderPath), name);
      this.logger.info(`Reading file at '${filePath}'`);
      const f = await stat(filePath);
      if (f.size > 5 * 1024 * 1024) {
        await this.writer.stream(readFileInChunks(filePath))
      } else {
        const file = await readFile(filePath, "utf8");
        await this.writer.string(file);
      }
    }
    await this.writer.close();
  }
  async produce(this: GetFileFromFolderArgs & this): Promise<void> {
    // nothing
  }
}

type UnzipArgs = {
  reader: Reader,
  writer: Writer,
}

export class UnzipFile extends Processor<UnzipArgs> {
  async init(this: UnzipArgs & this): Promise<void> {
    // nothing
  }
  async transform(this: UnzipArgs & this): Promise<void> {
    for await (const data of this.reader.buffers()) {

      try {
        const adm = new AdmZip(Buffer.from(data.buffer));
        for (const entry of adm.getEntries()) {
          this.logger.info(`Unzipping received file '${entry.entryName}'`);
          await this.writer.buffer(entry.getData());
        }
      } catch (ex) {
        this.logger.error("Ignoring invalid ZIP file received");
        this.logger.debug(ex);
      }
    }
    await this.writer.close();
  }
  async produce(this: UnzipArgs & this): Promise<void> {
    // nothing
  }
}

export class GunzipFile extends Processor<UnzipArgs> {
  async init(this: UnzipArgs & this): Promise<void> {
    // nothing
  }
  async transform(this: UnzipArgs & this): Promise<void> {
    const gunzip = promisify(zlib.gunzip);

    for await (const data of this.reader.buffers()) {
      try {
        const buffer = await gunzip(data);
        this.logger.info("Unzipping received file");
        await this.writer.buffer(buffer);
      } catch (ex) {
        this.logger.error("Ignoring invalid ZIP file received");
        this.logger.debug(ex);
      }
    }
    await this.writer.close();
  }
  async produce(this: UnzipArgs & this): Promise<void> {
    // nothing
  }
}

