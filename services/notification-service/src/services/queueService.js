const Queue = require('bull');
const { logger } = require('../utils/logger');
const { QUEUE_NAMES, RETRY_SETTINGS } = require('../utils/constants');

let emailQueue = null;
let inAppQueue = null;

const initializeQueues = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Email Queue
    emailQueue = new Queue(QUEUE_NAMES.EMAIL_QUEUE, redisUrl, {
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.EMAIL.attempts,
        backoff: RETRY_SETTINGS.EMAIL.backoff,
        removeOnComplete: 50, // Keep last 50 completed jobs
        removeOnFail: 20, // Keep last 20 failed jobs
      },
    });

    // In-App Queue
    inAppQueue = new Queue(QUEUE_NAMES.IN_APP_QUEUE, redisUrl, {
      defaultJobOptions: {
        attempts: RETRY_SETTINGS.IN_APP.attempts,
        backoff: RETRY_SETTINGS.IN_APP.backoff,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    // Email Queue Processors
    emailQueue.process('send-email', require('./processors/emailProcessor'));
    emailQueue.process(
      'welcome-email',
      require('./processors/welcomeEmailProcessor')
    );
    emailQueue.process(
      'order-confirmation',
      require('./processors/orderConfirmationProcessor')
    );

    // In-App Queue Processors
    inAppQueue.process('send-in-app', require('./processors/inAppProcessor'));

    // Queue Event Handlers
    setupQueueEventHandlers();

    logger.info('✅ Job queues initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
};

const setupQueueEventHandlers = () => {
  // Email Queue Events
  emailQueue.on('completed', (job, result) => {
    logger.info('Email job completed', {
      jobId: job.id,
      type: job.name,
      result: result,
    });
  });

  emailQueue.on('failed', (job, err) => {
    logger.error('Email job failed', {
      jobId: job.id,
      type: job.name,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  emailQueue.on('stalled', (job) => {
    logger.warn('Email job stalled', {
      jobId: job.id,
      type: job.name,
    });
  });

  // In-App Queue Events
  inAppQueue.on('completed', (job, result) => {
    logger.info('In-app notification job completed', {
      jobId: job.id,
      userId: job.data.userId,
      result: result,
    });
  });

  inAppQueue.on('failed', (job, err) => {
    logger.error('In-app notification job failed', {
      jobId: job.id,
      userId: job.data.userId,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });
};

// Job Creation Functions
const addEmailJob = async (type, data, options = {}) => {
  try {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const job = await emailQueue.add(type, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options,
    });

    logger.info('Email job added to queue', {
      jobId: job.id,
      type: type,
      recipient: data.to,
      priority: options.priority || 0,
    });

    return job;
  } catch (error) {
    logger.error('Error adding email job to queue:', error);
    throw error;
  }
};

const addInAppJob = async (data, options = {}) => {
  try {
    if (!inAppQueue) {
      throw new Error('In-app queue not initialized');
    }

    const job = await inAppQueue.add('send-in-app', data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options,
    });

    logger.info('In-app notification job added to queue', {
      jobId: job.id,
      userId: data.userId,
      priority: options.priority || 0,
    });

    return job;
  } catch (error) {
    logger.error('Error adding in-app job to queue:', error);
    throw error;
  }
};

// Queue Statistics
const getQueueStats = async () => {
  try {
    const emailStats = emailQueue
      ? {
          waiting: await emailQueue.getWaiting().then((jobs) => jobs.length),
          active: await emailQueue.getActive().then((jobs) => jobs.length),
          completed: await emailQueue
            .getCompleted()
            .then((jobs) => jobs.length),
          failed: await emailQueue.getFailed().then((jobs) => jobs.length),
        }
      : null;

    const inAppStats = inAppQueue
      ? {
          waiting: await inAppQueue.getWaiting().then((jobs) => jobs.length),
          active: await inAppQueue.getActive().then((jobs) => jobs.length),
          completed: await inAppQueue
            .getCompleted()
            .then((jobs) => jobs.length),
          failed: await inAppQueue.getFailed().then((jobs) => jobs.length),
        }
      : null;

    return {
      email: emailStats,
      inApp: inAppStats,
    };
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    return {
      email: null,
      inApp: null,
      error: error.message,
    };
  }
};

// Queue Management
const pauseQueues = async () => {
  try {
    if (emailQueue) await emailQueue.pause();
    if (inAppQueue) await inAppQueue.pause();

    logger.info('All queues paused');
  } catch (error) {
    logger.error('Error pausing queues:', error);
    throw error;
  }
};

const resumeQueues = async () => {
  try {
    if (emailQueue) await emailQueue.resume();
    if (inAppQueue) await inAppQueue.resume();

    logger.info('All queues resumed');
  } catch (error) {
    logger.error('Error resuming queues:', error);
    throw error;
  }
};

const closeQueues = async () => {
  try {
    if (emailQueue) {
      await emailQueue.close();
      logger.info('Email queue closed');
    }

    if (inAppQueue) {
      await inAppQueue.close();
      logger.info('In-app queue closed');
    }

    logger.info('All queues closed successfully');
  } catch (error) {
    logger.error('Error closing queues:', error);
    throw error;
  }
};

// Retry failed jobs
const retryFailedJobs = async (queueType = 'all') => {
  try {
    let retriedCount = 0;

    if (queueType === 'all' || queueType === 'email') {
      if (emailQueue) {
        const failedJobs = await emailQueue.getFailed();
        for (const job of failedJobs) {
          await job.retry();
          retriedCount++;
        }
      }
    }

    if (queueType === 'all' || queueType === 'inapp') {
      if (inAppQueue) {
        const failedJobs = await inAppQueue.getFailed();
        for (const job of failedJobs) {
          await job.retry();
          retriedCount++;
        }
      }
    }

    logger.info(
      `Retried ${retriedCount} failed jobs for queue type: ${queueType}`
    );
    return retriedCount;
  } catch (error) {
    logger.error('Error retrying failed jobs:', error);
    throw error;
  }
};

module.exports = {
  initializeQueues,
  addEmailJob,
  addInAppJob,
  getQueueStats,
  pauseQueues,
  resumeQueues,
  closeQueues,
  retryFailedJobs,
  getEmailQueue: () => emailQueue,
  getInAppQueue: () => inAppQueue,
};
