
let lib = (function(){
    return ({
        isHeaderLine: function (line) {
            let tl = line.trim();
            return (/^[=].+[=]$/g).test(tl)
        },
        hasOnlyAlphabetsAndSpace: function (text) {
            return (/^[a-z ]+$/g).test(text);
        },
        getLanguage: function (title, text) {
            let lang = 'unknown';
            let lines = text.split('\n');
            for(let line of lines) {
                if (this.isHeaderLine(line)){
                    lang = line.replace(/[=]/g,'').trim().toLowerCase();
                    break;
                }
            }
            return lang;
        },
        removeAllHeaderMarkdownSymbols: function (text) {
            let result = text;
            if (text) {
                result = text.trim().replace(/[=]/g,'').trim();
            }
            return result;
        }
    });
})();

module.exports = lib;
