module.exports = (sequelize, DataTypes) => {
  const account = sequelize.define(
    'account',
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          args: true,
          msg: 'This email is already exist.',
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: 'accounts',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
      indexes: [
        {
          fields: ['email'],
          name: 'email_index',
        },
      ],
    },
  );
  return account;
};
