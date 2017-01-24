
let lib = (function(){
    return ({
        isHeaderLine: function (line) {
            let tl = line.trim();
            return (/^[=].+[=]$/g).test(tl)
        },
        hasOnlyAlphaNumeralsAndSpace: function (text) {
            return (/^[a-z0-9 ]+$/g).test(text);
        },
        getLanguage: function (text) {
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
        },
        getHeaderLevel: function(line) {
            let level = -1;
            if (this.isHeaderLine(line)) {
                level = 0;
                let hl = line.trim();
                for (let c of hl) {
                    if (c === '=') {
                        level += 1;
                    } else {
                        break;
                    }
                }
            }
            return level;
        }
    });
})();

module.exports = lib;
