/*
* This script parses the xml file and
  creates JSON objects of Title and Text and stores them in a file under temp folder.
*/
const fs = require('fs'),
    util = require('util'),
    config = require('config'),
    path = require('path'),
    sax = require('sax')
    ;

const fileWriteStream = fs.createWriteStream('temp/data.json', {encoding:'utf8',autoClose: true});

let saxStream = sax.createStream(true, {}),
    captureFlag = false,
    titleTagFlag = false,
    textTagFlag = false,
    pageTagFlag = false,
    pageObject = undefined
    ;

saxStream.on("error", function (e) {
  console.error("error!", e);
});

saxStream.on("opentag", function (node) {
    if (node) {
        if (node.name === 'page') {
            pageTagFlag = true;
            pageObject = {title:'', text:''};
        }
        if (node.name === 'text') {
            textTagFlag = true;
        }
        if(node.name === 'title') {
            titleTagFlag = true;
        }
    }
});

saxStream.on("text", function (data) {
    if (pageTagFlag && data) {
        if (titleTagFlag) {
            pageObject.title = data;
        }
        if (textTagFlag) {
            pageObject.text = data;
        }
    }
});

saxStream.on("closetag", function (node) {
    if (node) {
        if (node === 'page') {
            pageTagFlag = false;
            fileWriteStream.write(JSON.stringify(pageObject)+'\n');
            pageObject = undefined;
        }
        if (node === 'text') {
            textTagFlag = false;
        }
        if(node === 'title') {
            titleTagFlag = false;
        }
    }
});

fs.createReadStream(config.get('xml_file'), {encoding:'utf8'})
     .pipe(saxStream)
;
