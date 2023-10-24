# file-utils-processors-ts

[![npm](https://img.shields.io/npm/v/file-utils-processors-ts.svg?style=popout)](https://npmjs.com/package/file-utils-processors-ts)

Connector Architecture Typescript processors for handling file operations. It currently exposes 2 functions:

* `js:globRead()`: This function relies on the [`glob`](https://www.npmjs.com/package/glob) library to select a set of files according to a shell expression and stream them out in a sequential fashion. A `wait` parameter can be defined to wait x milliseconds between file streaming operations.
* `js:folderRead()`: This function reads all the files present in a given folder and streams out their content in a sequential fashion. A `maxMemory` parameter can be given (in GB) to defined threshold of maximum used memory by the streaming process. When the threshold is exceeded, the streaming process will pause for as many  milliseconds as defined by the `pause` parameter.
