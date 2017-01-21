const fs = require("fs"),
  readline = require("readline"),
  lib = require('./lib/utils.js'),
  promisestatus = require('./lib/promise-status.js')
    ;

function createLanguagesMap() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('temp/languages.txt')) {
            try {
                let writeStream = fs.createWriteStream('temp/languages.txt', {encoding:'utf8'});
                let readstream = fs.createReadStream("temp/data.json", { encoding: "utf8" });
                let languagesmap = {};
                const rl = readline.createInterface({ input: readstream });
                rl.on('line', (line) => {
                            if (line) {
                                let o = JSON.parse(line);
                                if (!languagesmap[o.language]) {
                                    languagesmap[o.language] = 1;
                                } else {
                                    languagesmap[o.language] += 1;
                                }
                            }
                        }
                    );
                rl.on('close', (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    let arr = [];
                    for (let language in languagesmap) {
                        if (languagesmap.hasOwnProperty(language)) {
                            arr = arr.concat({'language':language, 'value':languagesmap[language]});
                        }
                    }
                    arr = arr.sort((o1, o2) => {
                        return o2.value - o1.value;
                    });

                    for (let a of arr) {
                        writeStream.write(a.language+' - '+a.value+'\n');
                    }
                    resolve({status: promisestatus.success});
                });
            } catch(e) {
                return reject({status: promisestatus.fail, 'error': e});
            }
        } else {
            resolve({status: promisestatus.success});
        }
    });
};

module.exports = createLanguagesMap;
