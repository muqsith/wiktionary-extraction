const fs = require('fs'),
    redis = require('redis'),
    promisestatus = require('./lib/promise-status.js'),
    getTemplates = require('./lib/templates-from-text.js'),
    CRC32 = require('crc-32'),
    readline = require('readline')
    ;

function createTemplatesDataFile() {
    return new Promise((resolve, reject) => {
        let readStream = fs.createReadStream('temp/filtered-data.json', {encoding:'utf8'});
        let writeStream = fs.createWriteStream('temp/templates-all.json', {encoding:'utf8'});
        let rl = readline.createInterface({input: readStream});
        rl.on('line', (line) => {
            if (line) {
                let o = JSON.parse(line);
                if (o.text) {
                    let templates = getTemplates(o.text);
                    if (templates && templates.length > 0) {
                        for (let templateObject of templates) {
                            if (templateObject) {
                                let checksum = CRC32.str(templateObject);
                                let obj = {'checksum': checksum, 'template': templateObject, 'value': ''};
                                writeStream.write(JSON.stringify(obj)+'\n');
                            }
                        }
                    }
                }
            }
        });

        rl.on('close', (err) => {
            if (err) {
                return reject({status: promisestatus.fail, 'error': err});
            } else {
                resolve({status: promisestatus.success});
            }
        });
    });
}

function loadTemplatesInRedis() {
    return new Promise((resolve, reject) => {
        createTemplatesDataFile().then((result) => {
            console.log(`Creation of all templates data file: ${result.status}`);
            let readStream = fs.createReadStream('temp/templates-all.json', {encoding:'utf8'});
            let client = redis.createClient();
            let rl = readline.createInterface({input: readStream});
            client.on('error', (err) => {
                if (err) {
                    return reject({status: promisestatus.fail, 'error': err});
                }
            });
            client.flushall(() => {
                console.log('Flushed redis');
                let buffer = [], count = 0, maxcount = 10000, stream_paused = false;
                rl.on('line', (line) => {
                    if (line) {
                        let o = JSON.parse(line);
                        buffer = buffer.concat(o);
                        count += 1;
                        if (count >= maxcount) {
                            if (!stream_paused) {
                                rl.pause();
                                stream_paused = true;
                                setTimeout(() => {
                                    let i=0;
                                    function processBufferObject(template) {
                                        client.set('checksum '+template.checksum, JSON.stringify(template), (err, res) => {
                                            if (err) {
                                                console.log(err);
                                            }
                                            i += 1;
                                            if (i < buffer.length) {
                                                processBufferObject(buffer[i]);
                                            } else {
                                                buffer = [];
                                                count = 0;
                                                stream_paused = false;
                                                return rl.resume();
                                            }
                                        });
                                    }
                                    processBufferObject(buffer[i]);
                                }, 100);
                            }
                        }
                    }
                });
                rl.on('close', (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    } else {
                        client.quit();
                        resolve({status: promisestatus.success});
                    }
                });
            });
        }, ({status, error}) => {
            return reject({status: promisestatus.fail, 'error': error});
        });
    });
};

function createTemplatesData() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('temp/templates.json')) {
            loadTemplatesInRedis().then((result) => {
                console.log(`Loading of templates: ${result.status}`);
                let client = redis.createClient();
                client.on('error', (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                });
                let writeStream = fs.createWriteStream('temp/templates.json', {encoding:'utf8'});
                client.keys('checksum*', (err, keys) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    if (keys && keys.length > 0) {
                        let currentIndex = 0;
                        const closeConnection = function() {
                            client.quit(function (err, res) {
                                if (err) {
                                    return reject({status: promisestatus.fail, 'error': err});
                                }
                                if (res) {
                                    resolve({status: promisestatus.success});
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
                return reject({status: promisestatus.fail, 'error': error});
            });
        } else {
            resolve({status: promisestatus.success});
        }
    });
};

module.exports = createTemplatesData;

// TODO Remove below code
/*
createTemplatesData().then((result) => {
    console.log(`Extract Templates data: ${result.status}`);
}, ({status, error}) => {
    console.log('Extract Templates data: ', status, error);
});
*/
