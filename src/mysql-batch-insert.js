#! /usr/bin/node
const exec = require('child_process').exec,
    dumpFile = process.env.PWD + '/' + process.argv[2];

var command = 'sh ' + __dirname + '/split-tables.sh ' + dumpFile;

exec(command, (error, stdout, stderr) => {
    if (error) {
        throw error;
    }

    console.log(stdout);
    console.error(stderr);
});
