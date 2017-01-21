const fs = require("fs"),
  lib = require("./lib/utils.js"),
  es = require("event-stream"),
  promisestatus = require('./lib/promise-status.js')
  ;


function getHeadersMap() {
  let headersmap = {};
  let data = fs.readFileSync("temp/filtered-headers.txt");
  let lines = data.toString().split("\n");
  for (let line of lines) {
    let key = line.split("-")[0].trim();
    if (key) {
      headersmap[key] = true;
    }
  }
  return headersmap;
}

function getLanguagesMap() {
  let languagesmap = {};
  let data = fs.readFileSync("temp/languages.txt");
  let lines = data.toString().split("\n");
  for (let line of lines) {
    let key = line.split("-")[0].trim();
    if (key) {
      languagesmap[key] = parseInt(line.split("-")[1].trim());
    }
  }
  return languagesmap;
}

const createGetFilteredText = function() {
  let headersmap = getHeadersMap();
  return function(text) {
    let filteredlines_text = "";
    let filteredlines = [];
    let captureline = false;
    let lines = text.split("\n");
    for (let line of lines) {
      if (lib.isHeaderLine(line)) {
        let key = lib.removeAllHeaderMarkdownSymbols(line).toLowerCase();
        if (headersmap[key]) {
          captureline = true;
        } else {
          captureline = false;
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
};

function createFilteredData() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('temp/filtered-data.json')) {
            try {
                let readStream = fs.createReadStream("temp/data.json", { encoding: "utf8" });
                let getFilteredText = createGetFilteredText();
                let writeStream = fs.createWriteStream("temp/filtered-data.json", {
                  encoding: "utf8"
                });
                let languagesmap = getLanguagesMap();

                readStream.on("close", (err) => {
                    if (err) {
                        return reject({status: promisestatus.fail, 'error': err});
                    }
                    resolve({status: promisestatus.success});
                });
                readStream.pipe(es.split()).pipe(
                    es.map(function(data, cb) {
                      if (data && data.length > 1) {
                        let o = JSON.parse(data);
                        if (o.language
                            && languagesmap[o.language]
                            && o.language !== 'unknown'
                            && languagesmap[o.language] > 100) {
                          o.text = getFilteredText(o.text);
                          writeStream.write(JSON.stringify(o) + "\n");
                        }
                        cb(null, data);
                      } else {
                        cb(null, null);
                      }
                    })
                );
            } catch(e) {
                return reject({status: promisestatus.fail, 'error': e});
            }
        } else {
            resolve({status: promisestatus.success});
        }
    });
}

module.exports = createFilteredData;
