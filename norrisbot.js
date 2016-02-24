'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

//I create a construnctor function for the new JS class NorrisBot.
//It inherits all methods of the Bot class because of util.inherits function in NodeJS.
var NorrisBot = function Constructor(settings) {
	this.settings = setings;
	this.settings.name = this.setting.name || 'norrisbot';
	//I need to have a path where the SQLite DB is stored (dbPath attribute)
	this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

	//I declare the variables user & db that will be used later to store current user info.
	this.user = null;
	this.db = null;
};

//Inherits methods and properties from the Bot constructor.
util.inherits(NorrisBot, Bot);
module.exports = NorrisBot;

//This function allows to instantiate the bot, but will not connect to slack servers unless the run method is called
//this method calls the original constructor of the Bot class and attaches 2 callback functions to the start and message events.
NorrisBot.prototype.run = function() {
	NorrisBot.super_.call(this, this.settings);

	this.on('start', this._onStart);
	this.on('message', this._onMessage);
};

//When the bot connects to the slack servers, it needs to; Load metadata related to the user representing the bot
//Connect to the SQLite DB
//Check whether it is the first time the bot is executed.
NorrisBot.prototype._onStart = function(){
	this._loadBotUser();
	this.connectDb();
	this._firstRunCheck();
};


//When the original Bot class connects to the slack server and downloads a list with all users in the organization
//it saves it in the users attribute as an array of objects.
NorrisBot.prototype._loadBotUser = function () {
	var self = this;
	this.user = this.users.filter(function(user){
		return user.name === self.name;
	})[0];
};


//check if the DB file exists and we create a new SQLite DB instance.
NorrisBot.prototype._connectDB = function() {
	if (!fs.existsSync(this.dbPath)){
		console.error('Database path' + '"' + this.dbPath + '"does not exist or is not readable.');
		process.exit(1);
	}
	this.db = new SQLite.Database(this.dbPath);
};

//use the info table(defined as a key-value table) to see if bot has been previously run
//check the record with name "lastrun". If exists, we update timestamp to current.
//otherwise call function _welcomeMessage and create a new lastrun record.
NorrisBot.prototype._firstRunCheck = function () {
    var self = this;
    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var currentTime = (new Date()).toJSON();

        // this is a first run
        if (!record) {
            self._welcomeMessage();
            return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
        }

        // updates with new last running time
        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
    });
};

//This is the welcome message function where we are using the function postMessageToChannel of the Bot class.
NorrisBot.prototype._welcomeMessage = function () {
    this.postMessageToChannel(this.channels[0].name, 'Hi guys, roundhouse-kick anyone?' +
        '\n I can tell jokes, but very honest ones. Just say `Chuck Norris` or `' + this.name + '` to invoke me!',
        //as_user gives the bot user like properties.
        {as_user: true});
};

//This function checks; if the event represents a chat message
//checks if the message has been sent to a channel
//checks if the message is coming from a user that is different than NorrisBot
//Checks if the message mentions Chuck Norris.
NorrisBot.prototype._onMessage = function (message) {
    if (this._isChatMessage(message) &&
        this._isChannelConversation(message) &&
        !this._isFromNorrisBot(message) &&
        this._isMentioningChuckNorris(message)
    ) {
        this._replyWithRandomJoke(message);
    }
};

//Helper Functions for _onMessage

//Allows to check if a realtime event corresponds to a message sent by a user.
NorrisBot.prototype._isChatMessage = function (message) {
    return message.type === 'message' && Boolean(message.text);
};


//Verifies if the message is directed to a channel.
//channel refers to any virtual communication channel.
//every channel is identified by an alphanumeric ID. If the first character is a C, it represents a chat channel
NorrisBot.prototype._isChannelConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
};


//This method checks who the message is coming from; i.e. it is not coming from the bot itself.
//this avoids infinite loops.

NorrisBot.prototype._isFromNorrisBot = function (message) {
    return message.user === this.user.id;
};

//This method checks whether a piece of text mentions Chuck Norris or not.

NorrisBot.prototype._isMentioningChuckNorris = function (message) {
    return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1;
};


//If all the checks above succeed, this method gets executed.
NorrisBot.prototype._replyWithRandomJoke = function (originalMessage) {
    var self = this;
    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var channel = self._getChannelById(originalMessage.channel);
        self.postMessageToChannel(channel.name, record.joke, {as_user: true});
        self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
    });
};

//All functions that post messages use the channel as a parameter, so we need to retrieve the name of the channel
//given its ID.
NorrisBot.prototype._getChannelById = function (channelId) {
    return this.channels.filter(function (item) {
        return item.id === channelId;
    })[0];
};
