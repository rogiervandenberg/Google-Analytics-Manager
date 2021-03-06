/** Google Analytics Manager
 * Manage your Google Analytics account in batch via a Google Sheet
 *
 * @license GNU LESSER GENERAL PUBLIC LICENSE Version 3
 * @author Rutger Meekers [rutger@meekers.eu]
 * @version 1.0
 * @see {@link http://rutger.meekers.eu/Google-Analytics-Manager/ Project Page}
 *
 * Global Logger, SpreadsheetApp, HtmlService, Analytics
 */

/**
 * Configuration
 ***************
 */

var colors = {
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  primaryLight: '#C8E6C9',
  primaryText: '#FFFFFF',
  accent: '#FFC107',
  text: '#212121',
  textSecondary: '#727272',
  divider: '#B6B6B6'
};

/**
 * Helper functions
 ******************
 */

/**
 * Define the spreadsheet UI
 */
var ui = SpreadsheetApp.getUi();

/**
 * Return the sheet settings
 * @param {array} array
 * @returns {array}
 */
function createApiSheetColumnConfigArray(array) {
    return {
        names: [array.map(function(element) { return element.name; })],
        namesInApi: [array.map(function(element) { return element.nameInApi; })],
        fieldType: [array.map(function(element) { return element.fieldType; })],
        colors: [array.map(function(element) { return element.color || colors.primary; })],
        dataValidation: array.map(function(element) {
            if (element.dataValidation) {
                return element.dataValidation;
            }
            else {
                return;
            }
        }),
        regexValidation: array.map(function(element) { return element.regexValidation; })
    };
}


/**
 * Replace 'undefined' in a given array with another value
 * @param {array} array
 * @param {string} value
 */
function replaceUndefinedInArray(array, value) {
    return array.map(function(el) {
        return el === undefined ? value : el;
    });
}

/**
 * Replace 'null' in a given array with another value
 * @param {array} array
 * @param {string} value
 */
function replaceNullInArray(array, value) {
    return array.map(function(el) {
        return el === null ? value : el;
    });
}

/**
 * Sorts an array of objects
 *
 *  @param {array}      array               - Array of objects
 *  @param {string}     objectParamToSortBy - Name of object parameter to sort by
 *  @param {boolean}    sortAscending       - (optional) Sort ascending (default) or decending
*/
function sortArrayOfObjectsByParam(array, objectParamToSortBy, sortAscending) {

    // default to true
    if(sortAscending === undefined || sortAscending !== false) {
        sortAscending = true;
    }

    if(sortAscending) {
        array.sort(function (a, b) {
            return a[objectParamToSortBy] > b[objectParamToSortBy];
        });
    }
    else {
        array.sort(function (a, b) {
            return a[objectParamToSortBy] < b[objectParamToSortBy];
        });
    }
}

/**
 * Sort a multidimensional array
 *
 * @param {array}   array       - Array or arrays
 * @param {integer} sortIndex   - Array index to sort by
 *
 */
function sortMultidimensionalArray(array, sortIndex) {
    array.sort(sortFunction);

    function sortFunction(array, b) {
        if (array[sortIndex] === b[sortIndex]) {
            return 0;
        }
        else {
            return (array[sortIndex] < b[sortIndex]) ? -1 : 1;
        }
    }
    return array;
}

/**
 * Test if a given parameter is an object
 *
 * @param obj - Object to test
 * @return boolean
 */
function isObject(obj) {
  return obj === Object(obj);
}

/**
 * Helper function to create a new Properties sheet from the menu
 */
function createSheetProperties() {

    var result = ui.alert(
        'Pay attention',
        'If there is already a sheet named \'GAM: Properties\' that sheet will be reinitialized ' +
        '(all content will be cleared), otherwise a new one will be inserted',
            ui.ButtonSet.OK_CANCEL);

    if (result == ui.Button.OK) {
        createSheet('properties');
    }
}

/**
 * Helper function to create a new Views sheet from the menu
 */
function createSheetViews() {

    var result = ui.alert(
        'Pay attention',
        'If there is already a sheet named \'GAM: Views\' that sheet will be reinitialized ' +
        '(all content will be cleared), otherwise a new one will be inserted',
            ui.ButtonSet.OK_CANCEL);

    if (result == ui.Button.OK) {
        createSheet('views');
    }
}

/**
 * Helper function to transpose an array
 * @param {array} a
 * @return {array}
 */
function transposeArray(a)
{
  return a[0].map(function (_, c) { return a.map(function (r) { return r[c]; }); });
}

/**
 * Helper function to define the API Type based on the sheet name
 * @param {string} sheetName
 * @return {string}
 */
function getApiTypeBySheetName(sheetName) {
    // Retrieve API type by looping over the API array
    for (var type in api) {
        if (sheetName == 'GAM: ' + api[type].name) {
            return type;
        }
    }
}

/**
 * Helper function to retrieve the columnIndex based on the column apiName
 * @param {string} apiType
 * @param {string} nameInApi
 * @return {integer}
 */
function getApiColumnIndexByName(apiType, nameInApi) {
    var columns = api[apiType].sheetColumnConfig().namesInApi;
    return columns[0].indexOf(nameInApi) + 1;
}

/**
 * Helper function to retrieve the columnIndexRange for a given apiType based on the fieldType
 * @param {string} apiType
 * @param {string} fieldType
 * @return {object}
 */
function getApiColumnIndexRangeByType(apiType, fieldType) {
    var columns = api[apiType].sheetColumnConfig().fieldType;
    var firstPosition = columns[0].indexOf(fieldType) + 1;
    var lastPosition = columns[0].lastIndexOf(fieldType) + 1;
    return [firstPosition, lastPosition];
}

/**
 * Sheet / Application related functions
 ******************
 */

/**
 * onInstall runs when the script is installed
 * @param {*} e
 */
function onInstall(e) {
    onOpen(e);
}

/**
 * onOpen function runs on application open
 * @param {*} e
 */
function onOpen(e) {
    ui = SpreadsheetApp.getUi();
    return ui
        .createMenu('GA Manager')
        .addItem('Audit GA', 'showSidebar')
        .addItem('Insert / Update Data from active sheet to GA', 'insertData')
        .addSeparator()
        .addSubMenu(ui.createMenu('Advanced')
            .addItem('Insert Properties Sheet', 'createSheetProperties')
            .addItem('Insert Views Sheet', 'createSheetViews'))
        .addToUi();
}

/**
 * Show the sidebar
 */
function showSidebar() {
    var ui = HtmlService
        .createTemplateFromFile('index')
        .evaluate()
        .setTitle('GA Manager')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);

    return SpreadsheetApp
        .getUi()
        .showSidebar(ui);
}

/**
 * Get the available reports from the api
 * @return {array} with available reports
 */
function getReports() {
    var arr = [];
    for (var p in api) {
        var o = {
            name: api[p].name,
            id: p
        };
        arr.push(o);
    }
    return JSON.stringify(arr);
}

/**
 * Save the GA data from the selected report
 * @return {string} account id's
 * @return {string} report
 */
function saveReportDataFromSidebar(data) {
    var parsed = JSON.parse(data);
    return generateReport(parsed.ids, parsed.report);
}

