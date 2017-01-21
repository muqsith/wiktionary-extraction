const fs = require('fs'),
    readStream = fs.createReadStream('temp/sorted-alltemplates.json', {encoding:'utf8'}),
    writeStream = fs.createWriteStream('temp/sorted-filtered-templates.json', {encoding:'utf8'}),
    readline = require('readline'),
    rl = readline.createInterface({ input: readStream })
    ;

let previous_checksum = undefined;

rl.on('line', (line) => {
    if (line) {
        let o = JSON.parse(line);
        let current_checksum = o.checksum;
        if (!previous_checksum || (current_checksum !== previous_checksum)) {
            writeStream.write(JSON.stringify(o)+'\n');
            previous_checksum = current_checksum;
        }
    }
});

rl.on('close', (err) => {
    if (err) console.log(err);
});
