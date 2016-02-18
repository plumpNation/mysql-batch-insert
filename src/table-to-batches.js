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
    colors   = require('colors'),
    log      = require('single-line-log').stdout,

    rl = readline.createInterface({
        input: process.stdin
    }),

    headers = [
        'SET autocommit=0;\n',
        'SET unique_checks=0;\n',
        'SET foreign_key_checks=0;\n'
    ],

    footers = [
        'SET autocommit=1;\n',
        'SET unique_checks=1;\n',
        'SET foreign_key_checks=1;\n'
    ],

    INSERTS_PER_FILE = 10000;

var writeStream,
    writingStructure,
    structureWritten,
    insertStatementCache,
    everythingElseIsShit,

    lineCount   = 1,
    batchNumber = 1;

try {
    fs.mkdirSync('output');
    console.log('Created output folder');
} catch(e) {};

// we want to start the line count AFTER we have cached the INSERT statement
rl.on('line', (line) => {
    rl.pause();

    // If we hit this pattern and we have been parsing the actual data,
    // we can assume we don't want any more of this file.
    if (structureWritten && isEndOfData(line)) {
        everythingElseIsShit = true;

        writeFooters(writeStream);

        writeStream.end();
        rl.close();

        console.log('\n');
        console.log('Found end of data dump, ignoring the rest of the file.'.yellow);
        rl.resume();
        return;
    }

    if (everythingElseIsShit || isBullshit(line)) {
        rl.resume();
        return;
    }

    // We want to preserve the newlines, it's easier to read.
    line = line + '\n';

    if (!writingStructure && isStructure(line)) {
        console.log('Detected structure, entering structure mode'.green);
        writingStructure = true;

        rl.resume();
        return;
    }

    if (!structureWritten && !writingStructure) {

        rl.resume();
        return;
    }

    if (writingStructure && isData(line)) {
        // If this is the start of the data, come out of writingStructure and reset the lineCount.
        // Unless the structure of the dumps changes, this should be stable enough.
        writingStructure = false;
        structureWritten = true;
        lineCount        = 1;

        log('Finished writing structure'.green);
        console.log('\n');
        writeStream.end();

        rl.resume();
        return;
    }

    // are we starting a new batch file?
    if (lineCount === 1) {
        let filetype = writingStructure ? 'structure' : 'data',
            folder   = 'output/' + filetype,
            fileName = filetype + '_' + batchNumber,
            fullPath = folder + '/' + fileName + '.sql',
            colorPath = (folder + '/').green + fileName.yellow + '.sql'.green;

        // Create the output directory or die trying...
        try {
            fs.mkdirSync(folder);
            log('Created folder:'.yellow, folder.yellow);
            console.log('\n');
        } catch(e) {};

        log('Creating new batch file:'.green, colorPath);

        writeStream = fs.createWriteStream(fullPath);
    }

    if (writingStructure) {
        // Simply write in the line if it's table structure, no need for complication.
        writeStream.write(line);
        // We aren't batching the structure, it won't get large enough.
        lineCount++;

        // Don't let the code flow on to the data section
        // @todo: break this out. It's shit.
        rl.resume();
        return;
    }

    // We haven't finished pulling the structure out, don't bother with data processing.
    if (!structureWritten) {
        rl.resume();
        return;
    }

    // We want to save this INSERT statement so we can reuse it in all the batch files.
    if (line.indexOf('INSERT INTO') === 0) {
        log('Caching INSERT statement'.green);
        console.log('\n');
        insertStatementCache = line;
    }

    // take a snapshot of the insert statement and add it to the write stream.
    if (lineCount === 1) {
        writeStream.write(headers.join(''));
        writeStream.write('\n');
        writeStream.write(insertStatementCache);
    }

    // If we haven't reached our tolerance on lines per file, we can just write and keep on going.
    if (lineCount % INSERTS_PER_FILE !== 0) {
        writeStream.write(line);
        lineCount++;

        rl.resume();
        return;
    }

    // Close up the batch file by replacing the comma with a semicolon...
    line = line.replace(/,\n$/, ';\n');
    writeStream.write(line);

    if (line.indexOf('COMMIT;') !== 0) {
        writeFooters(writeStream);
    }

    let batchFinishedMessage =
        'Finished writing ' + lineCount + ' lines to batch file ' + batchNumber;

    log(batchFinishedMessage.green);

    // We've reached our tolerance. A new file is required.
    batchNumber++;
    lineCount = 1;

    writeStream.end();
    rl.resume();
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

function isEndOfData(line) {
    return line.indexOf('-- --------------------------------------------------------') > -1;
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

function writeFooters(writeStream) {
    writeStream.write('COMMIT;' + '\n');
    writeStream.write(footers.join(''));
}
