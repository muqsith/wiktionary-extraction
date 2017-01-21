const fs = require("fs"),
  readline = require("readline"),
  lib = require('./lib/utils.js'),
  promisestatus = require('./lib/promise-status.js'),
  KEY_WORDS = ['NOUN', 'VERB', 'PARTICIPLE', 'ARTICLE', 'PRONOUN',
             'PREPOSITION', 'ADVERB', 'CONJUNCTION', 'ADJECTIVE',
             'INTERJECTION', 'ETYMOLOGY', 'PRONUNCIATION', 'ACRONYM', 'TRANSLATIONS']
    ;

function hasKeyWords(text) {
    let result = false;
    for (let keyword of KEY_WORDS) {
        if (text && text.toLowerCase().indexOf(keyword.toLowerCase()) !== -1) {
            result = true;
            break;
        }
    }
    return result;
}

function createFilteredHeaders() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('temp/filtered-headers.txt')) {
            let writeStream = fs.createWriteStream('temp/filtered-headers.txt', {encoding:'utf8'});
            let readstream = fs.createReadStream("temp/data.json", { encoding: "utf8" });
            try {
                let headersmap = {};
                const rl = readline.createInterface({ input: readstream });
                rl.on('line', (line) => {
                            if (line) {
                                let o = JSON.parse(line);
                                let text_lines = o.text.split('\n');
                                for (let textline of text_lines) {
                                    if (lib.isHeaderLine(textline)) {
                                        let key = lib.removeAllHeaderMarkdownSymbols(textline).toLowerCase();
                                        if (lib.hasOnlyAlphabetsAndSpace(key)
                                            && hasKeyWords(key)) {
                                                if (!headersmap[key]) {
                                                    headersmap[key] = 1;
                                                } else {
                                                    headersmap[key] += 1;
                                                }
                                            }
                                    }
                                }
                            }
                        }
                    );
                rl.on('close', (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    let arr = [];
                    for (let key in headersmap) {
                        if (headersmap.hasOwnProperty(key)) {
                            arr = arr.concat({'key':key, 'value':headersmap[key]});
                        }
                    }
                    arr = arr.sort((o1, o2) => {
                        return o2.value - o1.value;
                    });

                    for (let a of arr) {
                        writeStream.write(a.key+' - '+a.value+'\n');
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

module.exports = createFilteredHeaders;
