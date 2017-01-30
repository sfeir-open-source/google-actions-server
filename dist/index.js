'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ActionServer = exports.Permission = exports.Intent = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _actionsOnGoogle = require('actions-on-google');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _elasticlunr = require('elasticlunr');

var _elasticlunr2 = _interopRequireDefault(_elasticlunr);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

process.env.DEBUG = 'google-actions-server:*';

var l = function l() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
    }

    return console.log.apply(console, args);
};

var Intent = exports.Intent = {
    Action: {
        MAIN: 'assistant.intent.action.MAIN',
        TEXT: 'assistant.intent.action.TEXT',
        NAME_PERMISSION: 'assistant.intent.action.NAME_PERMISSION',
        LOCATION_PERMISSION: 'assistant.intent.action.LOCATION_PERMISSION'
    }
};

var Permission = exports.Permission = {
    NAME: 'assistant.SupportedPermissions.NAME',
    DEVICE_PRECISE_LOCATION: 'assistant.SupportedPermissions.DEVICE_PRECISE_LOCATION',
    DEVICE_COARSE_LOCATION: 'assistant.SupportedPermissions.DEVICE_COARSE_LOCATION'
};

var ActionServer = exports.ActionServer = function () {
    function ActionServer() {
        var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 8080;

        _classCallCheck(this, ActionServer);

        this.actionsMap = new Map();
        this.app = (0, _express2.default)();
        this.app.set('port', process.env.PORT || port);
        this.app.use(_bodyParser2.default.json({ type: 'application/json' }));

        this.request = _request2.default; // node module

        // phrase random (incremental) counter
        this.conversationMessagesCounter = 0;
        this.conversationMessages = [];
        this.greetings = [];
        this.dataSetIndex = {};
        this.requestCache = {};
    }

    _createClass(ActionServer, [{
        key: 'welcome',
        value: function welcome(callback) {
            this.intent(Intent.Action.MAIN, callback);
        }
    }, {
        key: 'intent',
        value: function intent(key, callback) {
            this.actionsMap.set(key, callback.bind(this));
        }
    }, {
        key: 'setGreetings',
        value: function setGreetings(greetings) {
            if (Array.isArray(greetings) === false) {
                throw new Error('Greeting messages must be an array');
                return false;
            }

            this.greetings = greetings;
        }
    }, {
        key: 'getRandomGreeting',
        value: function getRandomGreeting() {
            return this.greetings[Math.random() * this.greetings.length - 1 | 0];
        }
    }, {
        key: 'randomGreeting',
        value: function randomGreeting() {
            this.ask(this.getRandomGreeting());
        }
    }, {
        key: 'setConversationMessages',
        value: function setConversationMessages(conversationMessages) {
            if (Array.isArray(conversationMessages) === false) {
                throw new Error('"Next Questions" messages must be an array');
                return false;
            }

            this.conversationMessages = conversationMessages;
        }
    }, {
        key: 'getRandomConversationMessage',
        value: function getRandomConversationMessage() {
            var messageIndex = this.conversationMessagesCounter++ % (this.conversationMessages.length - 1) || 0;
            return this.conversationMessages[messageIndex];
        }
    }, {
        key: 'train',
        value: function train(dataSetKey, data) {
            var _this = this;

            var fields = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : ['data'];


            if (!dataSetKey) {
                throw new Error('The "dataSetKey" parameter in "train()" is missing.');
                return false;
            }

            if (Array.isArray(data) === false) {
                throw new Error('The "data" parameter in "train()" is missing.');
                return false;
            }

            this.dataSetIndex[dataSetKey] = {
                __raw: {
                    data: data,
                    fields: fields
                },
                __index: (0, _elasticlunr2.default)(function () {
                    var lunr = this;

                    // if the user has provided a custom schema, use it.
                    // otherwise use the default schema: "data"
                    var refField = fields[0];
                    lunr.setRef(refField);
                    fields.map(function (field) {
                        lunr.addField(field);
                    });
                    lunr.saveDocument(false);
                })
            };

            data.map(function (key) {
                if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) !== 'object') {
                    key = {
                        'data': key
                    };
                }
                _this.dataSetIndex[dataSetKey].__index.addDoc(key);
            });
        }
    }, {
        key: 'matchUserRequest',
        value: function matchUserRequest(dataSetKey, rawInput, responseCallback) {
            var lookupOptions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};


            if (!dataSetKey) {
                throw new Error('The "dataSetKey" parameter in "matchUserRequest()" is missing.');
                return false;
            }

            if (!this.dataSetIndex || !this.dataSetIndex[dataSetKey]) {
                throw new Error('"' + dataSetKey + '" entry was not initialized. Call "train(\'' + dataSetKey + '\', hotWords)" to train a set of data.');
                return false;
            }

            var dataSet = this.dataSetIndex[dataSetKey];
            var refField = dataSet.__raw.fields[0];

            var queryTimeBoosting = {
                expand: false,
                fields: _defineProperty({}, refField, {
                    expand: false
                })
            };
            if (lookupOptions.fields) {
                queryTimeBoosting.fields = lookupOptions.fields;
            }

            var filterByScore = function filterByScore(d) {
                return true;
            }; // allow all scores
            if (lookupOptions.threshold) {
                if (typeof lookupOptions.threshold === 'number') {
                    filterByScore = function filterByScore(d) {
                        return d.score > parseFloat(lookupOptions.threshold);
                    };
                } else if (typeof lookupOptions.threshold === 'function') {
                    filterByScore = lookupOptions.threshold;
                } else {
                    throw new Error('The "threshold" parameter in lookups must either a function or a number.');
                    return false; // you know, life is short!
                }
            }

            var found = dataSet.__index.search(rawInput, queryTimeBoosting);

            var fileredResult = found.sort(function (d1, d2) {
                return d1.score >= d2.score;
            }).filter(filterByScore).map(function (d) {
                return d.ref;
            });

            if (responseCallback) {
                responseCallback(fileredResult, rawInput);
            }
            return fileredResult;
        }

        // request remote http URL

    }, {
        key: 'fetch',
        value: function fetch(url, responseCallback) {
            var useCache = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;


            if (!url) {
                throw new Error('The "url" parameter is missing');
                return false;
            } else if (!responseCallback) {
                console.warn('It seems you did not provide a callback when requesting "' + url + '"');
            }

            var urlSymbol = Symbol(url);

            if (useCache) {
                var cachedResponse = this.requestCache[urlSymbol];
                if (cachedResponse) {
                    responseCallback(null, cachedResponse);
                    return cachedResponse;
                } else {
                    return this._doRequest(url, responseCallback);
                }
            } else {
                return this._doRequest(url, responseCallback);
            }
            return null;
        }
    }, {
        key: '_doRequest',
        value: function _doRequest(url, responseCallback) {
            var _this2 = this;

            var urlSymbol = Symbol(url);

            return this.request(url, function (error, response, html) {
                if (!error && response.statusCode == 200) {

                    _this2.requestCache[urlSymbol] = {};
                    if (html) {
                        _this2.requestCache[urlSymbol] = html;
                    } else {
                        console.warn('Response from "' + url + '" was empty.');
                    }
                    responseCallback(null, html);
                } else {
                    responseCallback(error, null);
                }
            });
        }

        // a convenient method to abstract the assistant "ask" process

    }, {
        key: 'ask',
        value: function ask(message) {
            var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            var inputPrompt = this.assistant.buildInputPrompt(true, message, ['Sorry']);
            this.assistant.data = data;
            this.assistant.ask(inputPrompt);
        }
    }, {
        key: 'requestPermissions',
        value: function requestPermissions(permissions) {
            if (Array.isArray(permissions) === false) {
                permissions = [permissions];
            }
            return Promise.resolve(this.assistant.askForPermissions('To help you', permissions));
        }
    }, {
        key: '_handleRequest',
        value: function _handleRequest() {
            var _this3 = this;

            this.app.post('/', function (request, response) {
                _this3.assistant = new _actionsOnGoogle.ActionsSdkAssistant({ request: request, response: response });
                _this3.assistant.handleRequest(_this3.actionsMap);
            });
        }
    }, {
        key: 'listen',
        value: function listen() {
            this._handleRequest();
            var server = this.app.listen(this.app.get('port'), function () {
                console.log('App listening on port %s', server.address().port);
                console.log('Press Ctrl+C to quit.');
            });
        }
    }]);

    return ActionServer;
}();

;