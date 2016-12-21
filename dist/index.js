'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Action = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _actionsOnGoogle = require('actions-on-google');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

process.env.DEBUG = 'actions-on-google:*';

var Action = exports.Action = function () {
    function Action() {
        var port = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 8080;

        _classCallCheck(this, Action);

        this.didntHearYa = ['I can\'t read your text', 'If you\'re still there, what\'s your text?', 'Let me read your text?'];

        this.actionsMap = new Map();
        this.app = (0, _express2.default)();
        this.app.set('port', process.env.PORT || port);
        this.app.use(_bodyParser2.default.json({ type: 'application/json' }));
        this.handlers = [];
    }

    _createClass(Action, [{
        key: 'config',
        value: function config(didntHearYa) {
            this.didntHearYa = didntHearYa;
        }
    }, {
        key: 'when',
        value: function when(speech, callback) {
            var _this = this;

            if (Array.isArray(speech) === false) {
                speech = [speech];
            }
            speech.map(function (sp) {
                _this.register(function (assistant, userResponse) {
                    if (userResponse === sp) {
                        callback.call(_this, _this.wrapAssistant(assistant));
                    } else {
                        throw new Error('Action not recognized');
                    }
                });
            });
            return this;
        }
    }, {
        key: 'otherwise',
        value: function otherwise(callback) {
            var _this2 = this;

            this.onDefault = function (assistant, userResponse) {
                callback.call(_this2, _this2.wrapAssistant(assistant));
                _this2.pp = 0;
            };
            return this;
        }
    }, {
        key: 'register',
        value: function register(handler) {
            this.handlers.push(handler.bind(this));
        }
    }, {
        key: 'mainIntent',
        value: function mainIntent(assistant) {
            this.wrapAssistant(assistant).say('Let\'s go!');
        }
    }, {
        key: 'wrapAssistant',
        value: function wrapAssistant(assistant) {
            var _this3 = this;

            assistant.say = function (message) {
                return _this3.ask(message);
            };
            return assistant;
        }
    }, {
        key: 'ask',
        value: function ask(message) {
            var inputPrompt = this.assistant.buildInputPrompt(true, message, this.didntHearYa);
            this.assistant.ask(inputPrompt);
        }
    }, {
        key: 'handleRequest',
        value: function handleRequest() {
            var _this4 = this;

            this.app.post('/', function (request, response) {
                _this4.assistant = new _actionsOnGoogle.ActionsSdkAssistant({ request: request, response: response });
                var handlersCounter = 0;

                _this4.actionsMap.set(_this4.assistant.StandardIntents.MAIN, _this4.mainIntent.bind(_this4));
                _this4.actionsMap.set(_this4.assistant.StandardIntents.TEXT, function (assistant) {
                    var userResponse = assistant.getRawInput();

                    _this4.handlers.map(function (handler, index) {

                        try {
                            handler.apply(_this4, [assistant, userResponse]);
                        } catch (e) {
                            if (_this4.handlers.length - 1 === index) {
                                _this4.onDefault.apply(_this4, [assistant, userResponse]);
                            }
                        }
                    });
                });

                _this4.assistant.handleRequest(_this4.actionsMap);
            });
        }
    }, {
        key: 'listen',
        value: function listen() {
            this.handleRequest();
            var server = this.app.listen(this.app.get('port'), function () {
                console.log('App listening on port %s', server.address().port);
                console.log('Press Ctrl+C to quit.');
            });
        }
    }]);

    return Action;
}();

;