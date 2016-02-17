#!/usr/bin/node

'use strict';

/**
 * Designed to split mysql table dumps that have been created with optimised inserts and InnoDB
 * e.g. INSERT INTO XXXXX VALUES (1,2,3), (1,2,3), (1,2,3), (1,2,3), (1,2,3);
 *
 * @example cat yoursqlfile.sql | node split-table-query.js
 */

const fs     = require('fs'),
    readline = require('readline'),

    rl = readline.createInterface({
        input: process.stdin
    }),

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

    INSERTS_PER_FILE = 50;

var writeStream,
    structureMode,
    structureWritten,
    insertStatementCache,

    lineCount   = 1,
    chunkNumber = 1;

// we want to start the line count AFTER we have cached the INSERT statement
rl.on('line', (line) => {
    if (!isBullshit(line)) {
        return;
    }

    // We want to preserve the newlines, it's easier to read.
    line = line + '\n';

    if (!structureMode && isStructure(line)) {
        structureMode = true;
        return;
    }

    if (structureMode && isData(line)) {
        // If this is the start of the data, come out of structureMode and reset the lineCount.
        // Unless the structure of the dumps changes, this should be stable enough.
        structureMode = false;
        structureWritten = true;
        lineCount = 1;
        writeStream.end();
        return;
    }

    // are we starting a new batch file?
    if (lineCount === 1) {
        let filetype = structureMode ? 'structure' : 'data',
            folder = './output/' + filetype;

        // Create the output directory or die trying...
        try { fs.mkdirSync(folder); } catch(e) {};

        writeStream = fs.createWriteStream(
            folder + '/' + filetype + '_' + chunkNumber + '.sql'
        );
    }

    if (structureMode) {
        // Simply write in the line if it's table structure, no need for complication.
        writeStream.write(line);
        // We aren't chunking the structure, it won't get large enough.
        lineCount++;

        // Don't let the code flow on to the data section
        // @todo: break this out. It's shit.
        return;
    }

    // We haven't finished pulling the structure out, don't bother with data processing.
    if (!structureWritten) {
        return;
    }

    if (line.indexOf('INSERT INTO' === 0)) {
        insertStatementCache = line;
    }

    // take a snapshot of the insert statement and add it to the write stream.
    if (lineCount === 1) {
        writeStream.write(insertStatementCache);
    }

    // If we haven't reached our tolerance on lines per file, we can just write and keep on going.
    if (lineCount % INSERTS_PER_FILE !== 0) {
        writeStream.write(line);
        lineCount++;
        return;
    }

    // We've reached our tolerance. A new file is required.
    chunkNumber++;
    lineCount = 1;

    line = line.replace(/,\n$/, ';\n');

    writeStream.write(line);

    if (line.indexOf('COMMIT;') !== 0) {
        writeStream.write('COMMIT;' + '\n');
    }

    writeStream.end();

    rl.close();
});

////////////////////////////////////////////////////////////////////////////////////////////////////
// *********   HELPER FUNCTIONS ********* //////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

function isStructure(line) {
    return line.indexOf('-- Table structure for table') === 0;
}

function isData(line) {
    return line.indexOf('-- Dumping data for table') === 0;
}

function isBullshit(line) {
    if (line === '') {
        return true;
    }

    if (line.indexOf('/*!') === 0) {
        return true;
    }

    // If it's a comment...
    if (line.indexOf('--') === 0) {
        // ...but if it's a comment we want, like it's flagging the start of something important...?
        return !isStructure(line) && !isData(line);
    }

    // We must want it I guess.
    return false;
}