/**
 * Main functions
 ****************
 */

/**
 * Sheet Data
 */

var sheet = {
    /*
     * Initiate Sheet functions and prepare some basic stuff
     * @param {string} type
     * @param {string} name
     * @param {array} config
     * @param {array} data
     */
    init: function(type, name, config, data) {
        this.workbook = SpreadsheetApp.getActiveSpreadsheet();
        this.name = name;
        this.sheetColumnConfig = config;

        switch(type) {
            case 'initSheet':
                this.sheet =
                  this.workbook.getSheetByName(this.name) ||
                  this.workbook.insertSheet(this.name);
                this.headerLength = config.names[0].length;
                this.data = data;
                break;
            case 'validateData':
                this.sheet = this.workbook.getSheetByName(this.name);
                this.regexValidation = config.regexValidation;
                this.data = transposeArray(data);
                break;
        }

        return this;
    },
    /**
     * Validate data in the sheet
     */
    validate: function() {
        // TODO: do something usefull after validation
        // FIXME: return correct row number
        var results = [];

        for (var column = 0; column < this.data.length; column++) {
            var regex = this.regexValidation[column];
            // Only validate a cell if there is a regexValidation defined
            if (regex) {
                for (var row = 0; row < this.data[column].length; row++) {
                    var string = String(this.data[column][row]);
                    if (string.match(regex)) {
                      Logger.log('Validate OK: ' + string);
                    }
                    else {
                      Logger.log('Validate NOK: ' + string);
                      results.push('\nError: data validation failed for value ' + string + 'on row ' + row + ' column ' + column);
                    }
                }
            }
        }

        /*
        if (results.length > 0) {
            ui.alert('Results', results, ui.ButtonSet.OK);
        }
        */
    },

    /*
     * Define the number of columns needed in the sheet and add or remove columns
     */
    setNumberOfColumns: function(cb) {
        var maxColumns = this.sheet.getMaxColumns();
        var numberOfColumnsNeeded = this.headerLength;

        // If there are too many columns, delete additional columns
        if (maxColumns - numberOfColumnsNeeded > 0) {
            this.sheet.deleteColumns(numberOfColumnsNeeded + 1, maxColumns - numberOfColumnsNeeded);
        }
        // If there aren't enough columns, add additional columns
        else if (maxColumns - numberOfColumnsNeeded < 0) {
            this.sheet.insertColumns(this.sheet.getLastColumn(), numberOfColumnsNeeded - maxColumns);
        }

        cb.call(this);
    },

    /**
     * Clear the existing sheet
     */
    clearSheet: function(cb) {
        var range = this.sheet.getRange(1, 1, this.sheet.getMaxRows(), this.sheet.getMaxColumns());
        range
            .clearContent()
            .clearDataValidations()
            .clearFormat()
            .clearNote();

        cb.call(this);
    },

    /**
     * Build the sheet header
     */
    buildHeader: function(cb) {
        var rowHeight = 30;
        var headerRow = this.sheet.setRowHeight(1, rowHeight).getRange(1, 1, 1, this.headerLength);

        // add style header row
        headerRow
            .setBackgrounds(this.sheetColumnConfig.colors)
            .setFontColor(colors.primaryText)
            .setFontSize(12)
            .setFontWeight('bold')
            .setVerticalAlignment('middle')
            .setValues(this.sheetColumnConfig.names);

        // freeze the header row
        this.sheet.setFrozenRows(1);

        cb.call(this);
    },

    /**
     * Set the sheet dataValidation
     */
    buildDataValidation: function(cb) {

        var dataValidationArray = this.sheetColumnConfig.dataValidation;

        // dataValidation should be set per column, so we have to loop over the dataValidationArray
        for (var i = 0; i < dataValidationArray.length; i++) {

            // Only set dataValidation when the config is present for a column
            if (dataValidationArray[i]) {
                var dataRange = this.sheet.getRange(2, i + 1, this.sheet.getMaxRows(), 1);
                dataRule = SpreadsheetApp.newDataValidation()
                            .requireValueInList(dataValidationArray[i], true)
                            .setAllowInvalid(false)
                            .build();

                // add dataValidation to the sheet
                dataRange.setDataValidation(dataRule);
            }
        }

        cb.call(this);
    },

    /**
     * Insert data into the sheet
     */
    insertData: function(cb) {
        var dataRange = this.sheet.getRange(2, 1, this.data.length, this.headerLength);

        dataRange.setValues(this.data);

        cb.call(this);
    },

    /**
     * Cleanup the sheet
     */
    cleanup: function() {
        // auto resize all columns
        this.sheetColumnConfig.names[0].forEach(function(e, i) {
            this.sheet.autoResizeColumn(i + 1);
        }, this);
    },

    /**
     * Build the sheet structure
     */
    buildSheet: function() {
        this.setNumberOfColumns(function() {
            this.clearSheet(function() {
                this.buildHeader(function() {
                    this.buildDataValidation(function() {
                        this.cleanup();
                    });
                });
            });
        });
    },

    /**
     * Build the sheet structure and insert data
     */
    buildData: function() {
        this.setNumberOfColumns(function() {
            this.clearSheet(function() {
                this.buildHeader(function() {
                    this.buildDataValidation(function() {
                        this.insertData(function() {
                            this.cleanup();
                        });
                    });
                });
            });
        });
    },

    validateData: function() {
        this.validate();
    }
};

/**
 * API Data
 */
