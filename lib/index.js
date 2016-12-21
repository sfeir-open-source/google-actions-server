'use strict';

process.env.DEBUG = 'actions-on-google:*';

import { ActionsSdkAssistant } from 'actions-on-google';
import express from 'express';
import bodyParser from 'body-parser';

export class Action {

    actionsMap;
    app;
    assistant;
    handlers;
    onDefault;
    didntHearYa = [
        `I can't read your text`,
        `If you're still there, what's your text?`,
        `Let me read your text?`
    ];

    constructor(port = 8080) {
        this.actionsMap = new Map();
        this.app = express();
        this.app.set('port', (process.env.PORT || port));
        this.app.use(bodyParser.json({ type: 'application/json' }));
        this.handlers = [];
    }

    config(didntHearYa) {
        this.didntHearYa = didntHearYa;
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

    mainIntent(assistant) {
        this.wrapAssistant(assistant).say(`Let's go!`);
    }

    wrapAssistant(assistant) {
        assistant.say = (message) => this.ask(message);
        return assistant;
    }

    ask(message) {
        let inputPrompt = this.assistant.buildInputPrompt(true, message, this.didntHearYa);
        this.assistant.ask(inputPrompt);
    }

    handleRequest() {
        this.app.post('/', (request, response) => {
            this.assistant = new ActionsSdkAssistant({ request, response });
            let handlersCounter = 0;

            this.actionsMap.set(this.assistant.StandardIntents.MAIN, this.mainIntent.bind(this));
            this.actionsMap.set(this.assistant.StandardIntents.TEXT, (assistant) => {
                const userResponse = assistant.getRawInput();

                this.handlers.map((handler, index) => {

                    try {
                        handler.apply(this, [assistant, userResponse]);
                    } catch (e) {
                        if (this.handlers.length - 1 === index) {
                            this.onDefault.apply(this, [assistant, userResponse]);
                        }
                    }

                });

            });

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