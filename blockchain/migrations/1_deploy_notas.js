const Notas = artifacts.require("Notas");

module.exports = function (deployer) {
  deployer.deploy(Notas);
};
