const fs = require('fs'),
    path = require('path'),
    config = require('config'),
    readStream = fs.createReadStream('temp/data.json', {encoding:'utf8'}),
    es = require('event-stream'),
    MongoClient = require('mongodb').MongoClient,
    lib = require('./lib/utils.js')
    ;

let headersmap = {};

function loadHeadersMap() {
    let data = fs.readFileSync('temp/filtered-headers.txt');
    let lines = data.toString().split('\n');
    for (let line of lines) {
        let key = line.split('-')[0].trim();
        if (key) {
            headersmap[key] = true;
        }
    }
};

function getFilteredText(text) {
    let filteredlines_text = '';
    let filteredlines = [];
    let captureline = false;
    let lines = text.split('\n');
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
        filteredlines_text = filteredlines.join('\n');
    }
    return filteredlines_text;
}

MongoClient.connect(config.get('mongodb-url'), (err, db) => {
    if (err) console.log(err);
    // init
    loadHeadersMap();

    let languagesmap = {};

    db.collection('pages').aggregate([ {$match: { language:/^[a-z]+$/ } },
            { $group: { _id:"$language",
                count: { $sum: 1}  } },
            {$sort: {count:-1} } ], (err, results) => {
                if (err) {
                    console.log(err);
                } else if (results) {
                    for (let o of results) {
                        if (o['_id'] !== 'unknown' && o.count > 100) {
                            languagesmap[o['_id']] = o.count;
                        }
                    }
                }
            });


    readStream.on('end', () => {
        db.close();
    });
    readStream
        .pipe(es.split())
        .pipe(es.map(function(data, cb){
            if (data && data.length > 1) {
                let o = JSON.parse(data);
                o.language = lib.getLanguage(o.title, o.text);
                if (languagesmap[o.language] > 100) {
                    o.text = getFilteredText(o.text);
                    db.collection('filteredpages').insertOne(o, (err, result) => {
                        if (err) {
                            console.log(err);
                            cb(err);
                        } else {
                            cb(null, data);
                        }
                    });
                } else {
                    cb(null, data);
                }
            } else {
                cb(null, null);
            }
        }));

});
