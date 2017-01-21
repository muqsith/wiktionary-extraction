const fs = require('fs'),
    config = require('config'),
    MongoClient = require('mongodb').MongoClient,
    wikiConnector = require('./lib/wiki-api-connector.js'),
    es = require('event-stream'),
    writeStream = fs.createWriteStream('temp/alltemplates-responses.txt', {encoding:'utf8'})
    ;

let total_docs = 0,
    document_count = 0,
    batch_size = 1000,
    batch_count = 0,
    input = ''
    ;
const fetchTemplateValues = function () {
    MongoClient.connect(config.get('mongodb-url'), (err, db) => {
        let cursor = db.collection('templates').find({}).addCursorFlag('noCursorTimeout', true);

        function processDoc(err, doc) {
            if (err) console.log(err);
            total_docs += 1;
            document_count += 1;
            input += '<muqsith>'+doc.checksum+'</muqsith>'+doc.template;
            if ((document_count > batch_size) || (!doc)) {
                console.log(`Fetching batch: ${batch_count} ...`);
                wikiConnector(input, (err, response) => {
                    document_count = 0;
                    input = '';
                    if (response) {
                        response = response.replace(/(\&lt;)+/g, '<');
                        response = response.replace(/(\&gt;)+/g, '>');
                        response = response.replace(/(<muqsith>)/g,'\n<muqsith>');
                        response = response.replace(/(<\/muqsith>)/g,'</muqsith>\n');
                        writeStream.write(response);
                        batch_count += 1;
                        if (!doc) {
                            console.log(`Total documents processed: ${total_docs} in ${batch_count} batches`);
                            db.close();
                        } else {
                            cursor.nextObject(processDoc);
                        }
                    }
                    if (err) {
                        console.log(err);
                        cursor.nextObject(processDoc);
                    }
                });
                return;
            }
            cursor.nextObject(processDoc);
        }

        cursor.nextObject(processDoc);
    });
};

fetchTemplateValues();
