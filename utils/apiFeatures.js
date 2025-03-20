const { Op } = require('sequelize');

class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B) Advanced filtering
    const filterConditions = {};
    Object.keys(queryObj).forEach((key) => {
      if (
        queryObj[key].startsWith('gte') ||
        queryObj[key].startsWith('gt') ||
        queryObj[key].startsWith('lte') ||
        queryObj[key].startsWith('lt')
      ) {
        const operator = key.match(/(gte|gt|lte|lt)/)[0];
        filterConditions[key] = {
          [Op[operator]]: queryObj[key],
        };
      } else {
        filterConditions[key] = queryObj[key];
      }
    });

    // Apply filtering to Sequelize query
    this.query = this.query.where(filterConditions);

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort
        .split(',')
        .map((field) => field.trim());
      const sortConditions = sortBy.map((field) => {
        if (field.startsWith('-')) {
          return [field.slice(1), 'DESC'];
        }
        return [field, 'ASC'];
      });
      this.query = this.query.order(sortConditions);
    } else {
      this.query = this.query.order([['createdAt', 'DESC']]); // Default sort by createdAt descending
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields
        .split(',')
        .map((field) => field.trim());
      this.query = this.query.attributes(fields);
    } else {
      // Default: exclude specific fields if needed
      this.query = this.query.attributes({ exclude: ['deletedAt'] });
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const offset = (page - 1) * limit;

    this.query = this.query.limit(limit).offset(offset);

    return this;
  }
}

module.exports = APIFeatures;
