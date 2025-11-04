require('dotenv').config();
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');
const { salesRep, supplier } = require('../models'); // Replace with your actual model name
const APIFeatures = require('../utils/apiFeatures');
const REDIS = require('../utils/redisHandling');
const {
  deleteDeviceTokenMultiple,
  deleteDeviceTokenSingle,
} = require('../utils/deviceTokenDelete');

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.destroy({
      where: { id: req.params.id },
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc[1],
      },
    });
  });

exports.softdelete = (Model, changes) =>
  catchAsync(async (req, res, next) => {
    const input = changes || {};
    input.deleted = true;

    const doc = await Model.update(input, {
      where: { id: req.params.id },
    });

    res.status(200).json({
      status: 'success',
      data: {
        data: doc[1],
      },
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    console.log('🚀 ~ catchAsync ~ UPDATE input:');

    const input = req.body;
    // input.password = undefined;
    if (req.file) {
      // throw new  'Image not uploaded', 'Please upload image';
      const tmpPath = req.file.path;
      const imagePath = tmpPath.replace(/\\/g, '/');
      input.image = imagePath;
      console.log('🚀 ~ catchAsync ~ nput.image:', input.image);
    } else {
      input.image = undefined;
      console.log('🚀 ~ c ~ input.image:', input.image);
    }
    const doc = await Model.update(input, {
      where: { id: req.params.id },
      individualHooks: true,
    });

    if (Model == supplier) {
      console.log('🚀 ~ catchAsync ~ UPDATE SUPPLIER:');
      console.log('🚀 ~ catchAsync ~ UPDATE SUPPLIER:');
      console.log('🚀 ~ catchAsync ~ UPDATE SUPPLIER:');
      console.log('🚀 ~ catchAsync ~ UPDATE SUPPLIER:');

      deleteDeviceTokenMultiple({
        id: req.params.id,
        entity: 'supplier',
        tokenCondition: { supplierId: req.params.id },
      });
    } else if (Model == salesRep) {
      console.log('🚀 ~ catchAsync ~ UPDATE LOCALPATNER:');
      console.log('🚀 ~ catchAsync ~ UPDATE LOCALPATNER:');
      console.log('🚀 ~ catchAsync ~ UPDATE LOCALPATNER:');
      console.log('🚀 ~ catchAsync ~ UPDATE LOCALPATNER:');
      deleteDeviceTokenMultiple({
        id: req.params.id,
        entity: 'localPartner',
        tokenCondition: { salesRepId: req.params.id },
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model, checks) =>
  catchAsync(async (req, res, next) => {
    const input = req.body;
    if (checks && checks.length > 0) {
      const condition = { deleted: 0 };
      checks.forEach((field) => {
        if (req.body[field]) {
          condition[field] = req.body[field];
        }
      });
      const exist = await Model.findOne({
        where: condition,
        attributes: ['id'],
      });
      if (exist) {
        return next(new AppError('Already Exist', 400));
      }
    }
    if (req.file) {
      // throw new  'Image not uploaded', 'Please upload image';
      const tmpPath = req.file.path;
      const imagePath = tmpPath.replace(/\\/g, '/');
      input.image = imagePath;
      console.log('🚀 ~ catchAsync ~ nput.image:', input.image);
    } else {
      input.image = undefined;
      console.log('🚀 ~ c ~ input.image:', input.image);
    }

    const doc = await Model.create(input);

    res.status(201).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getOne = (Model, includeOptions) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByPk(req.params.id, {
      include: includeOptions, // for related models
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model, incommingFilter = {}) =>
  catchAsync(async (req, res, next) => {
    let filter = incommingFilter;
    if (req.params.id) filter.id = req.params.id;

    const features = new APIFeatures(Model, req.query) // Pass the Model and query parameters
      .filter()
      .sort()
      .limitFields()
      .paginate();

    console.log('🚀 ~ features:', features);

    const doc = await Model.findAll(features.getQuery()); // Apply queryOptions to the findAll method

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        data: doc,
      },
    });
  });
