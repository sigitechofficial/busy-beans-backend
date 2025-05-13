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


exports.createTerritory = catchAsync(async (req, res, next) => {
 
  const t = await territory.create(req.body);

  cityInSystem.update({territoryId:t?.id},{where:{id:req.body?.cities}})


  res.status(200).json({
    status: 'success',
    data: {},
  });
});


exports.getAllTerritory = catchAsync(async (req, res, next) => {
 
  console.log("🚀 ~ exports.getAllTerritory=catchAsync ~ getAllTerritory:")
  console.log("🚀 ~ exports.getAllTerritory=catchAsync ~ getAllTerritory:")
  console.log("🚀 ~ exports.getAllTerritory=catchAsync ~ getAllTerritory:")
  console.log("🚀 ~ exports.getAllTerritory=catchAsync ~ getAllTerritory:")
  console.log("🚀 ~ exports.getAllTerritory=catchAsync ~ getAllTerritory:")
  console.log("🚀 ~ exports.getAllTerritory=catchAsync ~ getAllTerritory:")
  const t = await territory.findAll({where:{stateInSystemId:req.query?.stateInSystemId},include:{model:cityInSystem}});
 
  res.status(200).json({
    status: 'success',
    data: {results:t},
  });
});


exports.addCitiesInTerritory = catchAsync(async (req, res, next) => {

  await cityInSystem.update({territoryId:req.params?.t_id},{where:{id:req.body?.cities}})
 
  res.status(200).json({
    status: 'success',
    data: {},
  });
});


// exports.getAllTerritory = factory.getAll(territory);

exports.getTerritory = factory.getOne(territory);
// exports.createTerritory = factory.createOne(territory);
exports.updateTerritory = factory.updateOne(territory);
exports.deleteTerritory = factory.deleteOne(territory);
