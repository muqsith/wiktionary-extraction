const fs = require('fs'),
    promisestatus = require('./lib/promise-status.js'),
    loadFileRecordsInRedis = require('./lib/load-file-in-redis.js'),
    redis = require('redis')
    ;
let missingTemplatesValuesFile = 'temp/missing-templates-values.json';
let templatesValuesFile = 'temp/templates-values.json';
let allTemplatesValuesFile = 'temp/all-templates-values.json';
loadFileRecordsInRedis(templatesValuesFile, 'checksum', true)
    .then((result) => {
        console.log(`Loading of file ${templatesValuesFile} records in redis: ${result.status}`);
        loadFileRecordsInRedis(missingTemplatesValuesFile, 'checksum', false).then((result) =>{
            console.log(`Loading of file ${missingTemplatesValuesFile} records in redis: ${result.status}`);
            let writeStream = fs.createWriteStream(allTemplatesValuesFile, {encoding:'utf8'});
            let client = redis.createClient();
            client.on('error', (err) => {
                if (err) {
                    console.log(err);
                }
            });
            client.keys('*', (err, keys) => {
                if (err) {
                    console.log(err);
                }
                if (keys && keys.length > 0) {
                    let currentIndex = 0;
                    const closeConnection = function() {
                        client.quit(function (err, res) {
                            if (err) {
                                console.log(err);
                            }
                            if (res) {
                                console.log(res);
                            }
                        });
                    }
                    const itr = function (key) {
                        client.get(key, (err, result) => {
                            if (err) console.log(`Error for key - ${key}`, err);
                            if (result) {
                                writeStream.write(result+'\n');
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
            console.log(`Error occured while loading file ${missingTemplatesValuesFile} records in redis ${status}, ${error}`);
        });
    }, ({status, error}) => {
        console.log(`Error occured while loading file ${templatesValuesFile} records in redis ${status}, ${error}`);
    });
