const fs = require('fs'),
    readline = require('readline'),
    path = require('path')
    ;
exports.readfileGenerator = function (file, cb, close) {
    let readStream = fs.createReadStream(file, {encoding:'utf8'});
    let rl = readline.createInterface({input: readStream});
    let buffer = [], count = 0, maxcount = 1000, stream_paused = false;
    let totallines = 0;
    rl.on('line', (line) => {
        totallines += 1;
        count += 1;
        buffer = buffer.concat(line);
        if (count > maxcount) {
            if (!stream_paused) {
                rl.pause();
                stream_paused = true;
                process.nextTick(() => {
                    cb((function* () {
                        yield* buffer;
                        buffer = [];
                        count = 0;
                        stream_paused = false;
                        rl.resume();
                    })());
                });
            }
        }
    });
    rl.on('close', (err) => {
        if (buffer.length > 0) {
            process.nextTick(() => {
                cb((function* () {
                    yield* buffer;
                    close(err);
                })());
            });
        } else {
            close(err);
        }
    });
};
