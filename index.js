var express = require('express');
var GitHubApi = require("github");
var _ = require('lodash');
var q = require('q');
var exphbs  = require('express-handlebars');
var cache = require('memory-cache');

var hbs = exphbs.create({
    helpers: {
        exists: function (variable, options) {
            if (typeof variable !== 'undefined') {
                return options.fn(this);
            }
        }
    },
    extname: 'hbs'
});

var app = express();
app.set('port', (process.env.PORT || 5000));
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.use('/normalize-css', express.static('bower_components/normalize-css'));
app.use('/foundation/css', express.static('bower_components/foundation/css'));
app.use('/foundation/js', express.static('bower_components/foundation/js'));
app.use(express.static('public'));

var github = new GitHubApi({
    version: "3.0.0",
    debug: true,
    protocol: "https",
    host: "api.github.com",
    timeout: 5000,
    headers: {
        "user-agent": "Hacktoberfest Checker"
    }
});

github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_TOKEN
});

var octoberOpenPrs = [];
var userImage;

function getPullRequests(username) {
    var deferred,
        options;

    deferred = q.defer();

    options = {
        q: 'created:2015-09-30T00:00:00-12:00..2015-10-31T23:59:59-12:00+type:pr+is:public+author:' + username
    };

    github.search.issues(options, function(err, res) {
        if (err) {
            deferred.reject();
            return;
        }

        userImage = null;

        _.each(res.items, function(event) {
            var repo = event.pull_request.html_url.substring(0, event.pull_request.html_url.search('/pull'));

            if (userImage == null) {
                userImage = event.user.avatar_url;
            }

            returnedEvent = {
                repo_name: repo,
                title: event.title,
                url: event.html_url,
                state: event.state
            }
            octoberOpenPrs.push(returnedEvent);
        });

        deferred.resolve();
    });

    return deferred.promise;
}

app.get('/', function(req, res) {

    var promises = [];

    if (!req.query.username) {
        return res.render('index');
    }

    getPullRequests(req.query.username).then(function() {
        var length,
            statements;

        length = octoberOpenPrs.length;
        statements = ["It's now too late to start!", "Next time.", "Half way there, maybe next time.", "So close! Maybe next time.", "Way to go!", "Now you're just showing off."];
        if (length > 5) length = 5;

        if (req.xhr) {
          res.render('partials/prs', {prs: octoberOpenPrs, statement: statements[length], userImage: userImage});
        } else {
          res.render('index', {prs: octoberOpenPrs, statement: statements[length], username: req.query.username, userImage: userImage});
        }

        octoberOpenPrs = [];
    }).catch(function() {
        //res.render('partials/error');

        if (req.xhr) {
            res.render('partials/error');
        } else {
            res.render('index', {error: true, username: req.query.username});
        }

        octoberOpenPrs = [];
    });
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
