const { countryInSystem,stateInSystem,territory,cityInSystem } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAllCountries = factory.getAll(countryInSystem);
exports.getCountry = factory.getOne(countryInSystem);
exports.createCountry = factory.createOne(countryInSystem);
exports.updateCountry = factory.updateOne(countryInSystem);
exports.deleteCountry = factory.deleteOne(countryInSystem);

exports.getAllStates = factory.getAll(stateInSystem);
exports.getState = factory.getOne(stateInSystem);
exports.createState = factory.createOne(stateInSystem);
exports.updateState = factory.updateOne(stateInSystem);
exports.deleteState = factory.deleteOne(stateInSystem);

exports.getAllCities = factory.getAll(cityInSystem);
exports.getCity = factory.getOne(cityInSystem);
exports.createCity = factory.createOne(cityInSystem);
exports.updateCity = factory.updateOne(cityInSystem);
exports.deleteCity = factory.deleteOne(cityInSystem);

exports.getAllTerritory = factory.getAll(territory);
exports.getTerritory = factory.getOne(territory);
exports.createTerritory = factory.createOne(territory);
exports.updateTerritory = factory.updateOne(territory);
exports.deleteTerritory = factory.deleteOne(territory);
