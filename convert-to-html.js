const fs = require('fs'),
    promisestatus = require('./lib/promise-status.js'),
    loadFileRecordsInRedis = require('./lib/load-file-in-redis.js'),
    readfileGenerator = require('./lib/readfile-generator.js'),
    getTemplates = require('./lib/templates-from-text.js'),
    redis = require('redis'),
    CRC32 = require('crc-32'),
    instaview = require('instaview'),
    utils = require('./lib/utils.js')
    ;


function convertWikiMarkup2HTML(beginCount = 0) {
    return new Promise((resolve, reject) => {
        let templatesValuesFile = 'temp/templates-values.json',
            inputFile = 'temp/filtered-data.json',
            outputFile = 'temp/html-data.json'
            ;

        //loadFileRecordsInRedis(templatesValuesFile, 'checksum', true).then((result) => {
                //console.log(`Loading of file ${templatesValuesFile} records in redis: ${result.status}`);
                let totalLinesCount = 0;
                console.log(`Begining from line ${beginCount} in ${inputFile}`);
                let writeStream = undefined;
                if (beginCount > 0) {
                    writeStream = fs.createWriteStream(outputFile, {encoding:'utf8', flags: 'a'});
                } else {
                    writeStream = fs.createWriteStream(outputFile, {encoding:'utf8'});
                }
                let emptyDocs = 0, errorDocs = 0;
                let client = redis.createClient();
                client.on('error', (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                });
                readfileGenerator(inputFile, (gen) => {
                    function processRecord(next) {
                        if (next.value) {
                            totalLinesCount += 1;
                            if (totalLinesCount >= beginCount) {
                                let record = undefined;
                                try {
                                    record = JSON.parse(next.value);
                                    if (record.text) {
                                        record.text = record.text.toString().replace(/[\u2028]/g, '');
                                        record.text = record.text.toString().replace(/[\u2029]/g, '');
                                    }
                                    console.log(`Processing: ${record.title} [${(new Date()).toString()}]`);
                                    const writeData = function(defintion) {
                                        let output = {};
                                        output.title = record.title;
                                        output.defintion = defintion;
                                        output.sortedtitle = record.title.split('').sort().join('');
                                        writeStream.write(JSON.stringify(output)+'\n');
                                        processRecord(gen.next());
                                    };
                                    let templatesObject = getTemplates(record.text);
                                    if (templatesObject
                                        && templatesObject.templates
                                        && templatesObject.templates.length > 0)
                                    {

                                            let text = '', inside_template = 0,
                                            indices = templatesObject.indices
                                            ;
                                        // this is required to remove the line breaks within templates
                                        // otherwise the lookup will not work while replacing the values.
                                        for (let i=0; i < record.text.length; i+=1) {
                                            if (indices[i] === 'start') {
                                                inside_template += 1;
                                            }
                                            if (indices[i] === 'end') {
                                                inside_template -= 1;
                                            }
                                            if (inside_template !== 0) {
                                                if (record.text[i] !== '\n') {
                                                    text += record.text[i];
                                                }
                                            } else {
                                                text += record.text[i];
                                            }
                                        }
                                        // this is required becuase instaview will convert clean if the
                                        // templates are encoded in base64.
                                        for (let i=0; i<templatesObject.templates.length; i+=1) {
                                            let template = templatesObject.templates[i];
                                            let checksum = CRC32.str(template).toString();
                                            let base64checksum = new Buffer(checksum).toString('base64');
                                            text = utils.replaceAll(text, template, base64checksum);
                                        }

                                        let _text = instaview.convert(text);

                                        let templatesIndex = 0;

                                        let templatesChecksumArray = [];
                                        for (let template of templatesObject.templates) {
                                            let checksum = CRC32.str(template);
                                            templatesChecksumArray = templatesChecksumArray.concat(checksum);
                                        }

                                        client.mget(templatesChecksumArray, (err, res) => {
                                            if (err) {
                                                console.log(`Error occured while fetching templates from redis for title: ${record.title}`);
                                                console.log(err);
                                                processRecord(gen.next());
                                            } else if (res) {
                                                for (let i=0; i < res.length; i+=1) {
                                                    let checksum = templatesChecksumArray[i];
                                                    let base64checksum = new Buffer(checksum.toString()).toString('base64');
                                                    let value = '';
                                                    if (res[i]) {
                                                        value = (JSON.parse(res[i])).value;
                                                    }
                                                    _text = utils.replaceAll(_text, base64checksum, value);
                                                }
                                                writeData(_text);
                                            }
                                        });
                                    } else {
                                        let text = record.text;
                                        if (text && text.length > 0) {
                                            let _text = instaview.convert(text);
                                            writeData(_text);
                                        } else {
                                            console.log(`Empty doc with title ${record.title}`);
                                            console.log(`Text: ${record.text}`);
                                            emptyDocs += 1;
                                            processRecord(gen.next());
                                        }
                                    }
                                } catch(e) {
                                    if (record && record.title) {
                                        console.log(`Error occured while processing record with title: ${record.title}`);
                                    }
                                    console.log(e);
                                    errorDocs += 1;
                                    processRecord(gen.next());
                                }
                            } else {
                                processRecord(gen.next());
                            }
                        }
                    };
                    processRecord(gen.next());
                }, (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    client.quit();
                    console.log(`Empty docs count: ${emptyDocs}`);
                    console.log(`Documents with errors ${errorDocs}`);
                    resolve({status: promisestatus.success});
                });
            //},  ({status, error}) => {
            //    return reject({status: promisestatus.fail, 'error': error});
            //});
    });
};

module.exports = convertWikiMarkup2HTML;

// TODO Remove below code

convertWikiMarkup2HTML().then((result) => {
    console.log(`Conversion of wikimarkup to html: ${result.status}`);
}, ({status, error}) => {
    console.log('Conversion of wikimarkup to html: ', status, error);
});
