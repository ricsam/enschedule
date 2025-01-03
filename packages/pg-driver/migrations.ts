import type { QueryInterface } from "sequelize";
import { DataTypes } from "sequelize";
import type { RunnableMigration } from "umzug";

export const migrations: RunnableMigration<QueryInterface>[] = [
  {
    name: "00000-initial",
    up: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.createTable(
          "Workers",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            version: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            pollInterval: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            title: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            description: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            definitions: {
              type: DataTypes.JSON,
              allowNull: false,
            },
            workerId: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            instanceId: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true,
            },
            hostname: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            lastReached: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            lastRunId: {
              type: DataTypes.INTEGER,
              allowNull: true,
              onDelete: "SET NULL",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "Schedules",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            workerId: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            functionVersion: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            data: {
              type: DataTypes.TEXT,
              allowNull: false,
            },
            signature: {
              type: DataTypes.TEXT,
              allowNull: false,
            },
            claimId: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            eventId: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            retries: {
              type: DataTypes.INTEGER,
              allowNull: false,
              defaultValue: -1,
            },
            maxRetries: {
              type: DataTypes.INTEGER,
              allowNull: false,
              defaultValue: -1,
            },
            retryFailedJobs: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false,
            },
            title: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            description: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            claimed: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
            runAt: {
              type: DataTypes.DATE,
              allowNull: true,
            },
            runNow: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
            functionId: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            cronExpression: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            numRuns: {
              type: DataTypes.INTEGER,
              allowNull: false,
              defaultValue: 0,
            },
            lastRunId: {
              type: DataTypes.INTEGER,
              allowNull: true,
              onDelete: "SET NULL",
            },
            failureTriggerId: {
              type: DataTypes.INTEGER,
              allowNull: true,
              onDelete: "SET NULL",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "Runs",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            stdout: {
              type: DataTypes.TEXT,
              allowNull: false,
              defaultValue: "",
            },
            stderr: {
              type: DataTypes.TEXT,
              allowNull: false,
              defaultValue: "",
            },
            data: {
              type: DataTypes.TEXT,
              allowNull: false,
            },
            exitSignal: {
              type: DataTypes.TEXT,
              allowNull: true,
            },
            finishedAt: {
              type: DataTypes.DATE,
              allowNull: true,
            },
            startedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            scheduledToRunAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            functionId: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            functionVersion: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            scheduleTitle: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            workerTitle: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            scheduleId: {
              type: DataTypes.INTEGER,
              allowNull: true,
              onDelete: "SET NULL",
            },
            workerId: {
              type: DataTypes.INTEGER,
              allowNull: true,
              onDelete: "SET NULL",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        // Add foreign key constraints
        await queryInterface.addConstraint("Runs", {
          fields: ["scheduleId"],
          type: "foreign key",
          name: "fk_run_schedule",
          references: {
            table: "Schedules",
            field: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          transaction,
        });

        await queryInterface.addConstraint("Runs", {
          fields: ["workerId"],
          type: "foreign key",
          name: "fk_run_worker",
          references: {
            table: "Workers",
            field: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          transaction,
        });

        await queryInterface.addConstraint("Schedules", {
          fields: ["lastRunId"],
          type: "foreign key",
          name: "fk_schedule_lastrun",
          references: {
            table: "Runs",
            field: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          transaction,
        });

        await queryInterface.addConstraint("Workers", {
          fields: ["lastRunId"],
          type: "foreign key",
          name: "fk_worker_lastrun",
          references: {
            table: "Runs",
            field: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          transaction,
        });

        await queryInterface.addConstraint("Schedules", {
          fields: ["failureTriggerId"],
          type: "foreign key",
          name: "fk_schedule_failuretrigger",
          references: {
            table: "Schedules",
            field: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          transaction,
        });
      });
    },

    down: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Drop tables in reverse order to avoid foreign key constraints
        await queryInterface.dropTable("Runs", { transaction });
        await queryInterface.dropTable("Schedules", { transaction });
        await queryInterface.dropTable("Workers", { transaction });
      });
    },
  },
  {
    name: "00001-add-user-models-and-access-control",
    up: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Add new fields to existing tables
        await queryInterface.addColumn(
          "Workers",
          "access",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );
        await queryInterface.addColumn(
          "Workers",
          "defaultFunctionAccess",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );
        await queryInterface.addColumn(
          "Workers",
          "defaultScheduleAccess",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );
        await queryInterface.addColumn(
          "Workers",
          "defaultRunAccess",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );

        await queryInterface.addColumn(
          "Schedules",
          "defaultRunAccess",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );
        await queryInterface.addColumn(
          "Schedules",
          "access",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );

        await queryInterface.addColumn(
          "Runs",
          "access",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );

        // Create new tables
        await queryInterface.createTable(
          "Users",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            username: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            email: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            password: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            admin: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false,
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "Groups",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            groupName: {
              type: DataTypes.STRING,
              allowNull: false,
              unique: true,
            },
            title: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            description: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "Sessions",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            userId: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            refreshToken: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "ApiKeys",
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false,
            },
            userId: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            key: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            expiresAt: {
              type: DataTypes.DATE,
              allowNull: true,
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        // Create join table for User-Group many-to-many relationship
        await queryInterface.createTable(
          "UserGroupAssociation",
          {
            UserId: {
              type: DataTypes.INTEGER,
              references: {
                model: "Users",
                key: "id",
              },
              onDelete: "CASCADE",
            },
            GroupId: {
              type: DataTypes.INTEGER,
              references: {
                model: "Groups",
                key: "id",
              },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        // Add foreign key constraints
        await queryInterface.addConstraint("Sessions", {
          fields: ["userId"],
          type: "foreign key",
          name: "fk_session_user",
          references: {
            table: "Users",
            field: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
          transaction,
        });

        await queryInterface.addConstraint("ApiKeys", {
          fields: ["userId"],
          type: "foreign key",
          name: "fk_apikey_user",
          references: {
            table: "Users",
            field: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
          transaction,
        });
      });
    },

    down: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Remove new fields from existing tables
        await queryInterface.removeColumn("Workers", "access", { transaction });
        await queryInterface.removeColumn("Workers", "defaultFunctionAccess", {
          transaction,
        });
        await queryInterface.removeColumn("Workers", "defaultScheduleAccess", {
          transaction,
        });
        await queryInterface.removeColumn("Workers", "defaultRunAccess", {
          transaction,
        });

        await queryInterface.removeColumn("Schedules", "defaultRunAccess", {
          transaction,
        });
        await queryInterface.removeColumn("Schedules", "access", {
          transaction,
        });

        await queryInterface.removeColumn("Runs", "access", { transaction });

        // Drop new tables in reverse order
        await queryInterface.dropTable("UserGroupAssociation", { transaction });
        await queryInterface.dropTable("ApiKeys", { transaction });
        await queryInterface.dropTable("Sessions", { transaction });
        await queryInterface.dropTable("Groups", { transaction });
        await queryInterface.dropTable("Users", { transaction });
      });
    },
  },
  {
    name: "00002-improve-access-control-for-runs",
    up: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Remove the 'access' column from the 'Runs' table
        await queryInterface.removeColumn("Runs", "access", { transaction });

        // Create new tables for access control
        await queryInterface.createTable(
          "RunUserViewAccess",
          {
            RunId: {
              type: DataTypes.INTEGER,
              references: { model: "Runs", key: "id" },
              onDelete: "CASCADE",
            },
            UserId: {
              type: DataTypes.INTEGER,
              references: { model: "Users", key: "id" },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "RunGroupViewAccess",
          {
            RunId: {
              type: DataTypes.INTEGER,
              references: { model: "Runs", key: "id" },
              onDelete: "CASCADE",
            },
            GroupId: {
              type: DataTypes.INTEGER,
              references: { model: "Groups", key: "id" },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "RunUserViewLogsAccess",
          {
            RunId: {
              type: DataTypes.INTEGER,
              references: { model: "Runs", key: "id" },
              onDelete: "CASCADE",
            },
            UserId: {
              type: DataTypes.INTEGER,
              references: { model: "Users", key: "id" },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "RunGroupViewLogsAccess",
          {
            RunId: {
              type: DataTypes.INTEGER,
              references: { model: "Runs", key: "id" },
              onDelete: "CASCADE",
            },
            GroupId: {
              type: DataTypes.INTEGER,
              references: { model: "Groups", key: "id" },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "RunUserDeleteAccess",
          {
            RunId: {
              type: DataTypes.INTEGER,
              references: { model: "Runs", key: "id" },
              onDelete: "CASCADE",
            },
            UserId: {
              type: DataTypes.INTEGER,
              references: { model: "Users", key: "id" },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        await queryInterface.createTable(
          "RunGroupDeleteAccess",
          {
            RunId: {
              type: DataTypes.INTEGER,
              references: { model: "Runs", key: "id" },
              onDelete: "CASCADE",
            },
            GroupId: {
              type: DataTypes.INTEGER,
              references: { model: "Groups", key: "id" },
              onDelete: "CASCADE",
            },
            createdAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
            updatedAt: {
              type: DataTypes.DATE,
              allowNull: false,
            },
          },
          { transaction }
        );

        // Add indexes to improve query performance
        await queryInterface.addIndex(
          "RunUserViewAccess",
          ["RunId", "UserId"],
          { transaction }
        );
        await queryInterface.addIndex(
          "RunGroupViewAccess",
          ["RunId", "GroupId"],
          { transaction }
        );
        await queryInterface.addIndex(
          "RunUserViewLogsAccess",
          ["RunId", "UserId"],
          { transaction }
        );
        await queryInterface.addIndex(
          "RunGroupViewLogsAccess",
          ["RunId", "GroupId"],
          { transaction }
        );
        await queryInterface.addIndex(
          "RunUserDeleteAccess",
          ["RunId", "UserId"],
          { transaction }
        );
        await queryInterface.addIndex(
          "RunGroupDeleteAccess",
          ["RunId", "GroupId"],
          { transaction }
        );
      });
    },

    down: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Drop the new tables in reverse order
        await queryInterface.dropTable("RunGroupDeleteAccess", { transaction });
        await queryInterface.dropTable("RunUserDeleteAccess", { transaction });
        await queryInterface.dropTable("RunGroupViewLogsAccess", {
          transaction,
        });
        await queryInterface.dropTable("RunUserViewLogsAccess", {
          transaction,
        });
        await queryInterface.dropTable("RunGroupViewAccess", { transaction });
        await queryInterface.dropTable("RunUserViewAccess", { transaction });

        // Add back the 'access' column to the 'Runs' table
        await queryInterface.addColumn(
          "Runs",
          "access",
          {
            type: DataTypes.JSON,
            allowNull: true,
          },
          { transaction }
        );
      });
    },
  },
  {
    name: "00003-add-unique-constraint-to-eventid",
    up: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Add unique constraint to eventId
        await queryInterface.addConstraint("Schedules", {
          fields: ["eventId"],
          type: "unique",
          name: "schedules_eventid_unique",
          transaction,
        });
      });
    },

    down: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Remove unique constraint from eventId
        await queryInterface.removeConstraint(
          "Schedules",
          "schedules_eventid_unique",
          { transaction }
        );
      });
    },
  },
  {
    name: "00004-modify-run-logging-columns",
    up: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Add new logging-related columns
        await queryInterface.addColumn(
          "Runs",
          "logFile",
          {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          { transaction }
        );

        await queryInterface.addColumn(
          "Runs",
          "logFileSize",
          {
            type: DataTypes.INTEGER,
            allowNull: true,
          },
          { transaction }
        );

        await queryInterface.addColumn(
          "Runs",
          "logFileRowCount",
          {
            type: DataTypes.INTEGER,
            allowNull: true,
          },
          { transaction }
        );

        // Remove stdout and stderr columns
        await queryInterface.removeColumn("Runs", "stdout", { transaction });
        await queryInterface.removeColumn("Runs", "stderr", { transaction });
      });
    },

    down: async ({ context: queryInterface }) => {
      return queryInterface.sequelize.transaction(async (transaction) => {
        // Re-add stdout and stderr columns
        await queryInterface.addColumn(
          "Runs",
          "stdout",
          {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "",
          },
          { transaction }
        );

        await queryInterface.addColumn(
          "Runs",
          "stderr",
          {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "",
          },
          { transaction }
        );

        // Remove all new logging-related columns
        await queryInterface.removeColumn("Runs", "logFile", { transaction });
        await queryInterface.removeColumn("Runs", "logFileSize", {
          transaction,
        });
        await queryInterface.removeColumn("Runs", "logFileRowCount", {
          transaction,
        });
      });
    },
  },
];
