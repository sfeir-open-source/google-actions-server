'use strict';

process.env.DEBUG = 'google-actions-server:*';

const l = (...args) => console.log.apply(console, args);

import { ActionsSdkAssistant } from 'actions-on-google';
import express from 'express';
import bodyParser from 'body-parser';
import elasticlunr from 'elasticlunr';
import request from 'request';

export class ActionServer {

    static intent = {
        action: {
            MAIN: 'assistant.intent.action.MAIN',
            TEXT: 'assistant.intent.action.TEXT',
            PERMISSION: 'assistant.intent.action.PERMISSION'
        }
    };

    actionsMap;
    app;
    assistant;
    handlers;
    onDefault;

    constructor(port = 8080) {
        this.actionsMap = new Map();
        this.app = express();
        this.app.set('port', (process.env.PORT || port));
        this.app.use(bodyParser.json({ type: 'application/json' }));

        this.request = request; // node module

        // phrase random (incremental) counter
        this.conversationMessagesCounter = 0;
        this.conversationMessages = [];
        this.greetings = [];
        this.dataSetIndex = {};
        this.requestCache = {};
    }

    welcome(callback) {
        this.intent(ActionServer.intent.action.MAIN, callback);
    }

    intent(key, callback) {
        this.actionsMap.set(key, callback.bind(this));
    }

    setGreetings(greetings) {
        if (Array.isArray(greetings) === false) {
            throw new Error('Greeting messages must be an array');
            return false;
        }

        this.greetings = greetings;
    }

    getRandomGreeting() {
        return this.greetings[(Math.random() * this.greetings.length - 1) | 0];
    }

    randomGreeting() {
        this.ask(this.getRandomGreeting());
    }

    setConversationMessages(conversationMessages) {
        if (Array.isArray(conversationMessages) === false) {
            throw new Error('"Next Questions" messages must be an array');
            return false;
        }

        this.conversationMessages = conversationMessages;
    }

    getRandomConversationMessage() {
        const messageIndex = (this.conversationMessagesCounter++ % (this.conversationMessages.length - 1)) || 0;
        return this.conversationMessages[messageIndex];
    }

    train(dataSetKey, data, fields = ['data']) {

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
                data,
                fields
            },
            __index: elasticlunr(function() {
                const lunr = this;

                // if the user has provided a custom schema, use it.
                // otherwise use the default schema: "data"
                const refField = fields[0];
                lunr.setRef(refField);
                fields.map(field => {
                    lunr.addField(field);
                });
                lunr.saveDocument(false);
            })
        };

        data.map(key => {
            if (typeof key !== 'object') {
                key = {
                    'data': key
                };
            }
            this.dataSetIndex[dataSetKey].__index.addDoc(key);
        });
    }

    matchUserRequest(dataSetKey, rawInput, responseCallback, lookupOptions = {}) {

        if (!dataSetKey) {
            throw new Error('The "dataSetKey" parameter in "matchUserRequest()" is missing.');
            return false;
        }

        if (!this.dataSetIndex || !this.dataSetIndex[dataSetKey]) {
            throw new Error(`"${dataSetKey}" entry was not initialized. Call "train('${dataSetKey}', hotWords)" to train a set of data.`);
            return false;
        }

        const dataSet = this.dataSetIndex[dataSetKey];
        const refField = dataSet.__raw.fields[0];

        let queryTimeBoosting = {
            expand: false,
            fields: {
                [refField]: {
                    expand: false
                }
            }
        };
        if (lookupOptions.fields) {
            queryTimeBoosting.fields = lookupOptions.fields;
        }

        let filterByScore = d => true; // allow all scores
        if (lookupOptions.threshold) {
            if (typeof lookupOptions.threshold === 'number') {
                filterByScore = d => d.score > parseFloat(lookupOptions.threshold);
            } else if (typeof lookupOptions.threshold === 'function') {
                filterByScore = lookupOptions.threshold;
            } else {
                throw new Error(`The "threshold" parameter in lookups must either a function or a number.`);
                return false;
            }
        }

        let found = dataSet.__index.search(rawInput, queryTimeBoosting);

        const fileredResult = found
            .sort((d1, d2) => d1.score >= d2.score)
            .filter(filterByScore)
            .map(d => d.ref);

        if (responseCallback) {
            responseCallback(fileredResult, rawInput);
        }
        return fileredResult;
    }

    // request remote http URL
    fetch(url, responseCallback, useCache = true) {

        if (!url) {
            throw new Error('The "url" parameter is missing');
            return false;
        } else if (!responseCallback) {
            console.warn(`It seems you did not provide a callback when requesting "${url}"`);
        }

        const urlSymbol = Symbol(url);

        if (useCache) {
            const cachedResponse = this.requestCache[urlSymbol];
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

    _doRequest(url, responseCallback) {

        const urlSymbol = Symbol(url);

        return this.request(url, (error, response, html) => {
            if (!error && response.statusCode == 200) {

                this.requestCache[urlSymbol] = {};
                if (html) {
                    this.requestCache[urlSymbol] = html;
                } else {
                    console.warn(`Response from "${url}" was empty.`);
                }
                responseCallback(null, html);
            } else {
                responseCallback(error, null);
            }
        });
    }

    // a convenient method to abstract the assistant "ask" process
    ask(message, data = {}) {
        let inputPrompt = this.assistant.buildInputPrompt(true, message, [`Sorry`]);
        this.assistant.data = data;
        this.assistant.ask(inputPrompt);
    }

    /**
     * @todo
     */
    requestNamePermission(context) {
        // assistant.isPermissionGranted()
        let permission = this.assistant.SupportedPermissions.NAME;
        this.assistant.askForPermission(content, permission);
    }

    _handleRequest() {
        this.app.post('/', (request, response) => {
            this.assistant = new ActionsSdkAssistant({ request, response });
            this.assistant.handleRequest(this.actionsMap);
        });
    }

    listen() {
        this._handleRequest();
        const server = this.app.listen(this.app.get('port'), function() {
            console.log('App listening on port %s', server.address().port);
            console.log('Press Ctrl+C to quit.');
        });
    }
};