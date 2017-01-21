const fs = require("fs"),
  readstream = fs.createReadStream("temp/data.json", { encoding: "utf8" }),
  writeStream = fs.createWriteStream('temp/filtered-headers.txt', {encoding:'utf8'});
  readline = require("readline"),
  lib = require('./lib/utils.js'),
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
    });
};

createFilteredHeaders();
