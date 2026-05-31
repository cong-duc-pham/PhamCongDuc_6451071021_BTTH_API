const config = require("../shared/config");

function createCircuitBreaker(name) {
  let consecutiveFailures = 0;
  let openedUntil = 0;

  return {
    canCall() {
      return Date.now() >= openedUntil;
    },
    success() {
      consecutiveFailures = 0;
      openedUntil = 0;
    },
    failure() {
      consecutiveFailures += 1;
      if (consecutiveFailures >= config.rules.circuitBreakerFailures) {
        openedUntil = Date.now() + config.rules.circuitBreakerCooldownMs;
      }
    },
    snapshot() {
      return {
        name,
        consecutiveFailures,
        openedUntil
      };
    }
  };
}

module.exports = {
  createCircuitBreaker
};
