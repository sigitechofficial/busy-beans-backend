// models/QboToken.js
module.exports = (sequelize, DataTypes) => {
  const qboToken = sequelize.define('qboToken', {
    realmId: { type: DataTypes.STRING, allowNull: true },
    accessToken: { type: DataTypes.TEXT, allowNull: true },
    refreshToken: { type: DataTypes.TEXT, allowNull: true },
    accessTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
    refreshTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  });
  return qboToken;
};
