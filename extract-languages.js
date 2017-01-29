const fs = require("fs"),
  readline = require("readline"),
  utils = require('./lib/utils.js'),
  promisestatus = require('./lib/promise-status.js')
    ;

const languagesmap = utils.getKeyCounterMap();

const isValidLanguage = function (language) {
    return (language
            && language.length > 3
            && language !== 'unknown'
        );
};

const arrayFilter = function (obj) {
    return (obj && obj.value >= 100);
};

const createLanguagesMap = function(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        let readstream = fs.createReadStream(inputFile,
                { encoding: "utf8" });
        const rl = readline.createInterface({ input: readstream });
        rl.on('line', (line) => {
                    if (line) {
                        let o = JSON.parse(line);
                        if (isValidLanguage(o.language)) {
                            languagesmap.add(o.language);
                        }
                    }
                }
            );
        rl.on('close', (err) => {
            if (err) {
                return reject({status: promisestatus.fail, 'error': err});
            }

            let arr = utils.getArrayFromMap(languagesmap);
            utils.saveArrayToFile(arr, outputFile, arrayFilter,
                (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    } else {
                        resolve({status: promisestatus.success});
                    }
                });
        });
    });
};

exports = createLanguagesMap;

if (require.main === module) {
    createLanguagesMap('temp/data.json', 'temp/languages.json').then((result) => {
        console.log(`Languages map: ${result.status}`);
    }, ({status, error}) => {
        console.log('Languages map: ', status, error);
    });
}
