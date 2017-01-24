const request = require('request'),
    posturl = 'https://en.wiktionary.org/w/api.php',
    request_timeout = 10 * 60 * 1000// 10 mins
    ;
let retry_count = 0,
    max_retry_count = 50
    ;

function wikiConnector(input, cb) {
    let options = {
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
        if (retry_count > 0) {
            console.log(`Attempting re-try: ${retry_count}`);
        }
        console.log('Time taken (for Request <-> Response) : ', ((endtime.getTime() - starttime.getTime())/1000), ' seconds');
        if (!error && response.statusCode == 200) {
            retry_count = 0;
            let responseText = JSON.parse(body).parse.text['*'];
            cb(null, responseText);
        } else {
            retry_count += 1;
            if (retry_count <= max_retry_count) {
                setTimeout(() => {
                    wikiConnector(input, cb);
                }, 5000);
            } else {
                cb(error, null);
            }
        }
    });
};

module.exports = wikiConnector;
