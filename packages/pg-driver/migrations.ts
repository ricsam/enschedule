import type { QueryInterface } from "sequelize";
import { DataTypes } from "sequelize";
import type { RunnableMigration } from "umzug";

export const migrations: RunnableMigration<QueryInterface>[] = [
  {
    name: "00000-initial",
    up: async ({ context: queryInterface }) => {
      await queryInterface.createTable("Workers", {
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
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      });

      await queryInterface.createTable("Schedules", {
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
        handlerVersion: {
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
        handlerId: {
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
        },
        failureTriggerId: {
          type: DataTypes.INTEGER,
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
      });

      await queryInterface.createTable("Runs", {
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
        handlerId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        handlerVersion: {
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
        },
        workerId: {
          type: DataTypes.INTEGER,
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
      });

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
      });
    },

    down: async ({ context: queryInterface }) => {
      // Drop tables in reverse order to avoid foreign key constraints
      await queryInterface.dropTable("Runs");
      await queryInterface.dropTable("Schedules");
      await queryInterface.dropTable("Workers");
    },
  },
  {
    name: "00001-add-user-models-and-access-control",
    up: async ({ context: queryInterface }) => {
      // Add new fields to existing tables
      await queryInterface.addColumn("Workers", "access", {
        type: DataTypes.JSON,
        allowNull: true,
      });
      await queryInterface.addColumn("Workers", "defaultFunctionAccess", {
        type: DataTypes.JSON,
        allowNull: true,
      });
      await queryInterface.addColumn("Workers", "defaultScheduleAccess", {
        type: DataTypes.JSON,
        allowNull: true,
      });
      await queryInterface.addColumn("Workers", "defaultRunAccess", {
        type: DataTypes.JSON,
        allowNull: true,
      });

      await queryInterface.addColumn("Schedules", "defaultRunAccess", {
        type: DataTypes.JSON,
        allowNull: true,
      });
      await queryInterface.addColumn("Schedules", "access", {
        type: DataTypes.JSON,
        allowNull: true,
      });

      await queryInterface.addColumn("Runs", "access", {
        type: DataTypes.JSON,
        allowNull: true,
      });

      // Create new tables
      await queryInterface.createTable("Users", {
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
      });

      await queryInterface.createTable("Groups", {
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
      });

      await queryInterface.createTable("Sessions", {
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
      });

      await queryInterface.createTable("ApiKeys", {
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
      });

      // Create join table for User-Group many-to-many relationship
      await queryInterface.createTable("UserGroupAssociation", {
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
      });

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
      });
    },

    down: async ({ context: queryInterface }) => {
      // Remove new fields from existing tables
      await queryInterface.removeColumn("Workers", "access");
      await queryInterface.removeColumn("Workers", "defaultFunctionAccess");
      await queryInterface.removeColumn("Workers", "defaultScheduleAccess");
      await queryInterface.removeColumn("Workers", "defaultRunAccess");

      await queryInterface.removeColumn("Schedules", "defaultRunAccess");
      await queryInterface.removeColumn("Schedules", "access");

      await queryInterface.removeColumn("Runs", "access");

      // Drop new tables in reverse order
      await queryInterface.dropTable("UserGroupAssociation");
      await queryInterface.dropTable("ApiKeys");
      await queryInterface.dropTable("Sessions");
      await queryInterface.dropTable("Groups");
      await queryInterface.dropTable("Users");
    },
  },
  {
    name: "00002-improve-access-control-for-runs",
    up: async ({ context: queryInterface }) => {
      // Remove the 'access' column from the 'Runs' table
      await queryInterface.removeColumn("Runs", "access");

      // Create new tables for access control
      await queryInterface.createTable("RunUserViewAccess", {
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
      });

      await queryInterface.createTable("RunGroupViewAccess", {
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
      });

      await queryInterface.createTable("RunUserViewLogsAccess", {
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
      });

      await queryInterface.createTable("RunGroupViewLogsAccess", {
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
      });

      await queryInterface.createTable("RunUserDeleteAccess", {
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
      });

      await queryInterface.createTable("RunGroupDeleteAccess", {
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
      });

      // Add indexes to improve query performance
      await queryInterface.addIndex("RunUserViewAccess", ["RunId", "UserId"]);
      await queryInterface.addIndex("RunGroupViewAccess", ["RunId", "GroupId"]);
      await queryInterface.addIndex("RunUserViewLogsAccess", [
        "RunId",
        "UserId",
      ]);
      await queryInterface.addIndex("RunGroupViewLogsAccess", [
        "RunId",
        "GroupId",
      ]);
      await queryInterface.addIndex("RunUserDeleteAccess", ["RunId", "UserId"]);
      await queryInterface.addIndex("RunGroupDeleteAccess", [
        "RunId",
        "GroupId",
      ]);
    },

    down: async ({ context: queryInterface }) => {
      // Drop the new tables in reverse order
      await queryInterface.dropTable("RunGroupDeleteAccess");
      await queryInterface.dropTable("RunUserDeleteAccess");
      await queryInterface.dropTable("RunGroupViewLogsAccess");
      await queryInterface.dropTable("RunUserViewLogsAccess");
      await queryInterface.dropTable("RunGroupViewAccess");
      await queryInterface.dropTable("RunUserViewAccess");

      // Add back the 'access' column to the 'Runs' table
      await queryInterface.addColumn("Runs", "access", {
        type: DataTypes.JSON,
        allowNull: true,
      });
    },
  },
];
