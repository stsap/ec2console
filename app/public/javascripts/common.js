var messages = {
    stopConfirm: "を停止します。よろしいですか？"
};

var index = angular.module("index", ["ui.bootstrap"]);
index.run(function ($rootScope) { $rootScope._ = _; });
index.factory("net", function ($q, $http) {
    return {
        getInstances: function () {
            var d = $q.defer();
            $http.get("/instances/get")
                .success(function (data) { d.resolve(_rehashInstances(data)); })
                .error(function (data) { d.reject(); });
            return d.promise;
        },
        runInstance: function (id, region) {
            var d = $q.defer();
            $http.get("/instances/run?id=" + id + "&region=" + region)
                .success(function (data) { d.resolve(_rehashInstances(data)); })
                .error(function (data) { d.reject(); });
            return d.promise;
        },
        stopInstance: function (id, region) {
            var d = $q.defer();
            $http.get("/instances/stop?id=" + id + "&region=" + region)
                .success(function (data) { d.resolve(_rehashInstances(data)); })
                .error(function (data) { d.reject(); });
            return d.promise;
        },
        getRegions: function () {
            var d = $q.defer();
            $http.get("/regions/get")
                .success(function (data) { d.resolve(data); })
                .error(function (data) { d.reject(); });
            return d.promise;
        },
        setSchedule: function (schedule) {
            var d = $q.defer();
            $http.post("/schedule/set", schedule)
                .success(function (data) { d.resolve(data)})
                .error(function (data) { d.reject(); });
            return d.promise;
        }
    };
});

index.controller("aws", ["$scope", "net", "$modal", function ($scope, net, $modal) {
    $scope.reload = function () {
        var $self = this;
        $self.reloading = true;
        $scope.instances = null;
        $scope.search = "";
        _setActiveFilter("all", $scope);
        net.getInstances().then(function (data) {
            $scope.instances = data.instances;
            $scope.schedule = data.schedule;

            $self.reloading = false;
            $scope.runnings = (_(data.instances).chain()
                .filter(function (ins) { return ins.status === "running"; })
                .value()).length;
        });
    };
    /** on click */
    $scope.proc = function (id, region) {
        this.processing = true;
        if (this.i.status === "stopped") {
            net.runInstance(id, region)
                .then(function (data) {
                    this.processing = false;
                    $scope.instances = data.instances;
                    $scope.schedule = data.schedule;
                });
        } else {
            if (!confirm(this.i.name + messages.stopConfirm)) {
                this.processing = false;
                return;
            }
            net.stopInstance(id, region)
                .then(function (data) {
                    this.processing = false;
                    $scope.instances = data.instances;
                    $scope.instances = data.schedule;
                });
        }
        this.i.status = "pending";
    };
    $scope.filter = function (type) {
        _setActiveFilter(type, $scope);
        _filter($scope.instances, type, $scope.search);
    };
    $scope.openSchedule = function (id, name) {
        $modal.open({
            templateUrl: "schedule.html",
            controller: "schedule",
            resolve: {
                params: function () {
                    return {
                        id: id,
                        name: name,
                        schedule: $scope.schedule,
                        net: net
                    };
                }
            }
        });
    };

    /** on loads */
    $scope.reload();
}]);

