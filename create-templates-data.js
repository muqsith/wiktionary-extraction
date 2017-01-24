const fs = require('fs'),
    redis = require('redis'),
    promisestatus = require('./lib/promise-status.js'),
    getTemplates = require('./lib/templates-from-text.js'),
    CRC32 = require('crc-32'),
    es = require("event-stream")
    ;

function createTemplatesData() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('temp/templates.json')) {
            let readStream = fs.createReadStream('temp/filtered-data.json', {encoding:'utf8'});
            let client = redis.createClient();
            client.on('error', (err) => {
                if (err) {
                    return reject({status: promisestatus.fail, 'error': err});
                }
            });
            client.flushall(() => {
                console.log('Flushed redis');
                readStream
                    .pipe(es.split())
                    .pipe(es.map((line, cb) => {
                    if (line) {
                        let o = JSON.parse(line);
                        if (o.text) {
                            let templates = getTemplates(o.text);
                            if (templates && templates.length > 0) {
                                for (let template of templates) {
                                    let checksum = CRC32.str(template);
                                    let obj = {'checksum': checksum, 'template': template, 'value': ''};
                                    client.set('checksum '+obj.checksum, JSON.stringify(obj));
                                }
                            }
                        }
                        cb(null, line);
                    } else {
                        cb(null, null);
                    }
                }));
                readStream.on('close', (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
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
                });
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
