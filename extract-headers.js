const fs = require("fs"),
  readline = require("readline"),
  utils = require('./lib/utils.js'),
  promisestatus = require('./lib/promise-status.js'),
  KEY_WORDS = ['NOUN', 'VERB', 'PARTICIPLE', 'ARTICLE', 'PRONOUN',
             'PREPOSITION', 'ADVERB', 'CONJUNCTION', 'ADJECTIVE',
             'INTERJECTION', 'ETYMOLOGY', 'PRONUNCIATION', 'ACRONYM',
             'TRANSLATIONS', 'INITIALISM', 'ABBREVIATION',
            'USAGE NOTES', 'DESCRIPTION', 'SYMBOL', 'PHRASE',
            'ROMANIZATION', 'NUMERAL']
    ;

function hasKeyWordInText(text) {
    let result = false;
    for (let keyword of KEY_WORDS) {
        if (text && text.toLowerCase().indexOf(keyword.toLowerCase()) !== -1) {
            result = true;
            break;
        }
    }
    return result;
};

function getSelectedHeader(textline) {
    let header = undefined;
    if (textline && utils.isHeaderLine(textline)) {
        let seletectedHeader = utils.getHeaderText(textline).trim().toLowerCase();
        if (utils.hasValidText(seletectedHeader)
            && hasKeyWordInText(seletectedHeader)) {
                header = seletectedHeader;
            }
    }
    return header;
};

const headersmap = utils.getKeyCounterMap();

const createFilteredHeaders = function(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        let readstream = fs.createReadStream(inputFile, { encoding: "utf8" });
        const rl = readline.createInterface({ input: readstream });
        rl.on('line', (line) => {
                    if (line) {
                        let o = JSON.parse(line);
                        let text_lines = o.text.split('\n');
                        for (let textline of text_lines) {
                            let seletectedHeader = getSelectedHeader(textline);
                            headersmap.add(seletectedHeader);
                        }
                    }
                }
            );
        rl.on('close', (err) => {
            if (err) {
                return reject({status: promisestatus.fail, 'error': err});
            }
            let arr = utils.getArrayFromMap(headersmap);
            utils.saveArrayToFile(arr, outputFile, undefined,
                (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': e});
                    } else {
                        resolve({status: promisestatus.success});
                    }
                });
        });
    });
};

exports = createFilteredHeaders;

if (require.main === module) {
    createFilteredHeaders('temp/data.json','temp/headers.json').then((result) => {
        console.log(`Filtered headers: ${result.status}`);
    }, ({status, error}) => {
        console.log('Filtered headers: ', status, error);
    });
}
