const logger = require("../shared/logger");

async function simulateFacebookAction(command) {
  if (process.env.SIMULATE_FACEBOOK_FAILURE === "1") {
    throw new Error("simulated_facebook_api_failure");
  }

  logger.info("simulated facebook api action", {
    action: command.action,
    targetId: command.targetId,
    eventId: command.eventId
  });

  return { ok: true };
}

module.exports = {
  simulateFacebookAction
};
