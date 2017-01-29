const fs = require('fs'),
    redis = require('redis'),
    promisestatus = require('./lib/promise-status.js'),
    getTemplates = require('./lib/templates-from-text.js'),
    CRC32 = require('crc-32'),
    loadFileRecordsInRedis = require('./lib/load-file-in-redis.js').loadFileRecordsInRedis,
    readfileGenerator = require('./lib/readfile-generator.js').readfileGenerator
    ;

function saveTemplatesInFile(templates, writeStream, cb) {
    let index = 0;
    const save = function(template) {
        let checksum = CRC32.str(template);
        let obj = {'checksum': checksum, 'template': template, 'value': ''};
        writeStream.write(JSON.stringify(obj)+'\n', 'utf8', () => {
            index += 1;
            if (index < templates.length) {
                save(templates[index]);
            } else {
                cb();
            }
        });
    };
    save(templates[index]);
};

function createAllTemplatesFile(inputFile, tempOutFile) {
    return new Promise((resolve, reject) => {
        let writeStream = fs.createWriteStream(tempOutFile, {encoding:'utf8'});
        readfileGenerator(inputFile, (gen) => {
                const processRecord = function(next) {
                    if (next.value) {
                        let record = JSON.parse(next.value);
                        let templatesObject = getTemplates(record.text);
                        if (templatesObject && templatesObject.templates
                                && templatesObject.templates.length > 0)
                        {
                            saveTemplatesInFile(templatesObject.templates,
                                    writeStream, () => {
                                        processRecord(gen.next());
                                    });
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
            resolve({status: promisestatus.success});
        });
    });
};

function createTemplatesData(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputFile)) {
            let tempOutFile = 'temp/templates-all.json';
            createAllTemplatesFile(inputFile, tempOutFile).then(({status}) => {
                    console.log(`Creation of temporaray file ${tempOutFile}: ${status}`);
                loadFileRecordsInRedis(tempOutFile, 'checksum', true)
                    .then(({status}) => {
                        console.log(`Loading of file ${tempOutFile} records in redis: ${status}`);
                        let client = redis.createClient();
                        client.on('error', (err) => {
                            if (err) {
                                return reject({status: promisestatus.fail, 'error': err});
                            }
                        });
                        client.keys('*', (err, keys) => {
                            if (err) {
                                return reject({status: promisestatus.fail, 'error': err});
                            }
                            if (keys && keys.length > 0) {
                                let writeStream = fs.createWriteStream(outputFile, {encoding:'utf8'});
                                let currentIndex = 0;
                                const closeConnection = function() {
                                    client.quit(function (err, res) {
                                        if (err) {
                                            return reject({status: promisestatus.fail, 'error': err});
                                        }
                                        if (res) {
                                            fs.unlinkSync(tempOutFile);
                                            resolve({status: promisestatus.success});
                                        }
                                    });
                                };
                                const itr = function (key) {
                                    client.get(key, (err, result) => {
                                        if (err) console.log(`Error for key - ${key}`, err);
                                        if (result) {
                                            writeStream.write(result+'\n',
                                                'utf8', () => {
                                                    currentIndex += 1;
                                                    if (currentIndex < keys.length) {
                                                        itr(keys[currentIndex]);
                                                    } else {
                                                        return closeConnection();
                                                    }
                                                });
                                        } else {
                                            currentIndex += 1;
                                            if (currentIndex < keys.length) {
                                                itr(keys[currentIndex]);
                                            } else {
                                                return closeConnection();
                                            }
                                        }
                                    });
                                }
                                itr(keys[currentIndex]);
                            }
                        });
                    }, ({status, error}) => {
                        return reject({status: promisestatus.fail, 'error': error});
                    });
            }, ({status, error}) => {
                return reject({status: promisestatus.fail, 'error': error});
            });
        } else {
            resolve({status: promisestatus.success});
        }
    });
};

module.exports = createTemplatesData;

if (require.main === module) {
    createTemplatesData('temp/filtered-data.json', 'temp/templates.json').then(({status}) => {
        console.log(`Extract Templates data: ${status}`);
    }, ({status, error}) => {
        console.log('Extract Templates data: ', status, error);
    });
}
