import { describe, expect, test } from "@jest/globals";
import { readFile } from "fs/promises"; 
import { SimpleStream } from "@rdfc/js-runner";
import { globRead, readFolder, substitute, envsub, getFileFromFolder, unzipFile } from "../src/FileUtils";

describe("Functional tests for the globRead RDF-Connect function", () => {
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

describe("Functional tests for the readFolder RDF-Connect function", () => {
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

describe("Functional tests for the substitute RDF-Connect function", () => {
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

describe("Functional tests for the environment substitute RDF-Connect function", () => {
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

describe("Functional tests for the file reader RDF-Connect function", () => {
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

describe("Functional tests for the unzip file RDF-Connect function", () => {
    test("Given zipped file is unzipped and streamed out", async () => {
        const readStream = new SimpleStream<Buffer>();
        const writeStream = new SimpleStream<string>();

        writeStream.data(data => {
            expect(data.includes("<RINFData>")).toBeTruthy();
        });

        // Execute function of processor
        unzipFile(readStream, writeStream);

        await readStream.push(await readFile("tests/test.zip"));
        await readStream.end();
    });
});