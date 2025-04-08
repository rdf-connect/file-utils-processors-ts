import { readFile } from "fs/promises";
import { describe, expect, test } from "vitest";
import { NamedNode, Parser, Term } from "n3";
import { extractShapes, Shapes } from "rdf-lens";
import {
    GetMyClassT,
    Processor,
    Runner,
    WriterInstance,
    ReaderInstance,
} from "@rdfc/js-runner";
import { TestClient } from "./util";
import { createLogger, transports } from "winston";
import { OrchestratorMessage } from "@rdfc/js-runner/lib/reexports";
import { getProcessorShape } from "@rdfc/js-runner/lib/testUtils";
import {
    GlobRead,
    ReadFolder,
    UnzipFile,
    Envsub,
    Substitute,
    GetFileFromFolder,
} from "../src/FileUtils";

describe("File Utils tests", async () => {
    const logger = createLogger({ transports: [new transports.Console()] });
    const baseIRI = process.cwd() + "/processors.ttl";
    const configFile = await readFile(baseIRI, { encoding: "utf8" });
    const configQuads = new Parser({ baseIRI: "file://" + baseIRI }).parse(
        configFile,
    );

    const shapes = extractShapes(configQuads);
    const base = "https://w3id.org/rdf-connect/ontology#";
    const defined = [
        "GlobRead",
        "FolderRead",
        "Substitute",
        "Envsub",
        "ReadFile",
        "UnzipFile",
        "GunzipFile",
    ];

    const processorShape: Shapes = await getProcessorShape();

    async function getProc<T extends Processor<unknown>>(
        config: string,
        ty: string,
        uri = "http://example.com/ns#processor",
    ): Promise<T & GetMyClassT<T>> {
        const msgs: OrchestratorMessage[] = [];
        const write = async (x: OrchestratorMessage) => {
            msgs.push(x);
        };
        const runner = new Runner(
            new TestClient(),
            write,
            "http://example.com/ns#",
            logger,
        );
        await runner.handleOrchMessage({ pipeline: configFile + config });

        const procConfig = processorShape.lenses["JsProcessorShape"].execute({
            id: new NamedNode(base + ty),
            quads: configQuads,
        });

        console.log(procConfig);
        const proc = await runner.addProcessor<T>({
            config: JSON.stringify(procConfig),
            arguments: "",
            uri,
        });
        return proc;
    }

    test("Shapes are all defined", () => {
        const names = Object.keys(shapes.lenses);
        for (const n of defined) {
            expect(names).includes(
                base + n,
                "Expected " + n + " to be defined.",
            );
        }

        // PathLens, CBD, Context, TypedExtract are always defined
        expect(
            names.length,
            "Unexpected name " +
                names.filter((x) => !defined.includes(x.replace(base, ""))),
        ).toBe(defined.length + 4);
    });

    test("Processors follow the required shape", () => {
        for (const n of defined) {
            const proc = <{ file: Term; location: string; clazz: string }>(
                processorShape.lenses["JsProcessorShape"].execute({
                    id: new NamedNode(base + n),
                    quads: configQuads,
                })
            );
            expect(proc.file, n + " has file").toBeDefined();
            expect(proc.location, n + " has location").toBeDefined();
            expect(proc.clazz, n + " has clazz").toBeDefined();
        }
    });

    test("js:GlobRead is properly defined", async () => {
        const proc = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfc:GlobRead; 
                js:glob "./*.json"; 
                js:output <jw>;
                js:wait 0;
                js:closeOnEnd true;
                js:binary true.`,
            "GlobRead",
        );

        expect(proc.constructor.name).toBe(GlobRead.name);

        expect(proc.globPattern).toBe("./*.json");
        expect(proc.wait).toBe(0);
        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.closeOnEnd).toBe(true);
        expect(proc.binary).toBe(true);
    });

    test("js:FolderRead is properly defined", async () => {
        const proc = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfc:FolderRead; 
                js:folder_location "./src"; 
                js:file_stream <jw>;
                js:max_memory 3.5;
                js:pause 3000.`,
            "FolderRead",
        );

        expect(proc.folder).toBe("./src");
        expect(proc.maxMemory).toBe(3.5);
        expect(proc.pause).toBe(3000);
        expect(proc.writer).toBeInstanceOf(WriterInstance);
    });

    test("js:Envsub is properly defined", async () => {
        const proc = await getProc<Envsub>(
            `<http://example.com/ns#processor> a rdfc:Envsub; 
                js:input <jr>; 
                js:output <jw>.`,
            "Envsub",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
    });

    test("js:Substitute is properly defined", async () => {
        const proc = await getProc<Substitute>(
            `<http://example.com/ns#processor> a rdfc:Substitute; 
                js:input <jr>;
                js:output <jw>;
                js:source "life";
                js:replace "42";
                js:regexp false.`,
            "Substitute",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
        expect(proc.source).toBe("life");
        expect(proc.replace).toBe("42");
        expect(proc.regexp).toBe(false);
    });

    test("js:ReadFile is properly defined", async () => {
        const proc = await getProc<GetFileFromFolder>(
            `<http://example.com/ns#processor> a rdfc:ReadFile; 
                js:input <jr>;
                js:output <jw>;
                js:folderPath ".".`,
            "ReadFile",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
        expect(proc.folderPath).toBe(".");
    });

    test("js:UnzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfc:UnzipFile; 
                js:input <jr>;
                js:output <jw>.`,
            "UnzipFile",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
    });

    test("js:GunzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfc:GunzipFile; 
                js:input <jr>;
                js:output <jw>.`,
            "GunzipFile",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
    });
});
