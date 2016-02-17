#!/usr/bin/node

const fs = require('fs'),

    readline = require('readline'),

    rl = readline.createInterface({
        input: process.stdin
    });

var insertStatementCache,
    lineCount = 1,
    chunkNumber = 1,
    writeStream;

try { fs.mkdirSync('output'); } catch(e) {};

// we want to start the line count AFTER we have cached the INSERT statement
rl.on('line', (line) => {
    if (lineCount === 1) {
        writeStream = fs.createWriteStream('./output/chunk_' + chunkNumber);
    }

    if (line.indexOf('INSERT INTO' === 0)) {
        insertStatementCache = line;
    }

    if (lineCount % 5000 !== 0) {
        writeStream.write(line);
        lineCount++;
        return;
    }

    chunkNumber++;
    lineCount = 1;

    line = line.replace(/,$/, ';');

    writeStream.write(line);
    writeStream.write('COMMIT;');
    writeStream.end();

    rl.close();
});
