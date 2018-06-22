const puma = require('pumascript');
const http = require('http');
const fs = require('fs');

let errorsLogs = [];

/**
 * Read a .json file with the dependencies to test pumascript.
 * @param {string} dir - address where the .json file is located.
 * @return {Object} - object with the content of the json file.
 */
function readDependencyJsonFile(dir) {
    let fileContent;
    try {
        fileContent = JSON.parse(fs.readFileSync(dir, 'utf8'));
    } catch (error) {
        console.warn(`The file entered does not exist. ${JSON.stringify(error)}`);
    }
    return fileContent;
}

/**
 * It allows to read the body of a url.
 * @param {object} options - Object that has to contain host and path 
 * of the CDN to which you want to access.
 * @param {fucntion(body)} callback - Function that receives as a parameter the body of the CDN.
 */
function readUrl(options, callback) {
    let req = http.get(options, function (res) {
        let bodyChunks = [];
        res.on('data', function (chunk) {
            bodyChunks.push(chunk);
        }).on('end', function () {
            let body = Buffer.concat(bodyChunks);
            callback(body);
        })
    });
    req.on('error', function (e) {
        console.error(`ERROR [readURL]:  ${e.message}`);
    });
}

/**
 * Create a file.
 * @param {string} dir - Address where the file is created.
 * @param {string} fileName - File name.
 * @param {string} data - Information that is stored in the file.
 */
function createFile(dir, fileName, data) {
    try {
        fs.writeFileSync(`${dir}/${fileName}`, data);
    } catch (error) {
        console.error(`ERROR [createFile]: ${error.message}`);
    }
}

/**
 *Represents an error encountered when testing a CDN against pumascript.
 *@constructs 
 */
function ErrorTestCDN(url) {
    this.url = '' || url;    
    this.listErrors = [];
}
ErrorTestCDN.prototype.addError = function (line, colum, componentGeneratesError) {
    this.listErrors.push({
        line, colum, componentGeneratesError
    })
}

/**
 * Test a CDN in pumascript.
 * @param {string} dataUrl - information contained in the body of the cdn.
 * @param {string} url - Url of the CDN
 */
function testPuma(dataUrl, url) {
    console.info('********** Entering ', url, '****************************');
    let result = puma.evalPuma(dataUrl, 'test');
    let errorTestCDN = new ErrorTestCDN();
    errorTestCDN.listErrors = [];
    if (result.success !== undefined) {
        if (result.success) {
            console.info('++++++++++++++ Successful injection ++++++++++++++++++');
        } else {           
            console.error(`Error when interpreting the file, puma does not support any internal components.
            The error occurred in the line: ${result.pumaAst.loc.end.line}, column: ${result.pumaAst.loc.end.column}
            The component that generates error is the following: ${result.output}`);
            errorTestCDN.url = url;
            errorTestCDN.addError(result.pumaAst.loc.end.line, result.pumaAst.loc.end.column, result.output);
        }
    }
    else {       
        console.error(`Error when interpreting the file, puma does not support any internal components.
        The error occurred in the line: ${result.loc.end.line}, column: ${result.loc.end.column}
        The component that generates error is the following: ${result.name}`);
        errorTestCDN.url = url;
        errorTestCDN.addError(result.loc.end.line, result.loc.end.column, result.name);
    }
    if(errorTestCDN.url){errorsLogs.push(errorTestCDN);}
    console.info('*************************END INJECTION**********************************');
}

/**
 *Perform a set of tests defined in a json 
 *file in pumascript and record the errors 
 *found in a json error file. * 
 * @param {string} dependencyFile - Address of the json file with the CDN.
 * @param {string} [dirOutputFile = .] - Location where you want to save the file with the errors found.
 * @param {string} [nameOutputFile = errorResult] - Name of the json file with the errors.
 */
function testIntegration(dependencyFile, dirOutputFile = '.', nameOutputFile = 'errorResult') {
    let libraryTestList = readDependencyJsonFile(dependencyFile);
    if (libraryTestList) {
        for (let i = 0; i < libraryTestList.length; i++) {
            let aux = libraryTestList[i].url.split('/')
            let host = aux[2];
            let path = `/${aux.slice(3, aux.length).join('/')}`;
            let options = {
                host,
                path
            };
            readUrl(options, (body) => {
                testPuma(`${body}`, `${host}${path}`);
                createFile(dirOutputFile, `${nameOutputFile}.json`, JSON.stringify(errorsLogs, null, 4));
            });
        }//end for  
    }
}

module.exports = {
    testIntegration,
}
