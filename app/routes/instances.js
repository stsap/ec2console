var defs = require("../lib/defines");

function getInstances (instanceId) {
    var opts = {};
    var ec2 = new defs.AWS.EC2();
    if (instanceId) opts["InstanceIds"] = [instanceId];
    // @TODO: 全リージョン対象にするには別インスタンスにしてwhenなのか？
    return ec2.describeInstances(opts).promise();
}

exports.get = function (req, res) {
    res.contentType("application/json");
//    var reg = new RegExp("^(?:" + defs.excludes.join("|") + ")$");
    getInstances().done(function (result) {
        var filtered = _(result.Reservations).filter(function (r) {
            return !_(defs.excludes).find(function (e) { return e === r.Instances[0].InstanceId });
        });
/*
        var filtered = _.reject(result.Reservations, function (r) {
            return _.find(defs.excludes, function (ex) { ex === r.Instances[0].InstanceId});
        });
*/
        result.Reservations = filtered;
        res.send({instances: result, schedule: defs.schedule});
    });
};

exports.run = function(req, res) {
    res.contentType("application/json");
    var d = exports._runInstance(req.param("region"), req.param("id"));
    d.then(function (result) {
        var timer = setInterval(function () {
            getInstances(req.param("id")).then(function (result) {
                if (result.Reservations[0].Instances[0].State.Name === "running") {
                    clearInterval(timer);
                    getInstances().then(function (result) { res.send({instances: result, schedule: defs.schedule}); });
                }
            });
        }, 5000);
    });
};

exports._runInstance = function (region, id) {
    defs.AWS.config.update(region);
    var ec2 = new defs.AWS.EC2();
    return ec2.startInstances({InstanceIds: [id]}).promise();
}

exports.stop = function (req, res) {
    res.contentType("application/json");
    var d = exports._stopInstance(req.param("region"), req.param("id"));
    d.then(function (result) {
        var timer = setInterval(function () {
            getInstances(req.param("id")).then(function (result) {
                if (result.Reservations[0].Instances[0].State.Name === "stopped") {
                    clearInterval(timer);
                    getInstances().then(function (result) { res.send({instances: result, schedule: defs.schedule}); });
                }
            });
        }, 5000);
    });
};

exports._stopInstance = function (region, id) {
    defs.AWS.config.update(region);
    var ec2 = new defs.AWS.EC2();
    return ec2.stopInstances({InstanceIds: [id]}).promise();
}
