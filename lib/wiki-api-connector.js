const request = require('request'),
    fs = require('fs'),
    posturl = 'https://en.wiktionary.org/w/api.php',
    error_file = './temp/response_errors.txt',
    request_timeout = 10 * 60 * 1000// 10 mins
    ;

module.exports = function (input, cb) {
    var options = {
        method: 'POST',
        url: posturl,
        formData: {
            action:'parse',
            format:'json',
            utf8:'1',
            contentmodel:'wikitext',
            text:input
        },
        headers: {
            'User-Agent': 'request'
        },
        timeout: request_timeout
    };
    let starttime = new Date();
    request(options, (error, response, body) => {
        let endtime = new Date();
        console.log('Time ( for one Request <-> Response) : ', ((endtime.getTime() - starttime.getTime())/1000), ' seconds');
        if (!error && response.statusCode == 200) {
            let responseText = JSON.parse(body).parse.text['*'];
            cb(null, responseText);
        } else {
            fs.writeFile(error_file, error+'\n', (err) => {
                if (err) console.log(err);
            });
            cb(error, null);
        }
    });
};
