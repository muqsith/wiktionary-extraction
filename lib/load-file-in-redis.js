const fs = require('fs'),
    redis = require('redis'),
    promisestatus = require('./promise-status.js'),
    readfileGenerator = require('./readfile-generator.js').readfileGenerator,
    path = require('path')
    ;

exports.loadFileRecordsInRedis = function (file, key, flushall, fn) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(file)) {
            let client = redis.createClient();
            client.on('error', (err) => {
                if (err) {
                    return reject({status: promisestatus.fail, 'error': err});
                }
            });
            const loadRecords = function () {
                readfileGenerator(file, (gen) => {
                    function insertRecord(next) {
                        if (next.value) {
                            let record = JSON.parse(next.value);
                            if (fn) {
                                if (fn(record)) {
                                    client.set(record[key], JSON.stringify(record), (err, res) =>{
                                        if (err) {
                                            console.log(`Error occured while saving record to redis: ${err}`);
                                        }
                                        insertRecord(gen.next());
                                    });
                                } else {
                                    insertRecord(gen.next());
                                }
                            } else {
                                client.set(record[key], JSON.stringify(record), (err, res) =>{
                                    if (err) {
                                        console.log(`Error occured while saving record to redis: ${err}`);
                                    }
                                    insertRecord(gen.next());
                                });
                            }
                        }
                    };
                    insertRecord(gen.next());
                }, (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    client.quit();
                    resolve({status: promisestatus.success});
                });
            }

            if(flushall) {
                client.flushall(() => {
                    console.log('Flushed redis');
                    loadRecords();
                });
            } else {
                loadRecords();
            }
        } else {
            return reject({status: promisestatus.fail, ['error']: new Error(`${filePath} does not exist.`)});
        }
    });
};
