
exports.get = function (req, res) {
    var defs = require("../lib/defines");
    res.contentType("application/json");
    res.send(defs.regions);
};

