const fs = require('fs'),
    readline = require('readline'),
    path = require('path'),
    promisestatus = require('./promise-status.js')
    ;

exports.escapeRegExp = function (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

exports.replaceAll = function (str, find, replace) {
    return str.replace(new RegExp(exports.escapeRegExp(find), 'g'), replace);
};

exports.isHeaderLine = function (line) {
    let tl = line.trim();
    return (/^[=].+[=]$/g).test(tl)
};

exports.hasValidText = function (text) {
    return (/^[a-z0-9 ]+$/g).test(text);
};

exports.getLanguage = function (text) {
    let lang = 'unknown';
    let lines = text.split('\n');
    // Assuming first line is of language.
    // Assumption is based on visual observation.
    for(let line of lines) {
        if (exports.isHeaderLine(line)){
            lang = line.replace(/[=]/g,'').trim().toLowerCase();
            break;
        }
    }
    return lang;
};

exports.getHeaderText = function (text) {
    let result = text;
    if (text) {
        result = text.trim().replace(/[=]/g,'').trim();
    }
    return result;
};

exports.getHeaderLevel = function(line) {
    let level = -1;
    if (exports.isHeaderLine(line)) {
        level = 0;
        let hl = line.trim();
        for (let c of hl) {
            if (c === '=') {
                level += 1;
            } else {
                break;
            }
        }
    }
    return level;
};

exports.getArrayFromMap = function(map) {
    let arr = [];
    if (map) {
        for (let key in map) {
            if (map.hasOwnProperty(key) && typeof map[key] !== 'function') {
                arr = arr.concat({'key':key, 'value':map[key]});
            }
        }
        arr = arr.sort((o1, o2) => {
            return o2.value - o1.value;
        });
    }
    return arr;
};

exports.getKeyCounterMap = function() {
    const keyCounterMap = {
        add: function(key) {
            if (key) {
                if (!this[key]) {
                    this[key] = 1;
                } else {
                    this[key] += 1;
                }
            }
        }
    };
    return keyCounterMap;
};

exports.applyFilter = (obj, filter) => {
    let rObj = obj;
    if (filter) {
        if (typeof filter === 'function'
            && !filter(obj))
        {
            rObj = undefined;
        }
    }
    return rObj;
};

exports.saveArrayToFile = function(array, file, filter, cb) {
    if (Array.isArray(array) && file) {
        let writeStream = fs.createWriteStream(file, {encoding:'utf8'});
        let index = 0;
        const processObject = function(obj) {
            obj = exports.applyFilter(obj, filter);
            index += 1;
            if (obj) {
                writeStream.write(JSON.stringify(obj)+'\n', 'utf8', () => {
                    if (index < array.length) {
                        processObject(array[index]);
                    } else {
                        return cb();
                    }
                });
            } else {
                if (index < array.length) {
                    processObject(array[index]);
                } else {
                    return cb();
                }
            }
        };
        processObject(array[index]);
    }
};

exports.getFileAsMapSync = function(file) {
    let map = {};
    let data = fs.readFileSync(file);
    let lines = data.toString().split("\n");
    for (let line of lines) {
        if (line) {
            let obj = JSON.parse(line);
            if (obj.key) {
              map[obj.key] = true;
            }
        }
    }
    return map;
};

exports.getFilteredText = function(headersmap, text) {
  let filteredlines_text = "";
  let filteredlines = [];
  let captureline = false;
  let lines = text.split("\n");
  let previousHeader = {name: '', level: -1, valid:false};
  let headerscount = 0;
  for (let line of lines) {
    if (exports.isHeaderLine(line)) {
      headerscount += 1;
      if (headerscount > 1) {
          let currentLevel = exports.getHeaderLevel(line);
          let key = exports.getHeaderText(line).trim().toLowerCase();
          if (headersmap[key]) {
              if (previousHeader.level === -1) {
                  captureline = true;
              } else if (currentLevel <= previousHeader.level) {
                  captureline = true;
              } else if ((currentLevel > previousHeader.level)
                   && previousHeader.valid) {
                  captureline = true;
              } else {
                  captureline = false;
              }
          } else {
              captureline = false;
          }

          if ((previousHeader.level === -1) || (currentLevel <= previousHeader.level)) {
              previousHeader = {'name': key, level: currentLevel, valid: headersmap[key]};
          }
      }
    }
    if (captureline) {
      filteredlines = filteredlines.concat(line);
    }
  }
  if (filteredlines.length > 0) {
    filteredlines_text = filteredlines.join("\n");
  }
  return filteredlines_text;
};

exports.moveFile = function(fromFile, toFile, cb) {
    const readStream = fs.createReadStream(fromFile, {encoding:'utf8'});
    const writeStream = fs.createWriteStream(toFile, {encoding:'utf8'});
    readStream.pipe(writeStream);
    readStream.on('close', () => {
        fs.unlinkSync(fromFile);
        cb();
    });
};

exports.copyFile = function(fromFile, toFile, cb) {
    const readStream = fs.createReadStream(fromFile, {encoding:'utf8'});
    const writeStream = fs.createWriteStream(toFile, {encoding:'utf8'});
    readStream.pipe(writeStream);
    readStream.on('close', () => {
        cb();
    });
};

exports.getLastValidRecord = function(file, key) {
    return new Promise((resolve, reject) => {
        try {
            let validKey = '';
            const readStream = fs.createReadStream(file, {encoding:'utf8'});
            let copyFile = file+'_copy';
            const writeStream = fs.createWriteStream(copyFile, {encoding:'utf8'});
            readStream.pipe(writeStream);
            readStream.on('close', () => {
                fs.unlinkSync(file);
                const readStream2 = fs.createReadStream(copyFile, {encoding:'utf8'});
                const writeStream2 = fs.createWriteStream(file, {encoding:'utf8'});
                const rl = readline.createInterface({input: readStream2});
                let isError = false;
                rl.on('line', (line) => {
                    try {
                        let o = JSON.parse(line);
                        validKey = o[key]
                        if (!isError) {
                            writeStream2.write(JSON.stringify(o)+'\n');
                        }
                    } catch (e) {
                        isError = true;
                        rl.close();
                    }
                });
                rl.on('close', (err) => {
                    fs.unlinkSync(copyFile);
                    resolve({status: promisestatus.success, 'value': validKey});
                });
            });
        } catch (e) {
            return reject({status: promisestatus.fail, 'error': e});
        }
    });
};

exports.getLineNumberOfRecord = function(file, key, value) {
    return new Promise((resolve, reject) => {
        try {
            let lineNumber = 1;
            const readStream = fs.createReadStream(file, {encoding:'utf8'});
            const rl = readline.createInterface({input: readStream});
            let hasRecordFound = false;
            rl.on('line', (line) => {
                if (line) {
                    if (!hasRecordFound) {
                        lineNumber += 1;
                        try {
                            let o = JSON.parse(line);
                            if (o[key] === value) {
                                hasRecordFound = true;
                                rl.close();
                            }
                        } catch (e) {
                            // do nothing. not even report.
                        }
                    }
                }
            });
            rl.on('close', (err) => {
                if (!hasRecordFound) {
                    lineNumber = 0;
                }
                resolve({status: promisestatus.success, 'line': lineNumber});
            });
        } catch (e) {
            return reject({status: promisestatus.fail, 'error': e});
        }
    });
};

exports.getBeginingLineNumber = function(inputFile, outputFile, key) {
    return new Promise((resolve, reject) => {
        let line = 1;
        if (fs.existsSync(inputFile) && fs.existsSync(outputFile)) {
            exports.getLastValidRecord(outputFile, key).then(({status, value}) => {
                exports.getLineNumberOfRecord(inputFile, key , value).then(({status, line}) => {
                    resolve({'status': promisestatus.success, 'line': line});
                }, ({status, error}) => {
                    return reject({'status': status, 'error': error});
                });
            }, ({status, error}) => {
                return reject({'status': status, 'error': error});
            });
        } else {
            resolve({'status': promisestatus.success, 'line': line});
        }
    });
};
