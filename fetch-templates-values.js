const fs = require('fs'),
    readline = require('readline'),
    promisestatus = require('./lib/promise-status.js'),
    wikiConnector = require('./lib/wiki-api-connector.js'),
    cheerio = require('cheerio'),
    redis = require('redis'),
    readfileGenerator = require('./lib/readfile-generator.js').readfileGenerator,
    utils = require('./lib/utils.js')
    ;

const sanitizeHtmlBlock = function(htmlText) {
    let $ = cheerio.load(htmlText);
    let mdivs = $('.muqsith_template_div');
    if (mdivs.length > 1) {
        for (let i=1; i < mdivs.length; i+=1) {
            let mdiv = mdivs[i];
            $(mdiv).remove();
        }
    }
    return $.html();
};

const parseResponse = function (response) {
    let arr = [];
    let data = `<html><body>${response}</body></html>`;
    let $ = cheerio.load(data);
    let mdivs = $('.muqsith_template_div');
    for (let i=0; i < mdivs.length; i+=1) {
        let mdiv = mdivs[i];
        let _html = $.html(mdiv);
        _html = sanitizeHtmlBlock(_html);
        let obj = {};
        obj.html = _html;
        obj.checksum = mdiv.attribs.id;
        arr = arr.concat(obj);
    }
    return arr;
};

let saveResponseDocs = function (writeStream, docs) {
    return new Promise((resolve, reject) => {
        getRedisClient(false).then(({status, client}) => {
            let index = 0;
            const processResult = function(obj) {
                client.get(obj.checksum, (err, val) => {
                    if (err) {
                        client.quit();
                        return reject({status: promisestatus.fail, 'error': err});
                    } else if (val) {
                        let templateObject = JSON.parse(val);
                        templateObject.value = obj.html;
                        writeStream.write(JSON.stringify(templateObject)+'\n');
                        index += 1;
                        if (index < docs.length) {
                            processResult(docs[index]);
                        } else {
                            client.quit();
                            resolve({status: promisestatus.success});
                        }
                    }
                });
            }
            processResult(docs[index]);
        }, ({status, error}) => {
            return reject({status: promisestatus.fail, 'error': error});
        });
    });
};

const makeRequest = function (requestData) {
    return new Promise((resolve, reject) => {
        wikiConnector(requestData, (err, response) => {
            if (response) {
                response = '<html><body>'+response+'</body></html>';
                let result = parseResponse(response);
                console.log(`Response docs length ${result.length}.`);
                resolve({status: promisestatus.success, 'response': result});
            } else if (err) {
                return reject({status: promisestatus.fail, 'error': err});
            }
        });
    });
};

const getRequestData = function (inputArray) {
    return new Promise((resolve, reject) => {
        let requestdata = '';
        getRedisClient(true).then(({status, client}) => {
            let index = 0;
            function processRecord(line) {
                let doc = JSON.parse(line);
                requestdata += `<div class="muqsith_template_div" id="${doc.checksum}">${doc.template}</div>`;
                client.set(doc.checksum, JSON.stringify(doc), (err, res) => {
                    index += 1;
                    if (index < inputArray.length) {
                        processRecord(inputArray[index]);
                    } else {
                        client.quit();
                        resolve({status: promisestatus.success, 'requestdata': requestdata});
                    }
                });
            };
            processRecord(inputArray[index]);
        }, ({status, error}) => {
            return reject({status: promisestatus.fail, 'error': error});
        });
    });
}

const getRedisClient = function (flush) {
    return new Promise((resolve, reject) => {
        let client = redis.createClient();
        client.on('error', (err) => {
            if (err) {
                client.quit();
                return reject({status: promisestatus.fail, 'error': err});
            }
        });

        if (flush) {
            client.flushall(() => {
                console.log('Flushed redis');
                resolve({status: promisestatus.success, 'client':client});
            });
        } else {
            resolve({status: promisestatus.success, 'client':client});
        }
    });
};

const getWriteStream = function (outputFile, beginCount) {
    let writeStream = undefined;
    if (beginCount > 0) {
        writeStream = fs.createWriteStream(outputFile, {encoding:'utf8', flags: 'a'});
    } else {
        writeStream = fs.createWriteStream(outputFile, {encoding:'utf8'});
    }
    return writeStream;
};

function fetchTemplatesValues(inputFile, outputFile, max = 500) {
    return new Promise((resolve, reject) => {
        utils.getBeginingLineNumber(inputFile, outputFile, 'checksum').then( (beginingLineResult) => {
                let beginCount = beginingLineResult.line;
                console.log(`Begining from line ${beginCount} in ${inputFile}`);
                let writeStream = getWriteStream(outputFile, beginCount);
                saveResponseDocs = saveResponseDocs.bind(null, writeStream);
                let totalcount = 0, count = 0, inputArray = [];
                readfileGenerator(inputFile, (gen) => {
                    const moveForward = function(next) {
                        if (next.value) {
                            totalcount += 1;
                            if (totalcount >= beginCount) {
                                count += 1;
                                inputArray = inputArray.concat(next.value);
                                if (count >= max) {
                                    getRequestData(inputArray).then( ({status, requestdata}) => {
                                        makeRequest(requestdata).then( ({status, response}) => {
                                            saveResponseDocs(response).then( ({status}) => {
                                                console.log(`Saving response to file: ${status}`);
                                                count = 0;
                                                inputArray = [];
                                                moveForward(gen.next());
                                            }, ({status, error}) => {
                                                return reject({status: promisestatus.fail, 'error': error});
                                            });
                                        }, ({status, error}) => {
                                            return reject({status: promisestatus.fail, 'error': error});
                                        });
                                    }, ({status, error}) => {
                                        return reject({status: promisestatus.fail, 'error': error});
                                    });
                                } else {
                                    moveForward(gen.next());
                                }
                            } else {
                                moveForward(gen.next());
                            }
                        }
                    }
                    moveForward(gen.next())
                }, (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    if (inputArray && inputArray.length > 0) {
                        getRequestData(inputArray).then( ({status, requestdata}) => {
                            makeRequest(requestdata).then( ({status, response}) => {
                                saveResponseDocs(response).then( ({status}) => {
                                    console.log(`Saving response to file: ${status}`);
                                    count = 0;
                                    inputArray = [];
                                    resolve({status: promisestatus.success});
                                }, ({status, error}) => {
                                    return reject({status: promisestatus.fail, 'error': error});
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
        }, (err) => {
            return reject({status: promisestatus.fail, 'error': err});
        });
    });
};

module.exports = fetchTemplatesValues;

if (require.main === module) {
    fetchTemplatesValues('temp/templates-sample.json', 'temp/templates-sample-values.json')
        .then(({status}) => {
        console.log(`Templates fetch: ${status}`);
    }, ({status, error}) => {
        console.log(`Templates fetch: ${status} - ${error}`);
    })
}
