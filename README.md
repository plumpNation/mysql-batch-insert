MySQL table dump splitter
============

This is a work in progress, don't use it for something serious unless you are aware.

Splits large MySql table dumps into files ready for batch restore.

Do you have a massive dump to put in your VM.

Split it up, or your kernel will start to panic, no matter what you do with your
VM memory, your connection-timeout or your maximum_allowed_packet size.

I have no idea if this works yet. I will keep you posted :)

It's using a randy mixture of bash and nodejs.

Much kudos to [kedarjv](https://github.com/kedarvj/mysqldumpsplitter) for doing a lot of work
on the dump splitter. I saw it and just threw mine away.

Peace.

## Requirements

Update your nodejs! (>=v5.6 perhaps)

## Usage

```shell
./bin/split-tables yourbigdump.sql

# and as a bonus
# cd to a folder you wanna take a look at
./bin/list-by-size

# if you want to split a huge table dump
cat yourmassivetable.sql | ./bin/table-to-batches
```

## ToDo

I'd like to have a single operation, where a flag decides whether to split files over a given
threshold. For instance:

```
# this will not work, look up, you're in a ToDo section!
cat yourmassivedump.sql | node split-sql.js --threshold 20M
```
