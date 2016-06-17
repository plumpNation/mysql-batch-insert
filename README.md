MySQL table dump splitter
============

**This is a work in progress, don't use it for something serious unless you are aware of it's
limitations.**

Splits large MySql table dumps into files ready for batch restore.

Big db dumps can make your kernel panic, no matter what you do with your VM memory, your
connection-timeout or your maximum_allowed_packet size.

Written with a mixture of bash scripting and nodejs.

Much kudos to [kedarjv](https://github.com/kedarvj/mysqldumpsplitter) for doing a lot of the
ground work on the dump splitter.

## Requirements

nodejs >= 6.x

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
threshold. Something like this:

```
cat yourmassivedump.sql | node split-sql.js --threshold 20M

# could be a quick way to insert
find . -name '*.sql' | awk '{ print "source",$0 }' | mysql --batch
# OR
for SQL in *.sql; do DB=${SQL/\.sql/}; echo importing $DB; mysql $DB < $SQL; done
# OR
for i in *.sql
do
  echo "file=$i"
  mysql -u admin_privileged_user --password=whatever your_database_here < $i
done
```
