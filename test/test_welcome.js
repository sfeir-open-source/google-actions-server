'use strict';

var ActionServer = require('../dist/index').ActionServer;

var chai = require('chai');
var expect = chai.expect;
var request = require('supertest');

describe('ActionServer', function() {
  var actionServer;
  var express;

  beforeEach(function() {
    actionServer = new ActionServer();
    express = actionServer.listen();
  });

  afterEach(function() {
    express.close();
  });

  it('binds to port 8080 by default', function() {
    expect(actionServer.app.settings.port).to.equal(8080);
  });

  it('responds to an invalid payload', function() {
    return request(express)
      .post('/')
      .expect(400).then(function(response) {
        expect(response.text).to.equal('Action Error: Missing inputs from request body');
      });
  });

  it('responds to a valid payload', function() {
    actionServer.welcome(function() {
      this.ask("Hello!");
    });

    return request(express)
      .post('/')
      .send({
        'inputs': [{
          'intent': 'assistant.intent.action.MAIN'
        }]
      })
      .expect(200).then(function(response) {
        expect(response.body.expected_inputs[0]
          .input_prompt.initial_prompts[0]
          .ssml).to.equal('Hello!');
      });
  });
});
