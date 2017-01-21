const fs = require("fs"),
  lib = require("./lib/utils.js"),
  promisestatus = require('./lib/promise-status.js'),
  getTemplates = require('./lib/templates-from-text.js'),
  readline = require('readline'),
  CRC32 = require('crc-32')
  ;

 function createTemplatesData() {
     return new Promise((resolve, reject) => {
         if (!fs.existsSync('temp/templates-data.json')) {
             try {
                 let readStream = fs.createReadStream("temp/filtered-data.json", { encoding: "utf8" });
                 let writeStream = fs.createWriteStream("temp/templates-data.json", {
                   encoding: "utf8"
                 });
                 const rl = readline.createInterface({ input: readStream });

                 rl.on("close", (err) => {
                     if (err) {
                         return reject({status: promisestatus.fail, 'error': err});
                     }
                     resolve({status: promisestatus.success});
                 });
                 rl.on('line', (line) => {
                       if (line && line.length > 1) {
                         let o = JSON.parse(line);
                         if (o.text) {
                             let templates = getTemplates(o.text);
                             if (templates && templates.length > 0) {
                                 for (let template of templates) {
                                     let checksum = CRC32.str(template);
                                     let obj = {'checksum': checksum, 'template': template, 'value': ''};
                                     writeStream.write(JSON.stringify(obj)+'\n');
                                 }
                             }
                         }
                       }
                   });
             } catch(e) {
                 return reject({status: promisestatus.fail, 'error': e});
             }
         } else {
             resolve({status: promisestatus.success});
         }
     });
 };

 module.exports = createTemplatesData;
