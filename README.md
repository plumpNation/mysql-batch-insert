SQL splitter
============

Do you have a massive dump to put in your VM.

Split it up, or your kernel will start to panic, no matter what you do with your
VM memory, your connection-timeout or your maximum_allowed_packet size.

I have no idea if this works yet. I will keep you posted :)

Peace.

## Usage

```shell
cat yourmassivedump.sql | ./split-sql

# and as a bonus
cd output && ../list-by-size
```
