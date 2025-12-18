import { describe, expect, test } from "vitest";
import { readFile, unlink } from "fs/promises";
import {
    Envsub,
    FileWriter,
    GetFileFromFolder,
    GlobRead,
    GunzipFile,
    ReadFolder,
    Substitute,
    UnzipFile,
} from "../src/FileUtils";
import { FullProc, Reader } from "@rdfc/js-runner";
import { channel, createRunner } from "@rdfc/js-runner/lib/testUtils";
import { createLogger, transports } from "winston";
import { createReadStream } from "fs";

const logger = createLogger({
    transports: new transports.Console({
        level: process.env["DEBUG"] || "info",
    }),
});

async function strings(reader: Reader) {
    const out: string[] = [];

    for await (const st of reader.strings()) {
        out.push(st);
    }

    return out;
}

describe("Functional tests for the globRead RDF-Connect function", () => {
    test("Given a glob pattern files are read and streamed out", async () => {
        expect.assertions(1);

        const runner = createRunner();
        const [writeStream, reader] = channel(runner, "input");

        const sts = strings(reader);

        const proc = new GlobRead(
            {
                writer: writeStream,
                binary: false,
                closeOnEnd: true,
                wait: 0,
                globPattern: "./tests/*.ts",
            },
            logger,
        ) as FullProc<GlobRead>;

        await proc.init();

        await Promise.all([proc.produce(), proc.transform()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
    });
});

describe("Functional tests for the readFolder RDF-Connect function", () => {
    test("Given a folder path files are read and streamed out", async () => {
        expect.assertions(1);

        const runner = createRunner();
        const [writeStream, reader] = channel(runner, "input");

        const sts = strings(reader);

        const proc = new ReadFolder(
            {
                writer: writeStream,
                folder: "./tests",
                maxMemory: 1000,
                pause: 0,
            },
            logger,
        ) as FullProc<ReadFolder>;

        await proc.init();

        await Promise.all([proc.produce(), proc.transform()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
    });
});

describe("Functional tests for the substitute RDF-Connect function", () => {
    test("Given an input text stream content is adjusted according to a given pattern", async () => {
        expect.assertions(2);

        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const [writer, outputReader] = channel(runner, "output");

        const sts = strings(outputReader);

        const proc = new Substitute(
            {
                reader,
                writer,
                regexp: false,
                replace: "Good Text",
                source: "{REPLACE_ME}",
            },
            logger,
        ) as FullProc<Substitute>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        inputWriter.string("This text should be {REPLACE_ME}");
        inputWriter.close();
        await Promise.all([t, proc.produce()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0]).toBe("This text should be Good Text");
    });
});

describe("Functional tests for the environment substitute RDF-Connect function", () => {
    test("Given an input text stream, content is adjusted according to defined environment variables", async () => {
        expect.assertions(2);

        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const [writer, outputReader] = channel(runner, "output");

        const sts = strings(outputReader);

        // Set environment variable
        process.env["REPLACE_ME"] = "Good Text";

        const proc = new Envsub(
            {
                reader,
                writer,
            },
            logger,
        ) as FullProc<Envsub>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        inputWriter.string("This text should be ${REPLACE_ME}");
        inputWriter.close();
        await Promise.all([t, proc.produce()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0]).toBe("This text should be Good Text");
    });
});

describe("Functional tests for the file reader RDF-Connect function", () => {
    test("Given file name is read and pushed downstream", async () => {
        expect.assertions(2);

        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const [writer, outputReader] = channel(runner, "output");

        const sts = strings(outputReader);

        const proc = new GetFileFromFolder(
            {
                reader,
                writer,
                folderPath: ".",
            },
            logger,
        ) as FullProc<GetFileFromFolder>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();

        inputWriter.string("LICENSE");
        inputWriter.close();

        await Promise.all([t, proc.produce()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0].startsWith("MIT License")).toBeTruthy();
    });
});

describe("Functional tests for the unzip file RDF-Connect function", () => {
    test("Given zipped file is unzipped and streamed out", async () => {
        expect.assertions(2);

        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const [writer, outputReader] = channel(runner, "output");

        const sts = strings(outputReader);

        const proc = new UnzipFile(
            {
                reader,
                writer,
            },
            logger,
        ) as FullProc<UnzipFile>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        inputWriter.buffer(await readFile("tests/data/test.zip"));
        inputWriter.close();

        await Promise.all([t, proc.produce()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0].includes("<RINFData>")).toBeTruthy();
    });
});

describe("Functional tests for the gunzip file RDF-Connect function", () => {
    test("Given gzipped file is gunzipped and streamed out", async () => {
        expect.assertions(2);

        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const [writer, outputReader] = channel(runner, "output");

        const sts = strings(outputReader);

        const proc = new GunzipFile(
            {
                reader,
                writer,
            },
            logger,
        ) as FullProc<GunzipFile>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        inputWriter.stream(
            (async function* () {
                yield* createReadStream("tests/data/test.gz");
            })(),
        );
        inputWriter.close();

        await Promise.all([t, proc.produce()]);

        const msgs = await sts;
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0].includes("<RINFData>")).toBeTruthy();
    });
});

describe("Functional tests for the FileWriter processor function", () => {
    test("FileWriter writes input string to file", async () => {
        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const proc = new FileWriter(
            {
                input: reader,
                filePath: "./output.txt",
            },
            logger,
        ) as FullProc<FileWriter>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        inputWriter.string("This is a test string.");
        inputWriter.close();
        await Promise.all([t, proc.produce()]);

        const fileContent = await readFile("./output.txt", {
            encoding: "utf-8",
        });
        expect(fileContent).toBe("This is a test string.");

        // Clean up
        await unlink("./output.txt");
    });

    test("FileWriter writes input binary to file", async () => {
        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const proc = new FileWriter(
            {
                input: reader,
                filePath: "./output.bin",
                binary: true,
            },
            logger,
        ) as FullProc<FileWriter>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        const binaryData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        inputWriter.buffer(binaryData);
        inputWriter.close();
        await Promise.all([t, proc.produce()]);

        const fileContent = await readFile("./output.bin");
        expect(new Uint8Array(fileContent)).toEqual(binaryData);

        // Clean up
        await unlink("./output.bin");
    });

    test("FileWriter writes input stream to file", async () => {
        const runner = createRunner();
        const [inputWriter, reader] = channel(runner, "input");
        const proc = new FileWriter(
            {
                input: reader,
                filePath: "./output_stream.txt",
                readAsStream: true,
            },
            logger,
        ) as FullProc<FileWriter>;

        await proc.init();
        const t = proc.transform();
        await Promise.resolve();
        inputWriter.stream(
            (async function* () {
                yield* createReadStream("tests/data/test.txt");
            })(),
        );
        inputWriter.close();
        await Promise.all([t, proc.produce()]);

        const fileContent = await readFile("./output_stream.txt", {
            encoding: "utf-8",
        });
        expect(fileContent).toBe("This is a test file");

        // Clean up
        await unlink("./output_stream.txt");
    });
});
