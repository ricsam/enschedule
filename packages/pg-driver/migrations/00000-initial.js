const { Sequelize } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable('Workers', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      pollInterval: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      definitions: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      workerId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      instanceId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      hostname: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastReached: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      lastRunId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable('Schedules', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      workerId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      handlerVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      signature: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      claimId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      eventId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      retries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1,
      },
      maxRetries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1,
      },
      retryFailedJobs: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      claimed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      runAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      runNow: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      handlerId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      cronExpression: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      numRuns: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lastRunId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      failureTriggerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable('Runs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      stdout: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },
      stderr: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      exitSignal: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      finishedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      scheduledToRunAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      handlerId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      handlerVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      scheduleTitle: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      workerTitle: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scheduleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      workerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add foreign key constraints
    await queryInterface.addConstraint('Runs', {
      fields: ['scheduleId'],
      type: 'foreign key',
      name: 'fk_run_schedule',
      references: {
        table: 'Schedules',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('Runs', {
      fields: ['workerId'],
      type: 'foreign key',
      name: 'fk_run_worker',
      references: {
        table: 'Workers',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('Schedules', {
      fields: ['lastRunId'],
      type: 'foreign key',
      name: 'fk_schedule_lastrun',
      references: {
        table: 'Runs',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('Workers', {
      fields: ['lastRunId'],
      type: 'foreign key',
      name: 'fk_worker_lastrun',
      references: {
        table: 'Runs',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('Schedules', {
      fields: ['failureTriggerId'],
      type: 'foreign key',
      name: 'fk_schedule_failuretrigger',
      references: {
        table: 'Schedules',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  down: async ({ context: queryInterface }) => {
    // Drop tables in reverse order to avoid foreign key constraints
    await queryInterface.dropTable('Runs');
    await queryInterface.dropTable('Schedules');
    await queryInterface.dropTable('Workers');
  }
};
