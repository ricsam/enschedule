const { Sequelize } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    // Add new fields to existing tables
    await queryInterface.addColumn("Workers", "access", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("Workers", "defaultFunctionAccess", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("Workers", "defaultScheduleAccess", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("Workers", "defaultRunAccess", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn("Schedules", "defaultRunAccess", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("Schedules", "access", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn("Runs", "access", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Create new tables
    await queryInterface.createTable("Users", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      admin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.createTable("Groups", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      groupName: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.createTable("Sessions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      refreshToken: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.createTable("ApiKeys", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.DATE,
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

    // Create join table for User-Group many-to-many relationship
    await queryInterface.createTable("UserGroupAssociation", {
      UserId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      GroupId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Groups",
          key: "id",
        },
        onDelete: "CASCADE",
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
};
