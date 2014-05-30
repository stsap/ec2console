
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var cron = require("cron").CronJob;
var fs = require("fs");

// global..
_ = require("underscore");

var defines = require("./lib/defines");

/** AWSSDK */
var AWS = require("aws-sdk");
AWS.config.loadFromPath('config/aws.json');
/** AWS.Request.promise() */
AWS.Request.prototype.promise = function () {
    var deferred = require("q").defer();
    this.on("complete", function (res) {
        if (res.error) deferred.reject(res.error);
        else deferred.resolve(res.data);
    });
    this.send();
    return deferred.promise;
};
defines.AWS = AWS;

var exc = fs.readFileSync("config/excludes.json", "utf-8");
if (!exc) exc = "{}";
defines.excludes = JSON.parse(exc);
var sched = fs.readFileSync("config/schedule.json", "utf-8");
if (!sched) sched = "{}";
defines.schedule = JSON.parse(sched);

/** get regions */
new AWS.EC2().describeRegions().promise()
    .then(function (result) {
        var regions = _(result.Regions).map(function (obj) { return obj.RegionName });
        defines.regions = regions;
    });
/** routes */
var instances = require("./routes/instances");
var regions = require("./routes/regions");
var schedule = require("./routes/schedule");
schedule._runJobs();

var app = express();


// all environments
app.set('port', process.env.PORT || 3000);
//app.set('views', path.join(__dirname, 'views'));
app.set('views', path.join(__dirname, 'public'));
app.engine('html', require('ejs').renderFile);
//app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));


// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}
app.get('/', routes.index);
app.get('/instances/get', instances.get);
app.get('/instances/run', instances.run);
app.get('/instances/stop', instances.stop);
app.get('/regions/get', regions.get);
app.post('/schedule/set', schedule.set);

http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