index.controller("schedule", ["$scope", "$modalInstance", "params", "net", function ($scope, $modal, params, net) {
    $scope.id = params.id;
    $scope.name = params.name;
    $scope.schedule = _initializeScheduleData(params.schedule, params.id);

    var _parseCron = function (cron) {
        var result = _.map(cron, function (l) { return /\d+/.test(l) ? Number(l): ""; });
        return _.object(["min", "hour", "day", "month"], result);
    };
    $scope.runcron = _parseCron($scope.schedule.run[params.id].schedule.split(/\s/));
    $scope.stopcron = _parseCron($scope.schedule.stop[params.id].schedule.split(/\s/));

    $scope.ok = function (id) {
        // @TODO: directiveでのvalidateに書き直す。
        if ($scope.schedule.run[$scope.id].enable) {
            if ($scope.runcron.hour === undefined || $scope.runcron.min === undefined) {
                alert("schedule time is required.");
                return;
            }
            if ($scope.schedule.run[$scope.id].isDaily) {
                $scope.runcron.month = "*";
                $scope.runcron.day = "*";
            } else {
                if ($scope.runcron.month === undefined || $scope.runcron.day === undefined) {
                    alert("schedule date is required.");
                    return;
                }
            }
        } else {
            $scope.runcron = {};
        }
        if ($scope.schedule.stop[$scope.id].enable) {
            if ($scope.stopcron.hour === undefined || $scope.stopcron.min === undefined) {
                alert("schedule time is required.");
                return;
            }
            if ($scope.schedule.stop[$scope.id].isDaily) {
                $scope.stopcron.month = "*";
                $scope.stopcron.day = "*";
            } else {
                if ($scope.stopcron.month === undefined || $scope.stopcron.day === undefined) {
                    alert("schedule date is required.");
                    return;
                }
            }
        } else {
            $scope.stopcron = {};
        }
        var rc = $scope.runcron,
            sc = $scope.stopcron;
        var cronstring = _([rc.min, rc.hour, rc.day, rc.month, "*"]).join(" ");
        $scope.schedule.run[$scope.id].schedule = cronstring;
        cronstring = _([sc.min, sc.hour, sc.day, sc.month, "*"]).join(" ");
        $scope.schedule.stop[$scope.id].schedule = cronstring;
        net.setSchedule($scope.schedule);
        $modal.close();
    };
    $scope.cancel = function (id) { $modal.close(); };
}]);

function _setActiveFilter (type, $scope) {
    $scope.isAll = "";
    $scope.isRunnings = "";
    $scope.isStopped = "";
    if (type !== "word") {
        if (type === "runnings") {
            $scope.isRunnings = "active";
        } else if (type === "stopped") {
            $scope.isStopped = "active";
        } else {
            $scope.isAll = "active";
        }
    }
}

function _filter (instances, type, search) {
    var reg;
    if (type === "word") {
        if (!search) {
            type = "all";
        } else {
            reg = new RegExp(search, "i");
        }
    }
    _(instances).map(function (i) {
        if (type === "word") {
            i.show = (reg.test(i.name)) ? true: false;
        } else if (type === "runnings") {
            i.show = (i.status === "running") ? true: false;
        } else if (type === "stopped") {
            i.show = (i.status === "stopped") ? true: false;
        } else {
            i.show = true;
        }
    });
}
function _rehashInstances (data) {
    var instances = _(data.instances.Reservations).chain().
        filter(function (ins) { return ins.Instances[0].State.Name !== "terminated"; }).
        map(function (i) {
            var inss = i.Instances[0],
                hasNic = _(inss).has("NetworkInterfaces") && _(inss.NetworkInterfaces[0]).has("Association"),
                state = (inss.State.Name === "running" || inss.State.Name === "stopped") ? inss.State.Name: "pending";
            return {
                "name": (inss.Tags.length) ? _(inss.Tags).findWhere({Key: "Name"})["Value"]: "",
                "status": state,
                "ip": (hasNic) ? inss.NetworkInterfaces[0].Association.PublicIp: "",
                "control": (inss.State.Name === "stopped") ? "run": "stop",
                "controlClass": (inss.State.Name === "stopped") ? "btn-success": "btn-danger",
                "id": inss.InstanceId,
                "type": inss.InstanceType,
                "region": inss.Placement.AvailabilityZone.replace(/[a-zA-Z]$/, ""),
                "show": true
            };
        }).
        value();
    return {instances: instances, schedule: data.schedule};
}
function _initializeScheduleData (schedule, instanceId) {
    if (!_(schedule).has("run")) schedule["run"] = {};
    if (!_(schedule).has("stop")) schedule["stop"] = {};
    if (!_(schedule.run).has(instanceId)) schedule.run[instanceId] = {schedule: ""};
    if (!_(schedule.stop).has(instanceId)) schedule.stop[instanceId] = {schedule: ""};
    return schedule;
}
