const fetchTemplatesValues = require('./fetch-templates-values.js')
    ;

fetchTemplatesValues('temp/missing-templates.json',
    'temp/missing-templates-values.json', 100).then((result) => {
        console.log(`Fetch Missing Templates data: ${result.status}`);
    }, ({status, error}) => {
        console.log('Missing templates: ', status, error);
    });
