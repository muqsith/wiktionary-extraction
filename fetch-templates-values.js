const fs = require('fs'),
    readline = require('readline'),
    promisestatus = require('./lib/promise-status.js'),
    wikiConnector = require('./lib/wiki-api-connector.js'),
    cheerio = require('cheerio'),
    redis = require('redis')
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

function getTotalLinesFromBothFiles(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        let result = {inputLines: 0, outputLines: 0};
        let templatesStream = fs.createReadStream(inputFile, {encoding:'utf8'});
        let templateStreamRL = readline.createInterface({input: templatesStream});
        let inputFileLinesCount = 0;
        templateStreamRL.on('line', (line) => {
            if (line) inputFileLinesCount += 1;
        });
        templateStreamRL.on('close', (err) => {
            if (err) {
                return reject(err);
            }

            result.inputLines = inputFileLinesCount;

            if (fs.existsSync(outputFile)) {
                let templatesValueStream = fs.createReadStream(outputFile, {encoding:'utf8'});
                let templatesValueStreamRL = readline.createInterface({input: templatesValueStream});
                let outputFileLinesCount = 0;
                templatesValueStreamRL.on('line', (line) => {
                    if (line) outputFileLinesCount += 1;
                });

                templatesValueStreamRL.on('close', (err) => {
                    if (err) {
                        return reject(err);
                    }
                    result.outputLines = outputFileLinesCount;
                    resolve(result);
                });
            } else {
                resolve(result);
            }
        });
    });
};

function fetchTemplatesValues(inputFile, outputFile, docsPerRequest) {
    return new Promise((resolve, reject) => {
        getTotalLinesFromBothFiles(inputFile, outputFile).then( (fileLinesObject) => {
            console.log(fileLinesObject);
            if (fileLinesObject.inputLines > fileLinesObject.outputLines) {
                let beginCount = 0;
                let max = (docsPerRequest) ? docsPerRequest : 500;
                let writeStream = undefined;
                if (fileLinesObject.outputLines > 2) {
                    beginCount = fileLinesObject.outputLines - 2;
                    if ((fileLinesObject.inputLines - fileLinesObject.outputLines) < max) {
                        max = fileLinesObject.inputLines - fileLinesObject.outputLines;
                    }
                    writeStream = fs.createWriteStream(outputFile, {encoding:'utf8', flags: 'a'});
                } else {
                    writeStream = fs.createWriteStream(outputFile, {encoding:'utf8'});
                }
                let totalLinesCount = 0;
                console.log(`Begining from line ${beginCount} in ${inputFile}`);
                let count = 0;
                let requestData = '';
                let readStream = fs.createReadStream(inputFile, {encoding:'utf8'});

                let rl = readline.createInterface({input: readStream});

                let requestMade = false;

                let client = redis.createClient();
                client.on('error', (err) => {
                    if (err) {
                        client.quit();
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                });

                client.flushall(() => {
                    console.log('Flushed redis');
                    rl.on('close', (err) => {
                        client.quit();
                        if (err) {
                            return reject({status: promisestatus.fail, 'error': err});
                        } else {
                            resolve({status: promisestatus.success});
                        }
                    });
                    rl.on('line', (line) => {
                        totalLinesCount += 1;
                        if (totalLinesCount >= beginCount) {
                            count += 1;
                            if (count >= max) {
                                rl.pause();
                                if (!requestMade) {
                                    requestMade = true;
                                    setTimeout( () => {
                                        wikiConnector(requestData, (err, response) => {
                                            if (response) {
                                                response = '<html><body>'+response+'</body></html>';
                                                let result = parseResponse(response);
                                                console.log(`Result length ${result.length}`);
                                                const cleanupAndProceed = function() {
                                                    client.flushall(() => {
                                                        requestData = '';
                                                        count = 0;
                                                        requestMade = false;
                                                        rl.resume();
                                                    });
                                                };
                                                let i=0;
                                                const processResult = function(obj) {
                                                    client.get(obj.checksum, (err, val) => {
                                                        if (err) {
                                                            client.quit();
                                                            return reject({status: promisestatus.fail, 'error': err});
                                                        } else if (val) {
                                                            let templateObject = JSON.parse(val);
                                                            templateObject.value = obj.html;

                                                            writeStream.write(JSON.stringify(templateObject)+'\n');
                                                            i += 1;
                                                            if (i < result.length) {
                                                                processResult(result[i]);
                                                            } else {
                                                                return cleanupAndProceed();
                                                            }
                                                        }
                                                    });
                                                }
                                                processResult(result[i]);
                                            } else if (err) {
                                                client.quit();
                                                return reject({status: promisestatus.fail, 'error': err});
                                            }
                                        });
                                    }, 500);
                                }
                            }
                            let doc = JSON.parse(line);
                            requestData += `<div class="muqsith_template_div" id="${doc.checksum}">${doc.template}</div>`;
                            client.set(doc.checksum, JSON.stringify(doc));
                        }
                    });
                });
            } else {
                client.quit();
                resolve({status: promisestatus.success});
            }
        }, (err) => {
            return reject({status: promisestatus.fail, 'error': err});
        });
    });
};

module.exports = fetchTemplatesValues;