var api = {
    properties: {
        name: 'Properties',
        init: function(type, cb, options) {
            this.config = this.sheetColumnConfig();

            switch(type) {
                case 'createSheet':
                    break;
                case 'generateReport':
                    this.account = options.accounts;
                    break;
                case 'getConfig':
                    break;
                case 'insertData':
                    break;
            }

            cb();

            return this;
        },
        /**
         * Column and field related config properties
         */
        sheetColumnConfig: function() {
            var data = [
                {
                    name: 'Include',
                    nameInApi: 'include',
                    fieldType: 'system',
                    dataValidation: [
                        'Yes',
                        'No'
                    ]
                },{
                    name: 'Account Name',
                    nameInApi: 'accountName',
                    fieldType: 'account',
                },{
                    name: 'Account ID',
                    nameInApi: 'accountId',
                    fieldType: 'account',
                },{
                    name: 'Name',
                    nameInApi: 'name',
                    fieldType: 'property',
                    regexValidation: /.*\S.*/
                },{
                    name: 'ID',
                    nameInApi: 'id',
                    fieldType: 'property',
                    regexValidation: /(UA|YT|MO)-\d+-\d+/
                },{
                    name: 'Industry',
                    nameInApi: 'industryVertical',
                    fieldType: 'property',
                    dataValidation: [
                        'UNSPECIFIED',
                        'ARTS_AND_ENTERTAINMENT',
                        'AUTOMOTIVE',
                        'BEAUTY_AND_FITNESS',
                        'BOOKS_AND_LITERATURE',
                        'BUSINESS_AND_INDUSTRIAL_MARKETS',
                        'COMPUTERS_AND_ELECTRONICS',
                        'FINANCE',
                        'FOOD_AND_DRINK',
                        'GAMES',
                        'HEALTHCARE',
                        'HOBBIES_AND_LEISURE',
                        'HOME_AND_GARDEN',
                        'INTERNET_AND_TELECOM',
                        'JOBS_AND_EDUCATION',
                        'LAW_AND_GOVERNMENT',
                        'NEWS',
                        'ONLINE_COMMUNITIES',
                        'OTHER',
                        'PEOPLE_AND_SOCIETY',
                        'PETS_AND_ANIMALS',
                        'REAL_ESTATE',
                        'REFERENCE',
                        'SCIENCE',
                        'SHOPPING',
                        'SPORTS',
                        'TRAVEL'
                    ],
                    regexValidation: /.*\S.*/
                },{
                    name: 'Default View ID',
                    nameInApi: 'defaultProfileId',
                    fieldType: 'property',
                },{
                    name: 'Starred',
                    nameInApi: 'starred',
                    fieldType: 'property',
                    dataValidation: [
                        'TRUE',
                        'FALSE'
                    ]
                },{
                    name: 'Website URL',
                    nameInApi: 'websiteUrl',
                    fieldType: 'property',
                    regexValidation: /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i
                }
            ];
            return createApiSheetColumnConfigArray(data);
        },
        listApiData: function(account, cb) {
            //TODO: add try catch
            var propertiesList = Analytics.Management.Webproperties.list(account).getItems();

            if (typeof cb === 'function') {
                return cb.call(this, propertiesList);
            }
            else {
                return propertiesList;
            }
        },
        getApiData: function(account, id, cb) {
            var result;

            try {
                result = Analytics.Management.Webproperties.get(account, id);
            }
            catch (e) {
                result = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        insertApiData: function(
            accountId,
            name,
            industryVertical,
            starred,
            websiteUrl,
            cb
        ) {
            var values = {};
            if (name) {values.name = name;}
            if (industryVertical) {values.industryVertical = industryVertical;}
            if (starred) {values.starred = starred;}
            if (websiteUrl) {values.websiteUrl = websiteUrl;}
            var result = {};

            try {
                result.call = Analytics.Management.Webproperties.insert(values, accountId);
                if (isObject(result)) {
                    result.status = 'Success';
                    var insertedData = [
                        result.call.name,
                        result.call.id,
                        result.call.industryVertical,
                        result.call.defaultProfileId,
                        result.call.starred,
                        result.call.websiteUrl
                    ];
                    insertedData = replaceUndefinedInArray(insertedData, '');
                    insertedData = replaceNullInArray(insertedData, '');
                    result.insertedData = [insertedData];
                    //TODO: defining the type should be improved (not hardcoded?)
                    result.insertedDataType = 'property';
                    result.message = 'Success: ' + name + ' (' + result.call.id + ') has been inserted';
                }
            }
            catch(e) {
                result.status = 'Fail';
                result.message = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        updateApiData: function(
            accountId,
            name,
            id,
            industryVertical,
            defaultProfileId,
            starred,
            websiteUrl,
            cb
        ) {
            var values = {};
            if (name) {values.name = name;}
            if (industryVertical) {values.industryVertical = industryVertical;}
            if (defaultProfileId) {values.defaultProfileId = defaultProfileId;}
            if (starred) {values.starred = starred;}
            if (websiteUrl) {values.websiteUrl = websiteUrl;}

            var result = {};

            try {
                result.call = Analytics.Management.Webproperties.update(values, accountId, id);
                if (isObject(result.call)) {
                    result.status = 'Success';
                    result.message = 'Success: ' + name + ' (' + id + ') has been updated';
                }
            }
            catch (e) {
                result.status = 'Fail';
                result.message = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        getData: function(cb) {
            var results = [];

            this.account.forEach(function(account) {
                this.listApiData(account.id, function(propertiesList) {
                    propertiesList.forEach(function(property) {
                        var defaults = [
                            '',
                            account.name,
                            account.id,
                            property.name,
                            property.id,
                            property.industryVertical,
                            property.defaultProfileId,
                            property.starred,
                            property.websiteUrl
                        ];
                        defaults = replaceUndefinedInArray(defaults, '');

                        results.push(defaults);
                        }, this);
                });
            }, this);

            cb(results);
        },
        insertData: function(insertData) {

            var accountId = insertData[2];
            var name = insertData[3];
            var id = insertData[4];
            var industryVertical = insertData[5];
            var defaultProfileId = insertData[6];
            var starred = insertData[7];
            var websiteUrl = insertData[8];
            var existingPropertyId = this.getApiData(accountId, id).id;
            var result = {};

            if(!id) {
                return this.insertApiData(
                    accountId,
                    name,
                    industryVertical,
                    starred,
                    websiteUrl
                );
            }
            else if(id == existingPropertyId) {
                return this.updateApiData(
                  accountId,
                  name,
                  id,
                  industryVertical,
                  defaultProfileId,
                  starred,
                  websiteUrl
                );
            }
            else if(id != existingPropertyId) {
                result.status = 'Fail';
                result.message = 'Property does not exist. Please verify Account and/or Property ID';
                return result;
            }
        },
    },
    views: {
        name: 'Views',
        init: function(type, cb, options) {
            this.config = this.sheetColumnConfig();

            switch(type) {
                case 'createSheet':
                    break;
                case 'generateReport':
                    this.account = options.accounts;
                    break;
                case 'getConfig':
                    break;
                case 'insertData':
                    break;
            }

            cb();

            return this;
        },
        /**
         * Column and field related config properties
         */
        sheetColumnConfig: function() {
            var data = [
                {
                    name: 'Include',
                    nameInApi: 'include',
                    fieldType: 'system',
                    dataValidation: [
                        'Yes',
                        'No'
                    ]
                },{
                    name: 'Account Name',
                    nameInApi: 'accountName',
                    fieldType: 'account',
                },{
                    name: 'Account ID',
                    nameInApi: 'accountId',
                    fieldType: 'account',
                },{
                    name: 'Property Name',
                    nameInApi: 'propertyName',
                    fieldType: 'property',
                },{
                    name: 'Property ID',
                    nameInApi: 'webPropertyId',
                    fieldType: 'property',
                    regexValidation: /(UA|YT|MO)-\d+-\d+/
                },{
                    name: 'Name',
                    nameInApi: 'name',
                    fieldType: 'view',
                },{
                    name: 'ID',
                    nameInApi: 'id',
                    fieldType: 'view',
                },{
                    name: 'Bot Filtering Enabled',
                    nameInApi: 'botFilteringEnabled',
                    fieldType: 'view',
                    dataValidation: [
                        'TRUE',
                        'FALSE'
                    ]
                },{
                    name: 'Currency',
                    nameInApi: 'currency',
                    fieldType: 'view',
                    dataValidation: [
                        'ARS',
                        'AUD',
                        'BGN',
                        'BRL',
                        'CAD',
                        'CHF',
                        'CNY',
                        'CZK',
                        'DKK',
                        'EUR',
                        'GBP',
                        'HKD',
                        'HUF',
                        'IDR',
                        'INR',
                        'JPY',
                        'KRW',
                        'LTL',
                        'MXN',
                        'NOK',
                        'NZD',
                        'PHP',
                        'PLN',
                        'RUB',
                        'SEK',
                        'THB',
                        'TRY',
                        'TWD',
                        'USD',
                        'VND',
                        'ZAR'
                    ],
                    regexValidation: /.*\S.*/
                },{
                    name: 'eCommerce Tracking',
                    nameInApi: 'eCommerceTracking',
                    fieldType: 'view',
                    dataValidation: [
                        'TRUE',
                        'FALSE'
                    ]
                },{
                    name: 'Exclude Query Params',
                    nameInApi: 'excludeQueryParameters',
                    fieldType: 'view',
                },{
                    name: 'Site Search Category Params',
                    nameInApi: 'siteSearchCategoryParameters',
                    fieldType: 'view',
                },{
                    name: 'Site Search Query Params',
                    nameInApi: 'siteSearchQueryParameters',
                    fieldType: 'view',
                },{
                    name: 'Strip Site Search Category Params',
                    nameInApi: 'stripSiteSearchCategoryParameters',
                    fieldType: 'view',
                    dataValidation: [
                        'TRUE',
                        'FALSE'
                    ]
                },{
                    name: 'Strip Site Search Query Params',
                    nameInApi: 'stripSiteSearchQueryParameters',
                    fieldType: 'view',
                    dataValidation: [
                        'TRUE',
                        'FALSE'
                    ]
                },{
                    name: 'Timezone',
                    nameInApi: 'timezone',
                    fieldType: 'view',
                    dataValidation: [
                        'Africa/Abidjan',
                        'Africa/Accra',
                        'Africa/Addis_Ababa',
                        'Africa/Algiers',
                        'Africa/Asmara',
                        'Africa/Bamako',
                        'Africa/Bangui',
                        'Africa/Banjul',
                        'Africa/Bissau',
                        'Africa/Blantyre',
                        'Africa/Brazzaville',
                        'Africa/Bujumbura',
                        'Africa/Cairo',
                        'Africa/Casablanca',
                        'Africa/Ceuta',
                        'Africa/Conakry',
                        'Africa/Dakar',
                        'Africa/Dar_es_Salaam',
                        'Africa/Djibouti',
                        'Africa/Douala',
                        'Africa/El_Aaiun',
                        'Africa/Freetown',
                        'Africa/Gaborone',
                        'Africa/Harare',
                        'Africa/Johannesburg',
                        'Africa/Juba',
                        'Africa/Kampala',
                        'Africa/Khartoum',
                        'Africa/Kigali',
                        'Africa/Kinshasa',
                        'Africa/Lagos',
                        'Africa/Libreville',
                        'Africa/Lome',
                        'Africa/Luanda',
                        'Africa/Lubumbashi',
                        'Africa/Lusaka',
                        'Africa/Malabo',
                        'Africa/Maputo',
                        'Africa/Maseru',
                        'Africa/Mbabane',
                        'Africa/Mogadishu',
                        'Africa/Monrovia',
                        'Africa/Nairobi',
                        'Africa/Ndjamena',
                        'Africa/Niamey',
                        'Africa/Nouakchott',
                        'Africa/Ouagadougou',
                        'Africa/Porto-Novo',
                        'Africa/Sao_Tome',
                        'Africa/Tripoli',
                        'Africa/Tunis',
                        'Africa/Windhoek',
                        'America/Adak',
                        'America/Anchorage',
                        'America/Anguilla',
                        'America/Antigua',
                        'America/Araguaina',
                        'America/Argentina/Buenos_Aires',
                        'America/Argentina/Catamarca',
                        'America/Argentina/Cordoba',
                        'America/Argentina/Jujuy',
                        'America/Argentina/La_Rioja',
                        'America/Argentina/Mendoza',
                        'America/Argentina/Rio_Gallegos',
                        'America/Argentina/Salta',
                        'America/Argentina/San_Juan',
                        'America/Argentina/San_Luis',
                        'America/Argentina/Tucuman',
                        'America/Argentina/Ushuaia',
                        'America/Aruba',
                        'America/Asuncion',
                        'America/Atikokan',
                        'America/Bahia',
                        'America/Bahia_Banderas',
                        'America/Barbados',
                        'America/Belem',
                        'America/Belize',
                        'America/Blanc-Sablon',
                        'America/Boa_Vista',
                        'America/Bogota',
                        'America/Boise',
                        'America/Cambridge_Bay',
                        'America/Campo_Grande',
                        'America/Cancun',
                        'America/Caracas',
                        'America/Cayenne',
                        'America/Cayman',
                        'America/Chicago',
                        'America/Chihuahua',
                        'America/Costa_Rica',
                        'America/Creston',
                        'America/Cuiaba',
                        'America/Curacao',
                        'America/Danmarkshavn',
                        'America/Dawson',
                        'America/Dawson_Creek',
                        'America/Denver',
                        'America/Detroit',
                        'America/Dominica',
                        'America/Edmonton',
                        'America/Eirunepe',
                        'America/El_Salvador',
                        'America/Fort_Nelson',
                        'America/Fortaleza',
                        'America/Glace_Bay',
                        'America/Godthab',
                        'America/Goose_Bay',
                        'America/Grand_Turk',
                        'America/Grenada',
                        'America/Guadeloupe',
                        'America/Guatemala',
                        'America/Guayaquil',
                        'America/Guyana',
                        'America/Halifax',
                        'America/Havana',
                        'America/Hermosillo',
                        'America/Indiana/Indianapolis',
                        'America/Indiana/Knox',
                        'America/Indiana/Marengo',
                        'America/Indiana/Petersburg',
                        'America/Indiana/Tell_City',
                        'America/Indiana/Vevay',
                        'America/Indiana/Vincennes',
                        'America/Indiana/Winamac',
                        'America/Inuvik',
                        'America/Iqaluit',
                        'America/Jamaica',
                        'America/Juneau',
                        'America/Kentucky/Louisville',
                        'America/Kentucky/Monticello',
                        'America/Kralendijk',
                        'America/La_Paz',
                        'America/Lima',
                        'America/Los_Angeles',
                        'America/Lower_Princes',
                        'America/Maceio',
                        'America/Managua',
                        'America/Manaus',
                        'America/Marigot',
                        'America/Martinique',
                        'America/Matamoros',
                        'America/Mazatlan',
                        'America/Menominee',
                        'America/Merida',
                        'America/Metlakatla',
                        'America/Mexico_City',
                        'America/Miquelon',
                        'America/Moncton',
                        'America/Monterrey',
                        'America/Montevideo',
                        'America/Montserrat',
                        'America/Nassau',
                        'America/New_York',
                        'America/Nipigon',
                        'America/Nome',
                        'America/Noronha',
                        'America/North_Dakota/Beulah',
                        'America/North_Dakota/Center',
                        'America/North_Dakota/New_Salem',
                        'America/Ojinaga',
                        'America/Panama',
                        'America/Pangnirtung',
                        'America/Paramaribo',
                        'America/Phoenix',
                        'America/Port_of_Spain',
                        'America/Port-au-Prince',
                        'America/Porto_Velho',
                        'America/Puerto_Rico',
                        'America/Rainy_River',
                        'America/Rankin_Inlet',
                        'America/Recife',
                        'America/Regina',
                        'America/Resolute',
                        'America/Rio_Branco',
                        'America/Santa_Isabel',
                        'America/Santarem',
                        'America/Santiago',
                        'America/Santo_Domingo',
                        'America/Sao_Paulo',
                        'America/Scoresbysund',
                        'America/Sitka',
                        'America/St_Barthelemy',
                        'America/St_Johns',
                        'America/St_Kitts',
                        'America/St_Lucia',
                        'America/St_Thomas',
                        'America/St_Vincent',
                        'America/Swift_Current',
                        'America/Tegucigalpa',
                        'America/Thule',
                        'America/Thunder_Bay',
                        'America/Tijuana',
                        'America/Toronto',
                        'America/Tortola',
                        'America/Vancouver',
                        'America/Whitehorse',
                        'America/Winnipeg',
                        'America/Yakutat',
                        'America/Yellowknife',
                        'Antarctica/Casey',
                        'Antarctica/Davis',
                        'Antarctica/DumontDUrville',
                        'Antarctica/Macquarie',
                        'Antarctica/Mawson',
                        'Antarctica/McMurdo',
                        'Antarctica/Palmer',
                        'Antarctica/Rothera',
                        'Antarctica/Syowa',
                        'Antarctica/Troll',
                        'Antarctica/Vostok',
                        'Arctic/Longyearbyen',
                        'Asia/Aden',
                        'Asia/Almaty',
                        'Asia/Amman',
                        'Asia/Anadyr',
                        'Asia/Aqtau',
                        'Asia/Aqtobe',
                        'Asia/Ashgabat',
                        'Asia/Baghdad',
                        'Asia/Bahrain',
                        'Asia/Baku',
                        'Asia/Bangkok',
                        'Asia/Beirut',
                        'Asia/Bishkek',
                        'Asia/Brunei',
                        'Asia/Chita',
                        'Asia/Choibalsan',
                        'Asia/Colombo',
                        'Asia/Damascus',
                        'Asia/Dhaka',
                        'Asia/Dili',
                        'Asia/Dubai',
                        'Asia/Dushanbe',
                        'Asia/Gaza',
                        'Asia/Hebron',
                        'Asia/Ho_Chi_Minh',
                        'Asia/Hong_Kong',
                        'Asia/Hovd',
                        'Asia/Irkutsk',
                        'Asia/Jakarta',
                        'Asia/Jayapura',
                        'Asia/Jerusalem',
                        'Asia/Kabul',
                        'Asia/Kamchatka',
                        'Asia/Karachi',
                        'Asia/Kathmandu',
                        'Asia/Khandyga',
                        'Asia/Kolkata',
                        'Asia/Krasnoyarsk',
                        'Asia/Kuala_Lumpur',
                        'Asia/Kuching',
                        'Asia/Kuwait',
                        'Asia/Macau',
                        'Asia/Magadan',
                        'Asia/Makassar',
                        'Asia/Manila',
                        'Asia/Muscat',
                        'Asia/Nicosia',
                        'Asia/Novokuznetsk',
                        'Asia/Novosibirsk',
                        'Asia/Omsk',
                        'Asia/Oral',
                        'Asia/Phnom_Penh',
                        'Asia/Pontianak',
                        'Asia/Pyongyang',
                        'Asia/Qatar',
                        'Asia/Qyzylorda',
                        'Asia/Rangoon',
                        'Asia/Riyadh',
                        'Asia/Sakhalin',
                        'Asia/Samarkand',
                        'Asia/Seoul',
                        'Asia/Shanghai',
                        'Asia/Singapore',
                        'Asia/Srednekolymsk',
                        'Asia/Taipei',
                        'Asia/Tashkent',
                        'Asia/Tbilisi',
                        'Asia/Tehran',
                        'Asia/Thimphu',
                        'Asia/Tokyo',
                        'Asia/Ulaanbaatar',
                        'Asia/Urumqi',
                        'Asia/Ust-Nera',
                        'Asia/Vientiane',
                        'Asia/Vladivostok',
                        'Asia/Yakutsk',
                        'Asia/Yekaterinburg',
                        'Asia/Yerevan',
                        'Atlantic/Azores',
                        'Atlantic/Bermuda',
                        'Atlantic/Canary',
                        'Atlantic/Cape_Verde',
                        'Atlantic/Faroe',
                        'Atlantic/Madeira',
                        'Atlantic/Reykjavik',
                        'Atlantic/South_Georgia',
                        'Atlantic/St_Helena',
                        'Atlantic/Stanley',
                        'Australia/Adelaide',
                        'Australia/Brisbane',
                        'Australia/Broken_Hill',
                        'Australia/Currie',
                        'Australia/Darwin',
                        'Australia/Eucla',
                        'Australia/Hobart',
                        'Australia/Lindeman',
                        'Australia/Lord_Howe',
                        'Australia/Melbourne',
                        'Australia/Perth',
                        'Australia/Sydney',
                        'Europe/Amsterdam',
                        'Europe/Andorra',
                        'Europe/Athens',
                        'Europe/Belgrade',
                        'Europe/Berlin',
                        'Europe/Bratislava',
                        'Europe/Brussels',
                        'Europe/Bucharest',
                        'Europe/Budapest',
                        'Europe/Busingen',
                        'Europe/Chisinau',
                        'Europe/Copenhagen',
                        'Europe/Dublin',
                        'Europe/Gibraltar',
                        'Europe/Guernsey',
                        'Europe/Helsinki',
                        'Europe/Isle_of_Man',
                        'Europe/Istanbul',
                        'Europe/Jersey',
                        'Europe/Kaliningrad',
                        'Europe/Kiev',
                        'Europe/Lisbon',
                        'Europe/Ljubljana',
                        'Europe/London',
                        'Europe/Luxembourg',
                        'Europe/Madrid',
                        'Europe/Malta',
                        'Europe/Mariehamn',
                        'Europe/Minsk',
                        'Europe/Monaco',
                        'Europe/Moscow',
                        'Europe/Oslo',
                        'Europe/Paris',
                        'Europe/Podgorica',
                        'Europe/Prague',
                        'Europe/Riga',
                        'Europe/Rome',
                        'Europe/Samara',
                        'Europe/San_Marino',
                        'Europe/Sarajevo',
                        'Europe/Simferopol',
                        'Europe/Skopje',
                        'Europe/Sofia',
                        'Europe/Stockholm',
                        'Europe/Tallinn',
                        'Europe/Tirane',
                        'Europe/Uzhgorod',
                        'Europe/Vaduz',
                        'Europe/Vatican',
                        'Europe/Vienna',
                        'Europe/Vilnius',
                        'Europe/Volgograd',
                        'Europe/Warsaw',
                        'Europe/Zagreb',
                        'Europe/Zaporozhye',
                        'Europe/Zurich',
                        'Indian/Antananarivo',
                        'Indian/Chagos',
                        'Indian/Christmas',
                        'Indian/Cocos',
                        'Indian/Comoro',
                        'Indian/Kerguelen',
                        'Indian/Mahe',
                        'Indian/Maldives',
                        'Indian/Mauritius',
                        'Indian/Mayotte',
                        'Indian/Reunion',
                        'Pacific/Apia',
                        'Pacific/Auckland',
                        'Pacific/Bougainville',
                        'Pacific/Chatham',
                        'Pacific/Chuuk',
                        'Pacific/Easter',
                        'Pacific/Efate',
                        'Pacific/Enderbury',
                        'Pacific/Fakaofo',
                        'Pacific/Fiji',
                        'Pacific/Funafuti',
                        'Pacific/Galapagos',
                        'Pacific/Gambier',
                        'Pacific/Guadalcanal',
                        'Pacific/Guam',
                        'Pacific/Honolulu',
                        'Pacific/Johnston',
                        'Pacific/Kiritimati',
                        'Pacific/Kosrae',
                        'Pacific/Kwajalein',
                        'Pacific/Majuro',
                        'Pacific/Marquesas',
                        'Pacific/Midway',
                        'Pacific/Nauru',
                        'Pacific/Niue',
                        'Pacific/Norfolk',
                        'Pacific/Noumea',
                        'Pacific/Pago_Pago',
                        'Pacific/Palau',
                        'Pacific/Pitcairn',
                        'Pacific/Pohnpei',
                        'Pacific/Port_Moresby',
                        'Pacific/Rarotonga',
                        'Pacific/Saipan',
                        'Pacific/Tahiti',
                        'Pacific/Tarawa',
                        'Pacific/Tongatapu',
                        'Pacific/Wake',
                        'Pacific/Wallis'
                    ],
                    regexValidation: /.*\S.*/
                },{
                    name: 'Type',
                    nameInApi: 'type',
                    fieldType: 'view',
                    dataValidation: [
                        'WEB',
                        'APP'
                    ],
                    regexValidation: /.*\S.*/
                },{
                    name: 'Website URL',
                    nameInApi: 'websiteUrl',
                    fieldType: 'view',
                    regexValidation: /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i
                }
            ];
            return createApiSheetColumnConfigArray(data);
        },
        listApiData: function(account, property, cb) {
            //TODO: add try catch
            var viewsList = Analytics.Management.Profiles.list(account, property).getItems();

            if (typeof cb === 'function') {
                return cb.call(this, viewsList);
            }
            else {
                return viewsList;
            }
        },
        getApiData: function(account, property, id, cb) {
            var result;

            try {
                result = Analytics.Management.Profiles.get(account, property, id);
            }
            catch (e) {
                result = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        insertApiData: function(
            accountId,
            propertyId,
            name,
            botFilteringEnabled,
            currency,
            eCommerceTracking,
            excludeQueryParameters,
            siteSearchCategoryParameters,
            siteSearchQueryParameters,
            stripSiteSearchCategoryParameters,
            stripSiteSearchQueryParameters,
            timezone,
            type,
            websiteUrl,
            cb
        ) {
            var values = {};
            if (name) {values.name = name;}
            if (botFilteringEnabled) {values.botFilteringEnabled = botFilteringEnabled;}
            if (currency) {values.currency = currency;}
            if (eCommerceTracking) {values.eCommerceTracking = eCommerceTracking;}
            if (excludeQueryParameters) {values.excludeQueryParameters = excludeQueryParameters;}
            if (siteSearchCategoryParameters) {values.siteSearchCategoryParameters = siteSearchCategoryParameters;}
            if (siteSearchQueryParameters) {values.siteSearchQueryParameters = siteSearchQueryParameters;}
            if (stripSiteSearchCategoryParameters) {values.stripSiteSearchCategoryParameters = stripSiteSearchCategoryParameters;}
            if (stripSiteSearchQueryParameters) {values.stripSiteSearchQueryParameters = stripSiteSearchQueryParameters;}
            if (timezone) {values.timezone = timezone;}
            if (type) {values.type = type;}
            if (websiteUrl) {values.websiteUrl = websiteUrl;}
            var result = {};

            try {
                result.call = Analytics.Management.Profiles.insert(values, accountId, propertyId);
                if (isObject(result)) {
                    result.status = 'Success';
                    var insertedData = [
                        result.call.name,
                        result.call.id,
                        result.call.botFilteringEnabled,
                        result.call.currency,
                        result.call.eCommerceTracking,
                        result.call.excludeQueryParameters,
                        result.call.siteSearchCategoryParameters,
                        result.call.siteSearchQueryParameters,
                        result.call.stripSiteSearchCategoryParameters,
                        result.call.stripSiteSearchQueryParameters,
                        result.call.timezone,
                        result.call.type,
                        result.call.websiteUrl
                    ];
                    insertedData = replaceUndefinedInArray(insertedData, '');
                    insertedData = replaceNullInArray(insertedData, '');
                    result.insertedData = [insertedData];
                    //TODO: defining the type should be improved (not hardcoded?)
                    result.insertedDataType = 'view';
                    result.message = 'Success: ' + name + ' (' + result.call.id + ') from ' + propertyId + ' has been inserted';
                }
            }
            catch(e) {
                result.status = 'Fail';
                result.message = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        updateApiData: function(
            accountId,
            propertyId,
            name,
            viewId,
            botFilteringEnabled,
            currency,
            eCommerceTracking,
            excludeQueryParameters,
            siteSearchCategoryParameters,
            siteSearchQueryParameters,
            stripSiteSearchCategoryParameters,
            stripSiteSearchQueryParameters,
            timezone,
            type,
            websiteUrl,
            cb
        ) {
            var values = {};
            if (name) {values.name = name;}
            if (botFilteringEnabled) {values.botFilteringEnabled = botFilteringEnabled;}
            if (currency) {values.currency = currency;}
            if (eCommerceTracking) {values.eCommerceTracking = eCommerceTracking;}
            if (excludeQueryParameters) {values.excludeQueryParameters = excludeQueryParameters;}
            if (siteSearchCategoryParameters) {values.siteSearchCategoryParameters = siteSearchCategoryParameters;}
            if (siteSearchQueryParameters) {values.siteSearchQueryParameters = siteSearchQueryParameters;}
            if (stripSiteSearchCategoryParameters) {values.stripSiteSearchCategoryParameters = stripSiteSearchCategoryParameters;}
            if (stripSiteSearchQueryParameters) {values.stripSiteSearchQueryParameters = stripSiteSearchQueryParameters;}
            if (timezone) {values.timezone = timezone;}
            if (type) {values.type = type;}
            if (websiteUrl) {values.websiteUrl = websiteUrl;}

            var result = {};

            try {
                result.call = Analytics.Management.Profiles.update(values, accountId, propertyId, viewId);
                if (isObject(result.call)) {
                    result.status = 'Success';
                    result.message = 'Success: ' + name + ' (' + viewId + ') from ' + propertyId + ' has been updated';
                }
            }
            catch (e) {
                result.status = 'Fail';
                result.message = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        getData: function(cb) {
            var results = [];

            this.account.forEach(function(account) {
                account.webProperties.forEach(function(property) {
                    this.listApiData(account.id, property.id, function(viewsList) {
                        viewsList.forEach(function(view) {
                            var defaults = [
                                '',
                                account.name,
                                account.id,
                                property.name,
                                property.id,
                                view.name,
                                view.id,
                                view.botFilteringEnabled,
                                view.currency,
                                view.eCommerceTracking,
                                view.excludeQueryParameters,
                                view.siteSearchCategoryParameters,
                                view.siteSearchQueryParameters,
                                view.stripSiteSearchCategoryParameters,
                                view.stripSiteSearchQueryParameters,
                                view.timezone,
                                view.type,
                                view.websiteUrl
                            ];
                            defaults = replaceUndefinedInArray(defaults, '');

                            results.push(defaults);
                        }, this);
                    });
                }, this);
            }, this);

            cb(results);
        },
        insertData: function(insertData) {

            var accountId = insertData[2];
            var propertyId = insertData[4];
            var name = insertData[5];
            var viewId = insertData[6];
            var botFilteringEnabled = insertData[7];
            var currency = insertData[8];
            var eCommerceTracking = insertData[9];
            var excludeQueryParameters = insertData[10];
            var siteSearchCategoryParameters = insertData[11];
            var siteSearchQueryParameters = insertData[12];
            var stripSiteSearchCategoryParameters = insertData[13];
            var stripSiteSearchQueryParameters = insertData[14];
            var timezone = insertData[15];
            var type = insertData[16];
            var websiteUrl = insertData[17];
            var existingViewId = this.getApiData(accountId, propertyId, viewId).id;
            var result = {};

            if(!viewId) {
                return this.insertApiData(
                    accountId,
                    propertyId,
                    name,
                    botFilteringEnabled,
                    currency,
                    eCommerceTracking,
                    excludeQueryParameters,
                    siteSearchCategoryParameters,
                    siteSearchQueryParameters,
                    stripSiteSearchCategoryParameters,
                    stripSiteSearchQueryParameters,
                    timezone,
                    type,
                    websiteUrl
                );
            }
            else if(viewId == existingViewId) {
                return this.updateApiData(
                    accountId,
                    propertyId,
                    name,
                    viewId,
                    botFilteringEnabled,
                    currency,
                    eCommerceTracking,
                    excludeQueryParameters,
                    siteSearchCategoryParameters,
                    siteSearchQueryParameters,
                    stripSiteSearchCategoryParameters,
                    stripSiteSearchQueryParameters,
                    timezone,
                    type,
                    websiteUrl
                );
            }
            else if(viewId != existingViewId) {
                result.status = 'Fail';
                result.message = 'View does not exist. Please verify Account, Property and/or View ID';
                return result;
            }
        },
    },
    filterLinks: {
        name: 'Filter Links',
        init: function(type, cb, options) {
            this.config = this.sheetColumnConfig();

            switch(type) {
                case 'createSheet':
                    break;
                case 'generateReport':
                    this.account = options.accounts;
                    break;
                case 'getConfig':
                    break;
                case 'insertData':
                    break;
            }

            cb();

            return this;
        },
        /**
         * Column and field related config properties
         */
        sheetColumnConfig: function() {
            var data = [
                {
                    name: 'Include',
                    nameInApi: 'include',
                    fieldType: 'system',
                    dataValidation: [
                        'Yes',
                        'No'
                    ]
                },{
                    name: 'Account Name',
                    nameInApi: 'accountName',
                    fieldType: 'account',
                },{
                    name: 'Account ID',
                    nameInApi: 'profileRefAccountId',
                    fieldType: 'account',
                },{
                    name: 'Property Name',
                    nameInApi: 'profileRefWebPropertyName',
                    fieldType: 'property',
                },{
                    name: 'Property Id',
                    nameInApi: 'profileRefWebPropertyId',
                    fieldType: 'property',
                    regexValidation: /(UA|YT|MO)-\d+-\d+/
                },{
                    name: 'View Name',
                    nameInApi: 'profileRefName',
                    fieldType: 'view',
                },{
                    name: 'Name',
                    nameInApi: 'name',
                    fieldType: 'filterLink',
                },{
                    name: 'ID',
                    nameInApi: 'id',
                    fieldType: 'filterLink',
                    regexValidation: /^[0-9]+$/
                }
            ];
            return createApiSheetColumnConfigArray(data);
        },
        requestData: function(account, property, view, cb) {
            var flList = Analytics.Management.ProfileFilterLinks.list(account, property, view).getItems();
            return cb.call(this, flList);
        },
        getData: function(cb) {
            var results = [];

            this.account.forEach(function(account) {
                account.webProperties.forEach(function(property) {
                    property.profiles.forEach(function(view) {
                        this.requestData(account.id, property.id, view.id, function(flList) {
                            flList.forEach(function(fl) {
                                var defaults = [
                                    '',
                                    account.name,
                                    account.id,
                                    property.name,
                                    property.id,
                                    view.name,
                                    fl.filterRef.name,
                                    fl.filterRef.id
                                ];
                                defaults = replaceUndefinedInArray(defaults, '');

                                results.push(defaults);
                            }, this);
                        });
                    }, this);
                }, this);
            }, this);

            cb(results);
        }
    },
    customDimensions: {
        name: 'Custom Dimensions',
        init: function(type, cb, options) {
            this.config = this.sheetColumnConfig();

            switch(type) {
                case 'createSheet':
                    break;
                case 'generateReport':
                    this.account = options.accounts;
                    break;
                case 'getConfig':
                    break;
                case 'insertData':
                    break;
            }

            cb();

            return this;
        },
        /**
         * Column and field related config properties
         */
        sheetColumnConfig: function() {
            var data = [
                {
                    name: 'Include',
                    nameInApi: 'include',
                    fieldType: 'system',
                    dataValidation: [
                        'Yes',
                        'No'
                    ]
                },{
                    name: 'Account Name',
                    nameInApi: 'accountName',
                    fieldType: 'account',
                },{
                    name: 'Account ID',
                    nameInApi: 'accountId',
                    fieldType: 'account',
                },{
                    name: 'Property Name',
                    nameInApi: 'webPropertyName',
                    fieldType: 'property',
                },{
                    name: 'Property ID',
                    nameInApi: 'webPropertyId',
                    fieldType: 'property',
                    regexValidation: /(UA|YT|MO)-\d+-\d+/
                },{
                    name: 'Name',
                    nameInApi: 'name',
                    fieldType: 'customDimension',
                    regexValidation: /.*\S.*/
                },{
                    name: 'Index',
                    nameInApi: 'index',
                    fieldType: 'customDimension',
                    regexValidation: /^[0-9]{1,3}$/
                },{
                    name: 'Scope',
                    nameInApi: 'scope',
                    fieldType: 'customDimension',
                    dataValidation: [
                        'HIT',
                        'SESSION',
                        'USER',
                        'PRODUCT'
                    ],
                    regexValidation: /.*\S.*/
                },{
                    name: 'active',
                    nameInApi: 'include',
                    fieldType: 'customDimension',
                    dataValidation: [
                        'TRUE',
                        'FALSE'
                    ],
                    regexValidation: /.*\S.*/
                }
            ];
            return createApiSheetColumnConfigArray(data);
        },
        listApiData: function(account, property, cb) {
            //TODO: add try catch
            var cdList = Analytics.Management.CustomDimensions.list(account, property).getItems();

            if (typeof cb === 'function') {
                return cb.call(this, cdList);
            }
            else {
                return cdList;
            }
        },
        getApiData: function(account, property, index, cb) {
            var result;

            try {
                result = Analytics.Management.CustomDimensions.get(account, property, index);
            }
            catch (e) {
                result = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        insertApiData: function(account, property, name, index, scope, active, cb) {
            var values = {
                'name': name,
                'index': index,
                'scope': scope,
                'active': active
            };
            var result;

            try {
                result = Analytics.Management.CustomDimensions.insert(values, account, property);
                if (isObject(result)) {
                    result.status = 'Success';
                    var insertedData = [
                        result.call.name,
                        result.call.index,
                        result.call.scope,
                        result.call.active,
                    ];
                    insertedData = replaceUndefinedInArray(insertedData, '');
                    insertedData = replaceNullInArray(insertedData, '');
                    result.insertedData = [insertedData];
                    //TODO: defining the type should be improved (not hardcoded?)
                    result.insertedDataType = 'customDimension';
                    result = 'Success: ' + index + ' from ' + property + ' has been inserted.';
                }
            }
            catch(e) {
                result = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        updateApiData: function(account, property, name, index, scope, active, cb) {
            var values = {
                'name': name,
                'scope': scope,
                'active': active
            };
            var result;
            try {
                result = Analytics.Management.CustomDimensions.update(values, account, property, index);
                if (isObject(result)) {
                    result = 'Success: ' + index + ' from ' + property + ' has been updated';
                }
            }
            catch (e) {
                result = e;
            }

            if (typeof cb === 'function') {
                return cb.call(this, result);
            }
            else {
                return result;
            }
        },
        getData: function(cb) {
            var results = [];

            this.account.forEach(function(account) {
                account.webProperties.forEach(function(property) {
                    this.listApiData(account.id, property.id, function(cdList) {
                        cdList.forEach(function(cd) {
                            var defaults = [
                                '',
                                account.name,
                                account.id,
                                property.name,
                                property.id,
                                cd.name,
                                cd.index,
                                cd.scope,
                                cd.active
                            ];
                            defaults = replaceUndefinedInArray(defaults, '');

                            results.push(defaults);
                        }, this);
                    });
                }, this);
            }, this);

            cb(results);
        },
        insertData: function(insertData) {

            var account = insertData[2];
            var property = insertData[4];
            var name = insertData[5];
            var index = 'ga:dimension' + insertData[6];
            var scope = insertData[7];
            var active = insertData[8];
            var existingData = this.getApiData(account, property, index);

            if(existingData && existingData !== false) {
                return this.updateApiData(account, property, name, index, scope, active);
            }
            else {
                return this.insertApiData(account, property, name, index, scope, active);
            }

        },
    },
    accountSummaries: {
        name: 'Account Summaries',
        requestAccountSummaryList: function() {
            var items = Analytics.Management.AccountSummaries.list().getItems();

            // Return an empty array if there is no result
            if (!items) {
                return [];
            }

            return items;
        }
    }
};


/**
 * Create sheet, set headers and validation data
 * @param {string} type
 */
function createSheet(type) {
    var callApi = api[type];

    callApi.init('createSheet', function() {
        sheet
            .init('initSheet', 'GAM: ' + callApi.name, callApi.config)
            .buildSheet();
    });
}

/**
 * Generate report from a certain apiType for the given account(s)
 * @param {array} accounts
 * @param {string} apiType
 */
function generateReport(accounts, apiType) {
    var callApi = api[apiType];

    callApi.init('generateReport', function() {
        callApi.getData(function(data) {
            // Verify if data is present
            if (data[0] === undefined || !data[0].length) {
                throw new Error('No data found for ' + type + ' in ' + account.name + '.');
            }

            sheet
                .init('initSheet', 'GAM: ' + callApi.name, callApi.config, data)
                .buildData();
        });
    }, {'accounts': accounts});
}

/**
 * Validate the changed data
 * @param {string} event
 */
function onChangeValidation(event) {
    // TODO: finalize & cleanup function
    // TODO: install change detection trigger programatically
    var activeSheet = event.source.getActiveSheet();
    var sheetName = activeSheet.getName();
    var activeRange = activeSheet.getActiveRange();
    var numRows = activeRange.getNumRows();
    var firstRow = activeRange.getLastRow() - numRows + 1;
    var lastColumn = activeSheet.getLastColumn();
    var rowValues = activeSheet.getRange(firstRow, 1, numRows, lastColumn).getValues();
    var callApi = api[getApiTypeBySheetName(sheetName)];

    callApi.init('getConfig', function() {
        sheet
            .init('validateData', sheetName, callApi.config, rowValues)
            .validateData();
    });
}

/**
 * Insert / update data marked for inclusion from the active sheet to Google Analytics
 * @return Displays a message to the user
 */
function insertData() {
    var resultMessages = [];
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var sheetName = activeSheet.getName();
    var sheetRange = activeSheet.getDataRange();
    var sheetColumns = sheetRange.getNumColumns();
    var sheetRows = sheetRange.getNumRows();
    // Get the values of the sheet excluding the header row
    var sheetDataRange = activeSheet.getRange(2, 1, sheetRows, sheetColumns).getValues();
    var markedDataRange = [];
    var apiType = getApiTypeBySheetName(sheetName);
    var callApi = api[apiType];
    var result;

    // Iterate over the rows in the sheetDataRange
    sheetDataRange.forEach(function(rowArray, rowId) {
        // Define the real row ID in order to provide feedback to the user
        var realRowId = rowId+2;

        // Only process rows marked for inclusion
        if (rowArray[0] == 'Yes') {

            callApi.init('insertData', function() {
                result = callApi.insertData(rowArray);
                resultMessages.push('\nRow ' + realRowId + ': ' + result.message);

                // Write the specified data to the sheet
                if (result.dataToUpdate) {
                    var dataToUpdate = result.dataToUpdate;

                    for (var key in dataToUpdate) {
                        var columnId = getApiColumnIndexByName(apiType, key);
                        var dataCell = activeSheet.getRange(realRowId, columnId, 1, 1);
                        dataCell.setValue(dataToUpdate[key]);
                    }
                }

                // Write insertedData back to the sheet
                if (result.insertedData) {
                    var colRange = getApiColumnIndexRangeByType(apiType, result.insertedDataType);
                    var dataRange = activeSheet.getRange(realRowId, colRange[0], 1, colRange[1] - colRange[0] + 1);
                    dataRange.setValues(result.insertedData);
                }

            });

        }
    });

    if (resultMessages.length > 0) {
        ui.alert('Results', resultMessages, ui.ButtonSet.OK);
    }
    else {
        ui.alert('Error', 'Please mark at least on row for inclusion.', ui.ButtonSet.OK);
    }

}
/**
 * Retrieve Account Summary from the Google Analytics Management API
 * @return {array}
 */
function getAccountSummary() {
    var items = api.accountSummaries.requestAccountSummaryList();
    return JSON.stringify(items, ['name', 'id', 'webProperties', 'profiles']);
}
