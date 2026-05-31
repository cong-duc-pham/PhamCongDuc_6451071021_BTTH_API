const { Kafka, logLevel } = require("kafkajs");
const config = require("./config");
const logger = require("./logger");

let kafka;

function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: logLevel.NOTHING
    });
  }
  return kafka;
}

async function createProducer() {
  const producer = getKafka().producer({
    idempotent: true,
    maxInFlightRequests: 1,
    allowAutoTopicCreation: true
  });
  await producer.connect();
  return producer;
}

async function publish(producer, topic, event, key = event.eventId || event.id) {
  await producer.send({
    topic,
    acks: -1,
    messages: [
      {
        key: key ? String(key) : undefined,
        value: JSON.stringify(event),
        headers: {
          schema: event.schemaVersion || "unknown",
          publishedAt: new Date().toISOString()
        }
      }
    ]
  });
  logger.info("published kafka message", { topic, key });
}

async function createConsumer(groupId, topics, handler) {
  const consumer = getKafka().consumer({
    groupId,
    allowAutoTopicCreation: true,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576
  });
  await consumer.connect();

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }

  await consumer.run({
    autoCommit: false,
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value ? message.value.toString("utf8") : "{}";
      const payload = JSON.parse(raw);
      await handler(payload, { topic, partition, offset: message.offset });
      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: (Number(message.offset) + 1).toString()
        }
      ]);
    }
  });

  return consumer;
}

module.exports = {
  createProducer,
  publish,
  createConsumer
};
