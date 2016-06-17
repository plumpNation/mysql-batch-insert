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

    readInput = readline.createInterface({
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
    insertStatementCache,

    noMoreUsefulData      = false,
    writingTableStructure = false,
    // writingTableData      = false,
    tableStructureWritten = false,

    lineCount   = 1,
    batchNumber = 1;

try {
    fs.mkdirSync('output');
    console.log('Created output folder');
} catch(e) {};

// we want to start the line count AFTER we have cached the INSERT statement
readInput.on('line', (line) => {
    readInput.pause();

    // If we hit this pattern and we have been parsing the actual data,
    // we can assume we don't want any more of this file.
    if (tableStructureWritten && isEndOfData(line)) {
        noMoreUsefulData = true;

        // writeFooters(writeStream);
        writeStream.write('COMMIT;' + '\n');
        writeStream.write(footers.join(''));

        lineCount = 1;

        readInput.close();
        console.log('\n');
        console.log('Found end of data dump, ignoring the rest of the file.'.yellow);
        readInput.resume();

        writeStream.end();

        return;
    }

    if (noMoreUsefulData || isSuperfluous(line)) {
        readInput.resume();
        return;
    }

    // We want to preserve the newlines, it's easier to read.
    line = line + '\n';

    if (!writingTableStructure && isStructure(line)) {
        console.log('Detected table structure, entering structure write mode'.green);
        writingTableStructure = true;

        readInput.resume();

        return;
    }

    if (!tableStructureWritten && !writingTableStructure) {
        readInput.resume();

        return;
    }

    if (writingTableStructure && isData(line)) {
        // If this is the start of the data we are no longer writing table structure
        writingTableStructure = false;
        tableStructureWritten = true;

        // We will start writing to a new data file from line 1 (of course)
        lineCount = 1;

        log('Finished writing stucture'.green);
        console.log('\n');

        readInput.resume();
        return;
    }

    // are we starting a new batch file?
    if (lineCount === 1) {
        let filetype = writingTableStructure ? 'structure' : 'data',
            folder   = 'output/' + filetype,
            fileName = filetype + '_' + batchNumber,
            fullPath = folder + '/' + fileName + '.sql',
            coloredPath = (folder + '/').green + fileName.yellow + '.sql'.green;

        // Create the output directory or die trying...
        try {
            fs.mkdirSync(folder);
            log('Created folder:'.yellow, folder.yellow);
            console.log('\n');
        } catch(e) {};

        log('Detected data'.green);
        log('Creating new batch file:'.green, coloredPath);

        writeStream = fs.createWriteStream(fullPath);
    }

    if (writingTableStructure) {
        // Simply write in the line if it's table structure, no need for complication.
        writeStream.write(line);
        // We aren't batching the structure, it won't get large enough.
        lineCount++;

        // Don't let the code flow on to the data section
        // @todo: break this out.
        readInput.resume();
        return;
    }

    // We haven't finished pulling the structure out, don't bother with data processing.
    if (!tableStructureWritten) {
        readInput.resume();
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

        readInput.resume();
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
    batchNumber += 1;
    lineCount = 1;

    writeStream.end();
    readInput.resume();
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

/**
 * Checks to see if a line could be ignored due to lack of needed content.
 */
function isSuperfluous(line) {
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
