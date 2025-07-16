const {
  countryInSystem,
  stateInSystem,
  territory,
  cityInSystem,
  address,
  billingAddress,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAllCountries = factory.getAll(countryInSystem);
exports.getCountry = factory.getOne(countryInSystem);
exports.createCountry = factory.createOne(countryInSystem, ['name']);
exports.updateCountry = factory.updateOne(countryInSystem);
// exports.deleteCountry = factory.softdelete(countryInSystem);

exports.deleteCountry = catchAsync(async (req, res, next) => {
  await countryInSystem.update(
    { deleted: true },
    {
      where: { id: req.params.id },
    },
  );

  await stateInSystem.update(
    { deleted: true },
    {
      where: { countryInSystemId: req.params.id },
    },
  );

  await cityInSystem.update(
    { deleted: true },
    {
      where: { countryInSystemId: req.params.id },
    },
  );

  await territory.update(
    { deleted: true },
    {
      where: { countryInSystemId: req.params.id },
    },
  );
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.getAllStates = factory.getAll(stateInSystem);
exports.getState = factory.getOne(stateInSystem);
exports.createState = factory.createOne(stateInSystem, ['name']);
exports.updateState = factory.updateOne(stateInSystem);
// exports.deleteState = factory.softdelete(stateInSystem);

exports.deleteState = catchAsync(async (req, res, next) => {
  await stateInSystem.update(
    { deleted: true },
    {
      where: { id: req.params.id },
    },
  );

  await cityInSystem.update(
    { deleted: true },
    {
      where: { stateInSystemId: req.params.id },
    },
  );

  await territory.update(
    { deleted: true },
    {
      where: { stateInSystemId: req.params.id },
    },
  );
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.updateAddress = factory.updateOne(address);
exports.updateBillingAddress = factory.updateOne(billingAddress);

// exports.createCity = catchAsync(async (req, res, next) => {
//   const  {name,countryInSystemId,stateInSystemId} = req.body

//   const input = name.map((ele) => ({
//   name: ele,
//   countryInSystemId,
//   stateInSystemId,
// }));
//   const t = await cityInSystem.bulkCreate(input);
//   res.status(200).json({
//     status: 'success',
//     data: {},
//   });
// });

exports.getAllCities = factory.getAll(cityInSystem);
exports.getCity = factory.getOne(cityInSystem);
exports.createCity = factory.createOne(cityInSystem, ['name']);
exports.updateCity = factory.updateOne(cityInSystem);
exports.deleteCity = factory.softdelete(cityInSystem);

exports.createTerritory = catchAsync(async (req, res, next) => {
  const t = await territory.create(req.body);
  cityInSystem.update(
    { territoryId: t?.id },
    { where: { id: req.body?.cities } },
  );
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.getAllTerritory = catchAsync(async (req, res, next) => {
  const t = await territory.findAll({
    where: { stateInSystemId: req.query?.stateInSystemId, deleted: false },
    include: { model: cityInSystem, where: { deleted: false } },
  });

  res.status(200).json({
    status: 'success',
    data: { results: t },
  });
});

exports.addCitiesInTerritory = catchAsync(async (req, res, next) => {
  await cityInSystem.update(
    { territoryId: req.params?.t_id },
    { where: { id: req.body?.cities } },
  );

  res.status(200).json({
    status: 'success',
    data: {},
  });
});

// exports.getAllTerritory = factory.getAll(territory);

exports.getTerritory = factory.getOne(territory);

// exports.createTerritory = factory.createOne(territory,['name']);

exports.updateTerritory = factory.updateOne(territory);

// exports.deleteTerritory = factory.deleteOne(territory);

exports.deleteTerritory = catchAsync(async (req, res, next) => {
  await territory.update(
    { deleted: true },
    {
      where: { id: req.params.id },
    },
  );

  await cityInSystem.update(
    { deleted: true },
    {
      where: { stateInSystemId: req.params.id },
    },
  );

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
