const fs = require('fs'),
    path = require('path'),
    config = require('config'),
    readStream = fs.createReadStream('temp/data.json', {encoding:'utf8'}),
    es = require('event-stream'),
    MongoClient = require('mongodb').MongoClient,
    lib = require('./lib/utils.js')
    ;


MongoClient.connect(config.get('mongodb-url'), (err, db) => {
    if (err) console.log(err);
    readStream.on('end', () => {
        db.close();
    });
    readStream
        .pipe(es.split())
        .pipe(es.map(function(data, cb){
            if (data && data.length > 1) {
                let o = JSON.parse(data);
                o.language = lib.getLanguage(o.text);
                db.collection('pages').insertOne(o, (err, result) => {
                    if (err) {
                        console.log(err);
                        cb(err);
                    } else {
                        cb(null, data);
                    }
                });
            } else {
                cb(null, null);
            }
        }));
});
