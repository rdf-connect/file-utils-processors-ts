import { describe, expect, test } from "@jest/globals";
import { SimpleStream } from "@ajuvercr/js-runner";
import { globRead, readFolder, substitute, envsub, getFileFromFolder } from "../src/FileUtils";

describe("Functional tests for the globRead Connector Architecture function", () => {
    test("Given a glob pattern files are read and streamed out", async () => {
        const writeStream = new SimpleStream<string>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
            expect(output.length).toBeGreaterThan(0);
        });

        // Await and execute returned function of processor
        await (await globRead("./tests/*.ts", writeStream))();
    });
});

describe("Functional tests for the readFolder Connector Architecture function", () => {
    test("Given a folder path files are read and streamed out", async () => {
        const writeStream = new SimpleStream<string>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
            expect(output.length).toBeGreaterThan(0);
        });

        // Await and execute returned function of processor
        await (await readFolder("./tests", writeStream))();
    });
});

describe("Functional tests for the substitute Connector Architecture function", () => {
    test("Given an input text stream content is adjusted according to a given pattern", async () => {
        const readStream = new SimpleStream<string>();
        const writeStream = new SimpleStream<string>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
            expect(output).toBe("This text should be Good Text");
        });

        // Await and execute returned function of processor
        substitute(readStream, writeStream, "{REPLACE_ME}", "Good Text");

        await readStream.push("This text should be {REPLACE_ME}");
        await readStream.end();
    });
});

describe("Functional tests for the environment substitute Connector Architecture function", () => {
    test("Given an input text stream, content is adjusted according to defined environment variables", async () => {
        const readStream = new SimpleStream<string>();
        const writeStream = new SimpleStream<string>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
            expect(output).toBe("This text should be Good Text");
        });

        // Set environment variable
        process.env["REPLACE_ME"] = "Good Text";

        // Await and execute returned function of processor
        envsub(readStream, writeStream);

        await readStream.push("This text should be ${REPLACE_ME}");
        await readStream.end();
    });
});

describe("Functional tests for the file reader Connector Architecture function", () => {
    test("Given file name is read and pushed downstream", async () => {
        const readStream = new SimpleStream<string>();
        const writeStream = new SimpleStream<string>();

        let output = "";
        writeStream.data(data => {
            output += data;
        }).on("end", () => {
            expect(output.startsWith("MIT License")).toBeTruthy();
        });

        // Execute function of processor
        getFileFromFolder(readStream, ".", writeStream);

        await readStream.push("LICENSE");
        await readStream.end();
    });
});