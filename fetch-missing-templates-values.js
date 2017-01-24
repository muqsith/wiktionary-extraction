const fs = require('fs'),
    redis = require('redis'),
    readline = require('readline'),
    promisestatus = require('./lib/promise-status.js')
    ;

function loadFetchedTemplatesInRedis() {
    return new Promise((resolve, reject) => {
        let client = redis.createClient();
        client.on('error', (err) => {
            if (err) {
                return reject({status: promisestatus.fail, 'error': err});
            }
        });

        let readStream = fs.createReadStream('temp/templates-values.json', {encoding:'utf8'});
        let rl = readline.createInterface({input: readStream});
        let jsonParseExceptionsCount = 0, luaerrorscount = 0, loaderrorcount = 0,
            templatesloaded = 0, buffer = [], count = 0, maxcount = 10000,
            stream_paused = false
            ;
        client.flushall(() => {
            console.log('Flushed redis');
            rl.on('line', (line) => {
                if (line) {
                    let o = undefined;
                    try {
                        o = JSON.parse(line);
                    } catch(e) {
                        jsonParseExceptionsCount += 1;
                    }
                    if (o) {
                        buffer = buffer.concat(o);
                        count += 1;
                        if (count >= maxcount) {
                            if (!stream_paused) {
                                rl.pause();
                                stream_paused = true;
                                setTimeout(() => {
                                    let currentIndex = 0;
                                    function processBufferObject(obj) {
                                        if (obj && obj.value && obj.value.indexOf('Lua error') === -1) {
                                            client.set(obj.checksum, true, (err, res) => {
                                                if (err) {
                                                    console.log('Error', err);
                                                    loaderrorcount += 1;
                                                } else {
                                                    templatesloaded += 1;
                                                }
                                                currentIndex+=1;
                                                if (currentIndex < buffer.length) {
                                                    processBufferObject(buffer[currentIndex]);
                                                } else {
                                                    buffer = [];
                                                    count = 0;
                                                    stream_paused = false;
                                                    return rl.resume();
                                                }
                                            });
                                        } else {
                                            luaerrorscount += 1;
                                            currentIndex+=1;
                                            if (currentIndex < buffer.length) {
                                                processBufferObject(buffer[currentIndex]);
                                            } else {
                                                buffer = [];
                                                count = 0;
                                                stream_paused = false;
                                                return rl.resume();
                                            }
                                        }
                                    }
                                    processBufferObject(buffer[currentIndex]);
                                }, 100);
                            }
                        }
                    }
                }
            });
            rl.on('close', (err) => {
                if (err) {
                    return reject({status: promisestatus.fail, 'error': err});
                } else {
                    client.quit(function (err, res) {
                        if (err) {
                            return reject({status: promisestatus.fail, 'error': err});
                        }
                        if (res) {
                            console.log(`Templates loaded: ${templatesloaded}`);
                            console.log(`Templates load error: ${loaderrorcount}`);
                            console.log(`Templates with JSON exceptions: ${jsonParseExceptionsCount}`);
                            console.log(`Templates with Lua errors: ${luaerrorscount}`);
                            resolve({status: promisestatus.success});
                        }
                    });
                }
            });
        });
    });
};

function createMissingTemplatesList() {
    return new Promise((resolve, reject) => {
        loadFetchedTemplatesInRedis().then((result) => {
            console.log('Loading of fetched templates: ', result.status);
            let readStream = fs.createReadStream('temp/templates.json', {encoding:'utf8'});
            let writeStream = fs.createWriteStream('temp/missing-templates.json', {encoding:'utf8'});
            let rl = readline.createInterface({input: readStream});
            let client = redis.createClient();
            let buffer = [], count = 0, maxcount = 10000, stream_paused = false;
            client.on('error', (err) => {
                if (err) {
                    return reject({status: promisestatus.fail, 'error': err});
                }
            });
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
                                function processBufferObject(obj) {
                                    client.get(obj.checksum, (err, res) => {
                                        if (err || !res) {
                                            writeStream.write(JSON.stringify(o)+'\n');
                                        }
                                        i+=1;
                                        if (i < buffer.length) {
                                            processBufferObject(buffer[i]);
                                        } else {
                                            buffer = [];
                                            count = 0;
                                            stream_paused = false;
                                            rl.resume();
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
                    client.quit(function (err, res) {
                        if (err) {
                            return reject({status: promisestatus.fail, 'error': err});
                        }
                        if (res) {
                            resolve({status: promisestatus.success});
                        }
                    });
                }
            });
        }, ({status, error}) => {
            console.log('Loading of fetched templates failed: ', status, error);
        });
    });
};

// TODO : Add below code to index.js and remove from here.

createMissingTemplatesList().then((result) => {
    console.log(result.status);
}, ({status, error}) => {
    console.log(status, error);
});
