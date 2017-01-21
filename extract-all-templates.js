const config = require('config'),
    fs = require('fs'),
    MongoClient = require('mongodb').MongoClient,
    path = require('path'),
    getTemplates = require('./lib/templates-from-text.js'),
    writeStream = fs.createWriteStream('./temp/alltemplates.json', {encoding:'utf8'}),
    CRC32 = require('crc-32')
    ;

let count = 0;
const createTemplatesCollection = function () {
    MongoClient.connect(config.get('mongodb-url'), (err, db) => {
        let cursor = db.collection('filteredpages').find({}).addCursorFlag('noCursorTimeout', true);
        if (cursor) {
            cursor.forEach((doc) => {
                if (doc.text) {
                    let templates = getTemplates(doc.text);
                    if (templates && templates.length > 0) {
                        for (let template of templates) {
                            let checksum = CRC32.str(template);
                            let obj = {'checksum': checksum, 'template': template, 'value': ''};
                            writeStream.write(JSON.stringify(obj)+'\n');
                        }
                    }
                }
                count += 1;
            }, (err) => {
                if (err) console.log(err);
                console.log('Processed ', count , ' documents.');
                db.close();
            });
        }
    });
};

createTemplatesCollection();
// After extracting the text sort it using *nix os's sort command
// Command: sort temp/alltemplates.json -o temp/sorted-alltemplates.json -t , -k 1.12 -bn
// sort temp/alltemplates.json --field-separator=, --key=1.12 --output=temp/sorted-alltemplates.json --ignore-leading-blanks --numeric-sort
