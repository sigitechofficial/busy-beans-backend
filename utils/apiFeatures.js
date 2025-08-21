const { Op } = require('sequelize');
const operatorMap = {
  eq: Op.eq,
  ne: Op.ne,
  gt: Op.gt,
  gte: Op.gte,
  lt: Op.lt,
  lte: Op.lte,
  in: Op.in,
  notIn: Op.notIn,
  like: Op.like,
  notLike: Op.notLike,
};

class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.queryOptions = {}; // Store query options here
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((field) => delete queryObj[field]);

    const filterConditions = {
      deleted: 0,
    };

    Object.keys(queryObj).forEach((key) => {
      const value = queryObj[key];

      // ✅ Handle advanced filtering like: statusId: { ne: '6' }
      if (typeof value === 'object' && value !== null) {
        filterConditions[key] = {};

        Object.keys(value).forEach((op) => {
          const sequelizeOp = operatorMap[op];
          if (sequelizeOp) {
            filterConditions[key][sequelizeOp] = this._castValue(value[op]);

            const keys = Reflect.ownKeys(filterConditions[key]);
            const isSymbolUsed = keys.some((k) => typeof k === 'symbol');
            if (!isSymbolUsed) {
              console.warn(
                `❌ Sequelize operator [${op}] not applied as symbol for ${key}`,
              );
            } else {
              console.log(
                `✅ Sequelize operator [${op}] correctly applied as symbol for ${key}`,
              );
              console.log(`→ Field keys:`, keys);
            }
          } else {
            console.warn(`⚠️ Unsupported Sequelize operator: ${op}`);
          }
        });
      } else {
        // ✅ Simple equality like paymentStatus=pending
        filterConditions[key] = this._castValue(value);
      }
    });

    delete filterConditions.feature;
    delete filterConditions.sort;
    delete filterConditions.limit;
    delete filterConditions.page;
    delete filterConditions.fields;
    this.queryOptions.where = filterConditions;
    console.dir(filterConditions, { depth: null });
    return this;
  }

  // Helper method to convert string values to proper types

  _castValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value) && value.trim() !== '') return Number(value);
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map((v) => this._castValue(v));
    }
    return value;
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
      this.queryOptions.order = [['id', 'DESC']]; // Default sort by createdAt descending
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
    const limit = this.queryString.limit * 1 || undefined;
    const offset = (page - 1) * limit;

    // this.queryOptions.limit = limit;
    // this.queryOptions.offset = offset;

    return this;
  }

  getQuery() {
    return this.queryOptions; // Return the complete query options for use in the Sequelize query
  }
}

module.exports = APIFeatures;
