const { Op } = require('sequelize');

class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.queryOptions = {}; // Store query options here
  }
 

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);
  
    const filterConditions = {};
  
    // Handle advanced filtering like ?price[gte]=100
    Object.keys(queryObj).forEach((key) => {
      if (key.includes('[')) {
        const [field, operator] = key.replace(']', '').split('[');
        if (!filterConditions[field]) {
          filterConditions[field] = {};
        }
        filterConditions[field][Op[operator]] = queryObj[key];
      } else {
        filterConditions[key] = queryObj[key];
      }
    });
  
    this.queryOptions.where = filterConditions;
  
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
      this.queryOptions.order = sortConditions;
    } else {
      this.queryOptions.order = [['createdAt', 'DESC']]; // Default sort by createdAt descending
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields
        .split(',')
        .map((field) => field.trim());
      this.queryOptions.attributes = fields;
    } else {
      // Default: exclude specific fields if needed
      this.queryOptions.attributes = { exclude: ['deletedAt'] };
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const offset = (page - 1) * limit;

    this.queryOptions.limit = limit;
    this.queryOptions.offset = offset;

    return this;
  }

  getQuery() {
    return this.queryOptions; // Return the complete query options for use in the Sequelize query
  }
}

module.exports = APIFeatures;
