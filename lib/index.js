'use strict';

process.env.DEBUG = 'actions-on-google:*';

const INTENT = {
    WELCOME: 'intent_welcome',
    INPUT: 'intent_input'
};

import { ActionsSdkAssistant } from 'actions-on-google';
import express from 'express';
import bodyParser from 'body-parser';

export class ActionServer {

    static intent = {
        action: {
            MAIN: 'assistant.intent.action.MAIN',
            TEXT: 'assistant.intent.action.TEXT',
            PERMISSION: 'assistant.intent.action.PERMISSION'
        }
    };

    subscribeIntent;

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
        this.handlers = [];
    }

    welcome(callback) {
        this.intent(ActionServer.intent.action.MAIN, callback);
    }

    subscribe(subscribeIntent) {
        this.subscribeIntent = subscribeIntent;
    }

    when(speech, callback) {
        if (Array.isArray(speech) === false) {
            speech = [speech];
        }
        speech.map(sp => {
            this.register((assistant, userResponse) => {
                if (userResponse === sp) {
                    callback.call(this, this.wrapAssistant(assistant));
                } else {
                    throw new Error('Action not recognized');
                }
            });
        });
        return this;
    }

    otherwise(callback) {
        this.onDefault = (assistant, userResponse) => {
            callback.call(this, this.wrapAssistant(assistant));
            this.pp = 0;
        };
        return this;
    }

    register(handler) {
        this.handlers.push(handler.bind(this));
    }

    intent(key, callback) {
        this.actionsMap.set(key, callback.bind(this));
    }

    wrapAssistant(assistant) {
        assistant.say = (message) => this.ask(message);
        return assistant;
    }

    ask(message) {
        let inputPrompt = this.assistant.buildInputPrompt(true, message, [`Sorry`]);
        this.assistant.ask(inputPrompt);
    }

    requestNamePermission(context) {
        // assistant.isPermissionGranted()
        let permission = this.assistant.SupportedPermissions.NAME;
        this.assistant.askForPermission(content, permission);
    }

    handleRequest() {
        this.app.post('/', (request, response) => {
            this.assistant = new ActionsSdkAssistant({ request, response });

            this.handlers.map((handler, index) => {

                this.actionsMap.set(`${INTENT.INPUT}_${index}`, (assistant) => {
                    const userResponse = assistant.getRawInput();
                    try {
                        handler.apply(this, [assistant, userResponse]);
                    } catch (e) {
                        if (this.handlers.length - 1 === index) {
                            this.onDefault.apply(this, [assistant, userResponse]);
                        }
                    }

                });
            });

            //this.actionsMap.set(this.assistant.StandardIntents.TEXT, this.subscribeIntent.bind(this));
            this.assistant.handleRequest(this.actionsMap);
        });
    }

    listen() {
        this.handleRequest();
        const server = this.app.listen(this.app.get('port'), function() {
            console.log('App listening on port %s', server.address().port);
            console.log('Press Ctrl+C to quit.');
        });
    }
};