const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');
const { ModelName } = require('../models'); // Replace with your actual model name
const APIFeatures = require('../utils/apiFeatures');

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

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const input = req.body;
    if (req.file) {
      // throw new  'Image not uploaded', 'Please upload image';
      const tmpPath = req.file.path;
      const imagePath = tmpPath.replace(/\\/g, '/');
      input.image = imagePath;
    } else {
      input.image = undefined;
    }
    const doc = await Model.update(input, {
      where: { id: req.params.id },
      returning: true,
      plain: true,
    });

    if (!doc[1]) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc[1],
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

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

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = {};
    if (req.params.id) filter.id = req.params.id;

    const features = new APIFeatures(Model, req.query) // Pass the Model and query parameters
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const doc = await Model.findAll(features.getQuery()); // Apply queryOptions to the findAll method

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        data: doc,
      },
    });
  });
