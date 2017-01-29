module.exports = function () {
    'use strict';

    const _begin_token = '{{';
    const _end_token = '}}';

    const getTemplates = function (text) {
        let level = 0,
            data = [],
            previous_level = undefined,
            loops = 0,
            template_indices = {}
            ;

            data[0] = [];
        for (let i=0; i<text.length; i+=1) {

            let start = '' , end = '';
            if (i < text.length) {
                start = ''+text[i]+text[i+1];
            }
            if (i > 0) {
                end = ''+text[i-1]+text[i];
            }

            if (start === _begin_token) {
                level += 1;
                template_indices[i] = 'start';
                i+=1;
            } else if(end === _end_token) {
                level -= 1;
                template_indices[i] = 'end';
                if (text[i+1] !== _begin_token[0]) {
                    i+=1;
                }
            }

            if (level !== 0) {
                let c = text[i];
                if (c !== '\n') {
                    if (data[level] === undefined) {
                        data[level] = [];
                    }
                    for (let j = 0; j < data.length; j+=1) {
                        loops += 1;
                        if ( j <= level ) {
                            if (c+text[i+1] === _end_token) {
                                c = _end_token;
                            }
                            if (text[i-1]+c === _begin_token) {
                                c = _begin_token;
                            }
                            if (j !== level) {
                                data[j] = data[j].concat(c);
                            } else if (data[j][data[j].length-1] !== '\n'){
                                data[j] = data[j].concat('\n');
                            }
                        }
                    }
                }
            } else {
                for (let j = 0; j < data.length; j+=1) {
                    loops += 1;
                    if (data[j][data[j].length-1] !== '\n') {
                        data[j] = data[j].concat('\n');
                    }
                }
            }
        }

        let lines = [];
        let data_lines = data[0].join('').split('\n').filter((l) => {
             if (l.length > 1) {
                 return l;
             }
        });
        lines = lines.concat(data_lines);

        return {level: level, templates: lines, indices: template_indices};
        //return lines;
    };

    return getTemplates;
}();
