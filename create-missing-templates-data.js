const fs = require('fs'),
    promisestatus = require('./lib/promise-status.js'),
    loadFileRecordsInRedis = require('./lib/load-file-in-redis.js'),
    readfileGenerator = require('./lib/readfile-generator.js'),
    redis = require('redis')
    ;

function createMissingTemplatesList() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync('temp/missing-templates.json')) {
            let templatesValuesFile = 'temp/templates-values.json';
            loadFileRecordsInRedis(templatesValuesFile, 'checksum', true, function (obj) {
                return (obj && obj.value && obj.value.indexOf('Lua error') === -1);
            }).then((result) => {
                    console.log(`Loading of file ${templatesValuesFile} records in redis: ${result.status}`);
                    let writeStream = fs.createWriteStream('temp/missing-templates.json', {encoding:'utf8'});
                    let client = redis.createClient();
                    client.on('error', (err) => {
                        if (err) {
                            return reject({status: promisestatus.fail, 'error': err});
                        }
                    });
                    readfileGenerator('temp/templates.json', (gen) => {
                        function writeRecord(next) {
                            if (next.value) {
                                let record = JSON.parse(next.value);
                                client.get(record.checksum, (err, res) =>{
                                    if (!res) {
                                        writeStream.write(JSON.stringify(record)+'\n');
                                    }
                                    writeRecord(gen.next());
                                });
                            }
                        };
                        writeRecord(gen.next());
                    }, (err) => {
                        if (err) {
                            return reject({status: promisestatus.fail, 'error': err});
                        }
                        client.quit();
                        resolve({status: promisestatus.success});
                    });

                },  ({status, error}) => {
                    return reject({status: promisestatus.fail, 'error': error});
                });
        } else {
            resolve({status: promisestatus.success});
        }
    });
};

// TODO : Add below code to index.js and remove from here.

createMissingTemplatesList().then((result) => {
    console.log(result.status);
}, ({status, error}) => {
    console.log(status, error);
});
