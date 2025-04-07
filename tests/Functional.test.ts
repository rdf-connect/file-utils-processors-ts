import { describe, expect, test } from "vitest";
import { readFile } from "fs/promises";
import { ReaderInstance, WriterInstance } from "@rdfc/js-runner";
import { GetMyClassT, TestClient } from "./util";
import { Envsub, GetFileFromFolder, GlobRead, GunzipFile, ReadFolder, Substitute, UnzipFile } from "../src/FileUtils";
import winston, { createLogger } from "winston";
import { OrchestratorMessage } from "@rdfc/js-runner/lib/reexports";

const client = new TestClient()
const uri = 'someUri'
const logger = createLogger({
  transports: new winston.transports.Console({ level: process.env['DEBUG'] && 'info' }),
})
const encoder = new TextEncoder();
const dencoder = new TextDecoder();

function createWriter(): [WriterInstance, OrchestratorMessage[]] {
  const msgs: OrchestratorMessage[] = []
  const writeStream = new WriterInstance(uri, client, async (msg) => {
    msgs.push(msg);
  }, logger)
  return [writeStream, msgs];
}

function createReader(): ReaderInstance {
  const reader = new ReaderInstance(uri, client, logger);
  return reader;
}

describe("Functional tests for the globRead RDF-Connect function", () => {
  test("Given a glob pattern files are read and streamed out", async () => {
    expect.assertions(1);

    const [writeStream, msgs] = createWriter();

    const proc = new GlobRead({
      writer: writeStream,
      binary: false,
      closeOnEnd: true,
      wait: 0,
      globPattern: "./tests/*.ts"
    }, logger) as GetMyClassT<GlobRead>;

    await proc.init();

    await Promise.all([
      proc.produce(),
      proc.transform()]
    )

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
  });
});

describe("Functional tests for the readFolder RDF-Connect function", () => {
  test("Given a folder path files are read and streamed out", async () => {
    expect.assertions(1);

    const [writeStream, msgs] = createWriter();

    const proc = new ReadFolder({
      writer: writeStream,
      folder: "./tests",
      maxMemory: 1000,
      pause: 0,
    }, logger) as GetMyClassT<ReadFolder>;

    await proc.init();

    await Promise.all([
      proc.produce(),
      proc.transform()]
    )

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
  });
});

describe("Functional tests for the substitute RDF-Connect function", () => {
  test("Given an input text stream content is adjusted according to a given pattern", async () => {
    expect.assertions(2);

    const reader = createReader();
    const [writer, msgs] = createWriter();

    const proc = new Substitute(
      {
        reader,
        writer,
        regexp: false,
        replace: "Good Text",
        source: "{REPLACE_ME}"
      }, logger,
    ) as GetMyClassT<Substitute>;

    await proc.init();
    const t = proc.transform()
    await Promise.resolve();
    reader.handleMsg({ channel: uri, data: encoder.encode("This text should be {REPLACE_ME}") })
    reader.close()
    await Promise.all([
      t,
      proc.produce()
    ]);

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
    const msg = msgs.map(x => x.msg).find(x => x)!;
    expect(dencoder.decode(msg.data)).toBe("This text should be Good Text")
  });
});

describe("Functional tests for the environment substitute RDF-Connect function", () => {
  test("Given an input text stream, content is adjusted according to defined environment variables", async () => {
    expect.assertions(2);

    const reader = createReader();
    const [writer, msgs] = createWriter();

    // Set environment variable
    process.env["REPLACE_ME"] = "Good Text";

    const proc = new Envsub(
      {
        reader,
        writer,
      }, logger,
    ) as GetMyClassT<Envsub>;

    await proc.init();
    const t = proc.transform()
    await Promise.resolve();
    reader.handleMsg({ channel: uri, data: encoder.encode("This text should be ${REPLACE_ME}") })
    reader.close()
    await Promise.all([
      t,
      proc.produce()
    ]);

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
    const msg = msgs.map(x => x.msg).find(x => x)!;
    expect(dencoder.decode(msg.data)).toBe("This text should be Good Text")
  });
});

describe("Functional tests for the file reader RDF-Connect function", () => {
  test("Given file name is read and pushed downstream", async () => {
    expect.assertions(2);

    const reader = createReader();
    const [writer, msgs] = createWriter();

    const proc = new GetFileFromFolder(
      {
        reader,
        writer,
        folderPath: "."
      }, logger,
    ) as GetMyClassT<GetFileFromFolder>;

    await proc.init();
    const t = proc.transform()
    await Promise.resolve();
    reader.handleMsg({ channel: uri, data: encoder.encode("LICENSE") })
    reader.close()

    await Promise.all([
      t,
      proc.produce()
    ]);

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
    const msg = msgs.map(x => x.msg).find(x => x)!;
    expect(dencoder.decode(msg.data).startsWith("MIT License")).toBeTruthy()
  });
});

describe("Functional tests for the unzip file RDF-Connect function", () => {
  test("Given zipped file is unzipped and streamed out", async () => {
    expect.assertions(2);

    const reader = createReader();
    const [writer, msgs] = createWriter();

    const proc = new UnzipFile(
      {
        reader,
        writer,
      }, logger,
    ) as GetMyClassT<UnzipFile>;

    await proc.init();
    const t = proc.transform()
    await Promise.resolve();
    reader.handleMsg({ channel: uri, data: await readFile("tests/test.zip") })
    reader.close()

    await Promise.all([
      t,
      proc.produce()
    ]);

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
    const msg = msgs.map(x => x.msg).find(x => x)!;
    expect(dencoder.decode(msg.data).includes("<RINFData>")).toBeTruthy()
  });
});

describe("Functional tests for the gunzip file RDF-Connect function", () => {
  test("Given gzipped file is gunzipped and streamed out", async () => {
    expect.assertions(2);

    const reader = createReader();
    const [writer, msgs] = createWriter();

    const proc = new GunzipFile(
      {
        reader,
        writer,
      }, logger,
    ) as GetMyClassT<GunzipFile>;

    await proc.init();
    const t = proc.transform()
    await Promise.resolve();
    reader.handleMsg({ channel: uri, data: await readFile("tests/test.gz") })
    reader.close()

    await Promise.all([
      t,
      proc.produce()
    ]);

    expect(msgs.filter(x => !!x.msg).length).toBeGreaterThan(0);
    const msg = msgs.map(x => x.msg).find(x => x)!;
    expect(dencoder.decode(msg.data).includes("<RINFData>")).toBeTruthy()
  });
});
