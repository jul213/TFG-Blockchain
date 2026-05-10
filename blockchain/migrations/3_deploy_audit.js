const AuditTrail = artifacts.require("AuditTrail");

module.exports = function (deployer) {
  deployer.deploy(AuditTrail);
};
