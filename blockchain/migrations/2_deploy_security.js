const SecurityManager = artifacts.require("SecurityManager");

module.exports = function (deployer) {
  deployer.deploy(SecurityManager);
};
