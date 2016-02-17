#!/usr/bin/node

const fs     = require('fs'),
    readline = require('readline'),

    rl = readline.createInterface({
        input: process.stdin
    });

var writeStream,
    insertStatementCache,

    lineCount   = 1,
    chunkNumber = 1,

    headers = [
        'SET autocommit=0;',
        'SET unique_checks=0;',
        'SET foreign_key_checks=0;'
    ],

    footers = [
        'SET autocommit=1;',
        'SET unique_checks=1;',
        'SET foreign_key_checks=1;'
    ],

    structurePattern = '-- Table structure for table',
    dataPattern      = '-- Dumping data for table',

    isStructure = function () {
        return line.indexOf(structurePattern) < 0;
    },

    isData = function () {
        return line.indexOf(dataPattern) < 0;
    },

    isNeeded = function (line) {
        if (line.indexOf('--') === 0) {
            return false;
        }

        return isStructure(line) && isData(line);
    };

try { fs.mkdirSync('output'); } catch(e) {};

// we want to start the line count AFTER we have cached the INSERT statement
rl.on('line', (line) => {
    var data,
        structure,
        insertStatementBody;

    if (!isNeeded(line)) {
        return;
    }

    if (isStructure(line)) {
        structure = true;
    }

    if (isData(line)) {
        data = true;
    }

    // structure
    if (lineCount === 1) {
        writeStream = fs.createWriteStream('./output/chunk_' + chunkNumber + '.sql');
    }

    writeStream =
    lineCount++;


    // data

    if (data && line.indexOf('INSERT INTO' === 0)) {
        insertStatementCache = line;
        insertStatementBody = true;
    }

    if (lineCount === 1) {
        writeStream = fs.createWriteStream('./output/chunk_' + chunkNumber + '.sql');

        if (insertStatementBody) {
            writeStream.write(insertStatementCache);
        }
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
