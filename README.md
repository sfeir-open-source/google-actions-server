## GAS: Google Assistant Server

![image](https://cloud.githubusercontent.com/assets/1699357/21663314/b022ace0-d2df-11e6-8713-9f68b1c3ee3b.png)

A Node.js server for your [Google Assistant](https://developers.google.com/actions/) (and Google Home).

### Get it from NPM

```bash
npm i -S @manekinekko/google-actions-server
```

### Get it from Yarn

```bash
$ yarn add @manekinekko/google-actions-server
```
## How to use it

See the [GAS Starter](https://github.com/manekinekko/google-actions-starter) for more details.

## GAS API

Here is the simplest guide in order to use GAS:

```javascript
import { ActionServer } from '@manekinekko/google-actions-server';

const agent = new ActionServer();

agent.welcome((assistant) => {
    agent.ask('Hello Home. How can I help');
});

agent.intent(ActionServer.intent.action.TEXT, (assistant) => {

  // reads the user's request
  const userInput = assistant.getRawInput();

})
    
// start listening for commands (on port 8080)
agent.listen();

```

### Intents

Available intents are:

#### ActionServer.intent.action.MAIN

This intent is triggered when users invoke your action by name, such as "talk to <YOUR ACTION NAME HERE>". This intent si required for every action package.
  
#### ActionServer.intent.action.TEXT

This intent is triggered when users speak input and you receive the input as a request to your fulfillment endpoint.

#### ActionServer.intent.action.PERMISSION

Triggered if Google Assistant needs to ask the user for more permissions (not implemented yet by GAS)

### ActionServer

#### ActionServer(port = 8080)

Create an HTTP server and set it to listen on port `port` (default: 8080).

### Agent

Calling `new ActionServer()` will return an `Agent` instance, which exposes the following API:

#### agent.intent(name, callback)

Register a `callback` with an intent of type `ActionServer.intent.action.*`. When invoked, the `callback` function receives an instance of **[ActionsSdkAssistant](https://developers.google.com/actions/reference/ActionsSdkAssistant)**. For instance:

```javascript
agent.welcome(ActionServer.intent.action.TEXT, (assistant) => {
  // assistant
});
```

#### agent.welcome(callback)

Register a `callback` with the **ActionServer.intent.action.MAIN** intent. This is the same as:

```
agent.intent(ActionServer.intent.action.MAIN, (assistant) => {
  // assistant
});
```

Register a `callback` with the **ActionServer.intent.action.MAIN** intent. This is the same as:

#### agent.listen()

Starts the GAS server on port `8080` (the default port). This method **must be** called after you have registered all of your intents.

#### agent.ask(message)

A convenient method that abstracts away the `assistant.ask()` configuration. Typically, with `assistant.ask()` you have to:

```javascript
const inputPrompt = assistant.buildInputPrompt(isSsml, message, noInputs);
assistant.data = previousState;
assistant.ask(inputPrompt);
```

With `agent.ask()`, you can just pass it the message:

```javascript
agent.ask(message);
```

Of course, you can still call `assistant.ask()` if you want to provide a configuration. 

#### setGreetings(greetings)

A convenient method to set a list of greeting messages that you will play randomly to the user.

#### getRandomGreeting()

A convenient method to get a random greeting message set using `agent.setGreetings()`.

#### randomGreeting()

A convenient method that will trigger a random greeting message for you.

#### setConversationMessages(conversationMessages)

A convenient method to set a list of random conversations asking the user for another query. For instant: `How can I help?` or `Do you have another reuqest?`.

#### getRandomConversationMessage()

A convenient method to get a random conversation message set using `agent.setConversationMessages()`.

#### agent.train(dataSetKey, data, fields = ['data']))

This method is used to provide a set of data that will be used by `agent.matchUserRequest()`. This could be the data that will be used by the assistant to interact with the user, or a set of Hot Words such as:

```javascript
this.agent.train('hot_words', [
    'what time is it?',
    'tell me the time',
    `what's the time`,
    //...
]);
```

Here is another use case, let's say you want to provide a decision list:

```javascript
const decisionList = [
    {
        'scenario': 'I have one existing Observable, and I want to change each emitted value to be a constant value',
        'operator': 'mapTo'
    },
    {
        'scenario': 'I have one existing Observable, and I want to change each emitted value to be a value calculated through a formula',
        'operator': 'map'
    },
    ...
];
```

You would then provide it to GAS like so:

```javascript
const fields = ['operator', 'scenario'];
this.agent.train('decision_list', decisionList, fields);
```

Please note that the `fields` option has been provided since the items inside this decision list are stored in key/value pairs.

**IMPORTANT: the first field (in the sample above: `operator`) will be used as the reference field: the field that will be returned by `agent.matchUserRequest()`.**

#### matchUserRequest(dataSetKey, rawInput, responseCallback, lookupOptions = {})

**NOTE:** GAS uses (elasticlunr)[https://github.com/weixsong/elasticlunr.js] that performs the [Full-Text Search](https://en.wikipedia.org/wiki/Full-text_search) technique to retrieve the matched documents.

Use this method to match the user's input with a set of data provided in `agent.train()`. 

For instance, let's say you have the `decisionList` list from the example above; in order to find a matched document you would call `agent.matchUserRequest()` like so:

```javascript
// get the user's input
const rawInput = assistant.getRawInput();

// provide a lookup configuration (see below)
const lookupOptions = {...};

// the callback that will be called
const responseCallback = (foundDocuments, rawInput) => { ... };

// run the search operation
const matchedDocuments = this.agent.matchUserRequest('decision_list', rawInput, responseCallback, lookupOptions);
```

The `matchedDocuments` would then contain the matched documents based on the `rawInput` string. In some case you may get false-positives, documents that are not relevant to the intended search question.
In this case, you may provide a `lookupOptions` object in order to configure/tweak the search operation.

**NOTE:** if no documents are found, an empty array is returned.

##### threshold

You can provide the `threshold` property to filter out the false-positives. `threshold` can be either a Number or a Function.

Using a number:

```javascript
const lookupOptions = {
    threshold: 0.6
};
```

When using a function, it will be provided with the current entry from the data set. You can access the `score` property on that entry:

```javascript
const lookupOptions = {
    threshold: entry => {
        return entry.score > 0.6;
    }
};
```

##### fields

The fields property is a [elasticlunr configuration query](https://github.com/weixsong/elasticlunr.js#52-configuration-query). For instance, we could provide the following configuration for the example from above: 

```javascript
const lookupOptions = {
    fields: {
        scenario: {
            boost: 2,
            bool: 'AND',
            expand: true
        },
        operator: {
            boost: 1
        }
    }
};
```

See [elasticlunr configuration query](https://github.com/weixsong/elasticlunr.js#52-configuration-query) for more details.

#### fetch(url, responseCallback, useCache = true)

A convenient method to fetch a remote document. Useful if you want to get more information from a remote website. For instance:

```javascript
agent.fetch(url, (error, content) => {
    if (error) {
        console.error(error);
    }
    else {
        console.log(content);
    }
});

```


# Disclaimer

The current implementation is still a POC. It's obviously missing lots of features. Please open issues to discuss any feature you want to be added, submit suggestions, or anything else...
All contributions are welcome ;)

## License

The MIT License (MIT)
Copyright (c) 2017 - Wassim CHEGHAM

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
