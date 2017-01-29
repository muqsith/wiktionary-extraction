/*
* This script parses the xml file and
  creates JSON objects of Title and Text and stores them in a file under temp folder.
*/
const fs = require('fs'),
    util = require('util'),
    config = require('config'),
    path = require('path'),
    sax = require('sax'),
    utils = require('./lib/utils.js'),
    promisestatus = require('./lib/promise-status.js')
    ;

// Page class
function Page() {
    let _title = undefined,
        _text = "",
        _language = ""
        ;
    this.setTitle = function(title) {
        _title = title;
    };

    this.getTitle = function() {
        return _title;
    };

    this.setText = function(text) {
        _text = text;
    };

    this.getText = function() {
        return _text;
    };

    this.setLanguage = function(language) {
        _language = language;
    };

    this.getLanguage = function() {
        return _language;
    };

    this.toString = function() {
        let str = '';
        str = JSON.stringify({'title': _title,
            'text': _text, 'language': _language});
        return str;
    };
};

let saveData = undefined;

function getSaxStream(cb) {
    const saxStream = sax.createStream(true, {});
    let currentNodeName = undefined,
        page = undefined
        ;

    saxStream.on("error", function (e) {
        throw e;
    });

    saxStream.on("opentag", function (node) {
        if (node) {
            if (node.name === 'page') {
                page = new Page();
            }
            currentNodeName = node.name;
        }
    });

    saxStream.on("text", function (data) {
        if (page && data) {
            if (currentNodeName === 'title') {
                page.setTitle(data);
            } else if (currentNodeName === 'text') {
                page.setText(data);
                let language = utils.getLanguage(data);
                page.setLanguage(language);
            }
        }
    });

    saxStream.on("closetag", function (node) {
        if (node) {
            if (node === 'page') {
                cb(page);
                page = undefined;
            }
            currentNodeName = undefined;
        }
    });

    return saxStream;
};

const getSaveDataFunction = function(outputJsonFile) {
    const fileWriteStream = fs.createWriteStream(outputJsonFile,
                {encoding:'utf8',autoClose: true});
    return function (obj) {
        fileWriteStream.write(obj.toString()+'\n');
    };
};

const extractWiktionaryPages = function (inputXmlFile, outputJsonFile) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputJsonFile)) {
            try{
                const readStream = fs.createReadStream(inputXmlFile,
                        {encoding:'utf8'});
                let saveObject = getSaveDataFunction(outputJsonFile);
                const saxStream = getSaxStream(saveObject);
                readStream.pipe(saxStream);
                readStream.on('close', () => {
                    resolve({status:promisestatus.success});
                });
            } catch(e) {
                return reject({status: promisestatus.fail, 'error': e});
            }
        } else {
            resolve({status:promisestatus.success});
        }
    });
}

exports = extractWiktionaryPages;

if (require.main === module) {
    extractWiktionaryPages(config.get('xml_file'), 'temp/data.json').then(({status}) => {
        console.log(status);
    }, ({status, error}) => {
        console.log(status, error);
    });
}
