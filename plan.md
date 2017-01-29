#Process 

**The goal of this process is to extract all the wiki-markup documents present in one single en-wiktionary.xml file and create html documents.**

The wiki-markup documents inside the xml dump have two parts.

- Plain wiki-markup that can be easily converted to HTML using a library called `instaview`.
- The other part is wiki-templates. The **templates** are created for the ease of Wiki writers, if writers find any common text that is repeated across documents they tend to create a template for that text and this template is transcluded in documents while rendering. Usually the problem is with templates, because the text to be transcluded not known.

#### Steps:
1. The en-wiktionary.xml file contains xml elements called `page` for each word. The `page` element contains `title` and `text` sub-elements. The `title` element is the word and it's definition, usage notes and translations are present in the `text` element. We parse this file and collect all the `page` elements and create a JSON object for each `page`, this JSON object along with `title` contains `definition` and `language` attributes. All the JSON objects are stored in a file (one object per line) called `data.json`.
2. The `data.json` is further processed, the `definition` of each JSON object in the file is reduced to only contain the required information and also we pickup the documents that has `language` with atleast 100+ words, all of this filtered information is stored in the form of JSON objects in a file called `filtered-data.json`.
3. To carry out `step 2` we need to create two more meta-data files.
	- `filtered-headers.json` this file contains the list of headers that are to be taken from `definitions`. 
	- `languages.json` this file contains the list of languages that has 100+ words in the entire en-wiktionary.xml file.
4. Further we process `filtered-data.json` file to extract all the templates present in each `definition` attribute of JSON object, and we store all these templates in a different file called `templates.json` in the form of JSON objects with attributes `checksum`, `template` and `value`.
5. The `templates.json` file contains millions of lines, each line with a `template` and `value` attribute. The `value` is the transclusion text, but it has to be fetched from `en.wiktionary.org` through URL https://en.wiktionary.org/w/api.php 
6. In order to fetch the `values` of `templates` from URL we need to create batches of templates that can be sent in one request, the optimum number of templates that can be sent in one request is 500 - 1000. If more than 1000 templates are sent in one request then we get `'Lua error'` for most of the templates. This step takes very long time depending on the amount of templates we have, in my case I got more than 10 million  templates and fetching values for all took more than 2 days. The fetched values are stored in the JSON object format in a file called `templates-values.json`. 
7. Now all the JSON objects in `templates-values.json` are loaded into the local [Redis store](https://redis.io). This is done because the lookup while parsing the wiki-markup becomes very fast and this entire step can be done in less than an hour.
8. Parsing of wiki-markup text is done in following steps.
	- First the templates in the wiki-markup are replaced with their checksum values.
	- Next, wiki-markup is converted to HTML using `instaview`.
	- Then the checksum values are replaced with `templates` values.