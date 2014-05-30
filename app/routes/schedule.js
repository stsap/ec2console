var defs = require("../lib/defines");
var cron = require("cron").CronJob;
var fs = require("fs");
var instances = require("../routes/instances");

exports.set = function (req, res) {
    fs.writeFileSync("./config/schedule.json", JSON.stringify(req.body));
    defs.schedule = req.body;
    res.send({schedule: req.body});
    _runJobs();
};

exports._runJobs = function () {
    _runJobs();
};

function _runJobs () {
    _stopJobs();
    var s = fs.readFileSync("./config/schedule.json", "utf-8");
    if (!s) s = "{}";
    var schedules = JSON.parse(s);
    if (_(schedules).has("run")) {
        _(schedules.run).forEach(function (schedule, id) {
            if (!schedule.enable) return;
            console.log("run scheduled: " + id);
            _runJob(id, schedule.schedule, "run");
        });
    }
    if (_(schedules).has("stop")) {
        _(schedules.stop).forEach(function (schedule, id) {
            if (!schedule.enable) return;
            console.log("stop scheduled: " + id);
            _runJob(id, schedule.schedule, "stop");
        });
    }
};

function _runJob (id, schedule, mode) {
    var job = new cron({
        cronTime: schedule,
        onTick: function () {
            if (mode === "run") instances._runInstance("ap-northeast-1", id);
            if (mode === "stop") instances._stopInstance("ap-northeast-1", id);
        },
        start: false,
        timeZone: "Japan/Tokyo"
    });
    job.start();
    if (!_(defs).has("jobs")) defs["jobs"] = [];
    defs.jobs.push(job);
}

function _stopJobs () {
    if (!_(defs).has("jobs")) return;
    _(defs.jobs).forEach(function (job) {
        job.stop();
    });
}
