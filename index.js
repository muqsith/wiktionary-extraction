const parseXml = require('./parse-xml'),
    createFilteredHeaders = require('./create-filtered-headers.js'),
    createLanguagesMap = require('./create-languages-map.js'),
    createFilteredData = require('./create-filtered-data.js'),
    createTemplatesData = require('./create-templates-data.js'),
    fetchTemplatesValues = require('./fetch-templates-values.js')
    ;

parseXml().then((result) => {
    console.log(`XML Parsing : ${result.status}`);
    createFilteredHeaders().then((result) => {
        console.log(`Filtered headers: ${result.status}`);
        createLanguagesMap().then((result) => {
            console.log(`Languages map: ${result.status}`);
                createFilteredData().then((result) => {
                    console.log(`Filtered data: ${result.status}`);
                    createTemplatesData().then((result) => {
                        console.log(`Extract Templates data: ${result.status}`);
                        fetchTemplatesValues().then((result) => {
                            console.log(`Fetch Templates data: ${result.status}`);
                        }, ({status, error}) => {
                            console.log('Fetch Templates data: ', status, error);
                        });
                    }, ({status, error}) => {
                        console.log('Extract Templates data: ', status, error);
                    });
                }, ({status, error}) => {
                    console.log('Filtered data: ', status, error);
                });
        }, ({status, error}) => {
            console.log('Languages map: ', status, error);
        });
    }, ({status, error}) => {
        console.log('Filtered headers: ', status, error);
    });
}, ({status, error}) => {
    console.log('XML Parsing', status, error);
});
