const fs = require('fs'),
    path = require('path'),
    config = require('config'),
    readStream = fs.createReadStream('temp/sorted-filtered-templates.json', {encoding:'utf8'}),
    es = require('event-stream'),
    MongoClient = require('mongodb').MongoClient
    ;


MongoClient.connect(config.get('mongodb-url'), (err, db) => {
    if (err) console.log(err);

    readStream.on('end', () => {
        db.close();
    });
    readStream
        .pipe(es.split())
        .pipe(es.map(function(data, cb){
            if (data) {
                let obj = JSON.parse(data);
                db.collection('templates').insertOne(obj, (err, result) => {
                    cb(null, data);
                });
            } else {
                cb(null, null);
            }
        }));
});
