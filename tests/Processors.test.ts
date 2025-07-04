import { readFile } from "fs/promises";
import { describe, expect, test } from "vitest";
import { NamedNode, Parser, Term } from "n3";
import { extractShapes, Shapes } from "rdf-lens";
import {
    FullProc as GetMyClassT,
    Processor,
    Runner,
    WriterInstance,
    ReaderInstance,
} from "@rdfc/js-runner";
import { TestClient } from "./util";
import { createLogger, transports } from "winston";
import { OrchestratorMessage } from "@rdfc/js-runner/lib/reexports";
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
    const configFile =
        (await readFile(baseIRI, { encoding: "utf8" })) +
        "[] a sh:NodeShape; sh:targetClass rdfc:Reader, rdfc:Writer.";
    const configQuads = new Parser({ baseIRI: "file://" + baseIRI }).parse(
        configFile,
    );

    const shapes = extractShapes(configQuads);
    const base = "https://w3id.org/rdf-connect#";
    const defined = [
        "GlobRead",
        "FolderRead",
        "Substitute",
        "Envsub",
        "ReadFile",
        "UnzipFile",
        "GunzipFile",
    ];

    const shapeQuads = `
@prefix rdfc: <https://w3id.org/rdf-connect#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix sh: <http://www.w3.org/ns/shacl#>.
[ ] a sh:NodeShape;
  sh:targetClass <JsProcessorShape>;
  sh:property [
    sh:path rdfc:entrypoint;
    sh:name "location";
    sh:minCount 1;
    sh:maxCount 1;
    sh:datatype xsd:string;
  ], [
    sh:path rdfc:file;
    sh:name "file";
    sh:minCount 1;
    sh:maxCount 1;
    sh:datatype xsd:string;
  ], [
    sh:path rdfc:class;
    sh:name "clazz";
    sh:maxCount 1;
    sh:datatype xsd:string;
  ].
`;
    const processorShapes = extractShapes(new Parser().parse(shapeQuads));

    async function getProc<T extends Processor<unknown>>(
        config: string,
        ty: string,
        uri = "http://example.com/ns#processor",
    ): Promise<GetMyClassT<T>> {
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

        console.log("here");
        const procConfig = processorShapes.lenses["JsProcessorShape"].execute({
            id: new NamedNode(base + ty),
            quads: configQuads,
        });

        console.log("there", procConfig);
        const proc = await runner.addProcessor<T>({
            config: JSON.stringify(procConfig),
            arguments: "",
            uri,
        });
        return proc;
    }

    test("Shapes are all defined", () => {
        const names = Object.keys(shapes.lenses);
        console.log({ names });
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
        ).toBe(defined.length + 6);
    });

    test("Processors follow the required shape", () => {
        for (const n of defined) {
            const proc = <{ file: Term; location: string; clazz: string }>(
                processorShapes.lenses["JsProcessorShape"].execute({
                    id: new NamedNode(base + n),
                    quads: configQuads,
                })
            );
            expect(proc.file, n + " has file").toBeDefined();
            expect(proc.location, n + " has location").toBeDefined();
            expect(proc.clazz, n + " has clazz").toBeDefined();
        }
    });

    test("rdfc:GlobRead is properly defined", async () => {
        const proc = await getProc<GlobRead>(
            `<http://example.com/ns#processor> a rdfc:GlobRead; 
                rdfc:glob "./*.json"; 
                rdfc:output <jw>;
                rdfc:wait 0;
                rdfc:closeOnEnd true;
                rdfc:binary true.`,
            "GlobRead",
        );

        expect(proc.constructor.name).toBe(GlobRead.name);

        expect(proc.globPattern).toBe("./*.json");
        expect(proc.wait).toBe(0);
        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.closeOnEnd).toBe(true);
        expect(proc.binary).toBe(true);
    });

    test("rdfc:FolderRead is properly defined", async () => {
        const proc = await getProc<ReadFolder>(
            `<http://example.com/ns#processor> a rdfc:FolderRead; 
                rdfc:folder_location "./src"; 
                rdfc:file_stream <jw>;
                rdfc:max_memory 3.5;
                rdfc:pause 3000.`,
            "FolderRead",
        );

        expect(proc.folder).toBe("./src");
        expect(proc.maxMemory).toBe(3.5);
        expect(proc.pause).toBe(3000);
        expect(proc.writer).toBeInstanceOf(WriterInstance);
    });

    test("rdfc:Envsub is properly defined", async () => {
        const proc = await getProc<Envsub>(
            `<http://example.com/ns#processor> a rdfc:Envsub; 
                rdfc:input <jr>; 
                rdfc:output <jw>.`,
            "Envsub",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
    });

    test("rdfc:Substitute is properly defined", async () => {
        const proc = await getProc<Substitute>(
            `<http://example.com/ns#processor> a rdfc:Substitute; 
                rdfc:input <jr>;
                rdfc:output <jw>;
                rdfc:source "life";
                rdfc:replace "42";
                rdfc:regexp false.`,
            "Substitute",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
        expect(proc.source).toBe("life");
        expect(proc.replace).toBe("42");
        expect(proc.regexp).toBe(false);
    });

    test("rdfc:ReadFile is properly defined", async () => {
        const proc = await getProc<GetFileFromFolder>(
            `<http://example.com/ns#processor> a rdfc:ReadFile; 
                rdfc:input <jr>;
                rdfc:output <jw>;
                rdfc:folderPath ".".`,
            "ReadFile",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
        expect(proc.folderPath).toBe(".");
    });

    test("rdfc:UnzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfc:UnzipFile; 
                rdfc:input <jr>;
                rdfc:output <jw>.`,
            "UnzipFile",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
    });

    test("rdfc:GunzipFile is properly defined", async () => {
        const proc = await getProc<UnzipFile>(
            `<http://example.com/ns#processor> a rdfc:GunzipFile; 
                rdfc:input <jr>;
                rdfc:output <jw>.`,
            "GunzipFile",
        );

        expect(proc.writer).toBeInstanceOf(WriterInstance);
        expect(proc.reader).toBeInstanceOf(ReaderInstance);
    });
});
