# file-utils-processors-ts

[![Build and tests with Node.js](https://github.com/rdf-connect/file-utils-processors-ts/actions/workflows/build-test.yml/badge.svg)](https://github.com/rdf-connect/file-utils-processors-ts/actions/workflows/build-test.yml) [![npm](https://img.shields.io/npm/v/@rdfc/file-utils-processors-ts.svg?style=popout)](https://npmjs.com/package/@rdfc/file-utils-processors-ts)

This repository provides a set of processors for reading, transforming, and extracting files in RDF-Connect pipelines.  
It includes utilities for reading files from folders or glob patterns, substituting strings or environment variables, reading files on demand, and handling compressed files (zip/gzip).

These processors are designed to integrate seamlessly into RDF-Connect pipelines using the [rdfc:NodeRunner](https://github.com/rdf-connect/js-runner).

---

## Usage

To use these processors, import the package into your RDF-Connect pipeline configuration and reference the required processors.

### Installation

```bash
npm install
npm run build
```

Or install from NPM:

```bash
npm install @rdfc/file-utils-processors-ts
```

Next, you can add the processors to your pipeline configuration as follows:

```turtle
@prefix rdfc: <https://w3id.org/rdf-connect#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.

### Import the processor definitions
<> owl:imports <./node_modules/@rdfc/file-utils-processors-ts/processors.ttl>.

### Define the channels your processor needs
<in> a rdfc:Reader, rdfc:Writer.
<out> a rdfc:Reader, rdfc:Writer.

### Attach the processor to the pipeline under the NodeRunner
# Add the `rdfc:processor <folderReader>` statement under the `rdfc:consistsOf` statement of the `rdfc:NodeRunner`

### Define and configure the processors
<folderReader> a rdfc:FolderRead;
    rdfc:folder_location "./data";
    rdfc:file_stream <out>.
```

---

## Processors and Configuration

### 📂 `rdfc:GlobRead` – Glob-based File Reader

Reads all files matching a given glob pattern.

**Parameters:**

- `rdfc:glob` (`string`, required): Glob pattern to select files.
- `rdfc:output` (`rdfc:Writer`, required): Output channel to stream file contents.
- `rdfc:wait` (`integer`, optional): Delay (ms) before reading files.
- `rdfc:closeOnEnd` (`boolean`, optional): Whether to close the stream after finishing.
- `rdfc:binary` (`boolean`, optional): If true, streams binary data instead of text.

---

### 📁 `rdfc:FolderRead` – Folder File Reader

Reads all files inside a folder.

**Parameters:**

- `rdfc:folder_location` (`string`, required): Path to the folder.
- `rdfc:file_stream` (`rdfc:Writer`, required): Output channel to stream file contents.
- `rdfc:max_memory` (`double`, optional): Max memory usage allowed (in MB).
- `rdfc:pause` (`integer`, optional): Pause duration (ms) between file reads.

---

### 🔄 `rdfc:Substitute` – String Substitution Processor

Performs string substitution (supports regex) on messages in the stream.

**Parameters:**

- `rdfc:input` (`rdfc:Reader`, required): Input channel.
- `rdfc:output` (`rdfc:Writer`, required): Output channel.
- `rdfc:source` (`string`, required): Source string or regex to match.
- `rdfc:replace` (`string`, required): Replacement string.
- `rdfc:regexp` (`boolean`, optional): If true, treat `source` as a regex.

---

### 🌍 `rdfc:Envsub` – Environment Variable Substitution

Substitutes environment variables in the stream with their values.

**Parameters:**

- `rdfc:input` (`rdfc:Reader`, required): Input channel.
- `rdfc:output` (`rdfc:Writer`, required): Output channel.

---

### 📄 `rdfc:ReadFile` – On-Demand File Reader

Reads a requested file from a given folder.

**Parameters:**

- `rdfc:input` (`rdfc:Reader`, required): Input channel (file requests).
- `rdfc:folderPath` (`string`, required): Path to the folder containing files.
- `rdfc:output` (`rdfc:Writer`, required): Output channel for file contents.

---

### 📦 `rdfc:UnzipFile` – Zip File Extractor

Unzips a compressed file and streams its content.

**Parameters:**

- `rdfc:input` (`rdfc:Reader`, required): Input channel (zip file).
- `rdfc:output` (`rdfc:Writer`, required): Output channel (extracted contents).

---

### 🗜️ `rdfc:GunzipFile` – Gzip File Extractor

Gunzip a compressed file stream and stream out its content. This processor operates only in streaming mode.

**Parameters:**

- `rdfc:input` (`rdfc:Reader`, required): Input channel (gzip file).
- `rdfc:output` (`rdfc:Writer`, required): Output channel (extracted contents).

---

### 📝 `rdfc:FileWriter` – JavaScript File Writer

Writes incoming data to a file. Supports writing buffered strings, binary buffers, or streaming input.

**Parameters:**

- `rdfc:input` (`rdfc:Reader`, required): Input channel providing data to write. Can be strings, buffers, or streams depending on configuration.
- `rdfc:filePath` (`string`, required): Destination file path where data will be written.
- `rdfc:readAsStream` (`boolean`, optional): If true, consume the inputs as streams and pipe them to the destination file. Use this for large files or streaming data.
- `rdfc:binary` (`boolean`, optional): If true, treat incoming messages as binary buffers and write them as binary data. When false or omitted, input strings will be written as UTF-8 text.

Notes:

- When `readAsStream` is true, the processor opens a single write stream to the specified `filePath` and writes chunks from every incoming stream into that same file handle. The stream is opened once (which will truncate/overwrite the file at open time) and is ended after all incoming streams have been consumed. This effectively concatenates multiple incoming streams into a single file.
- When `readAsStream` is false (the default), each incoming message (string or buffer) is appended to the target file using Node.js `appendFile`, so messages are concatenated in the order they arrive. The file will be created if it doesn't exist. If you need to overwrite the file instead, either truncate it before use or use streaming mode (which opens/truncates the file once at start).

Example (streaming mode):

```turtle
<writer> a rdfc:FileWriter;
    rdfc:input <in>;
    rdfc:filePath "./out/output.txt";
    rdfc:readAsStream true.
```

Example (buffered text mode):

```turtle
<writer> a rdfc:FileWriter;
    rdfc:input <in>;
    rdfc:filePath "./out/output.txt";
    rdfc:readAsStream false;
    rdfc:binary false.
```

## Example Pipelines

### Example 1: Reading all `.txt` files in a folder and logging them

```turtle
<reader> a rdfc:GlobRead;
rdfc:glob "./data/*.txt";
rdfc:output <out>.

<logger> a rdfc:LogProcessorJs;
    rdfc:reader <out>;
    rdfc:level "info";
    rdfc:label "glob-reader".
```

### Example 2: Substituting strings in a stream

```turtle
<substitute> a rdfc:Substitute;
rdfc:reader <in>;
rdfc:writer <out>;
rdfc:source "World";
rdfc:replace "RDF-Connect";
rdfc:regexp false.
```

### Example 3: Reading and unzipping a file

```turtle
<unzipper> a rdfc:UnzipFile;
rdfc:reader <in>;
rdfc:writer <out>.
```
