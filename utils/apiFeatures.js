const { Op } = require("sequelize");
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
    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((field) => delete queryObj[field]);

    const filterConditions = {
      deleted: 0,
    };

    Object.keys(queryObj).forEach((key) => {
      const value = queryObj[key];

      // ✅ Handle advanced filtering like: statusId: { ne: '6' }
      if (typeof value === "object" && value !== null) {
        filterConditions[key] = {};

        Object.keys(value).forEach((op) => {
          const sequelizeOp = operatorMap[op];
          if (sequelizeOp) {
            filterConditions[key][sequelizeOp] = this._castValue(value[op]);

            const keys = Reflect.ownKeys(filterConditions[key]);
            const isSymbolUsed = keys.some((k) => typeof k === "symbol");
            if (!isSymbolUsed) {
              console.warn(
                `❌ Sequelize operator [${op}] not applied as symbol for ${key}`
              );
            } else {
              console.log(
                `✅ Sequelize operator [${op}] correctly applied as symbol for ${key}`
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
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (typeof value === "string" && value.trim() !== "" && !isNaN(value))
      return Number(value);
    if (typeof value === "string" && value.includes(",")) {
      return value.split(",").map((v) => this._castValue(v));
    }
    return value;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort
        .split(",")
        .map((field) => field.trim());
      const sortConditions = sortBy.map((field) => {
        if (field.startsWith("-")) {
          return [field.slice(1), "DESC"];
        }
        return [field, "ASC"];
      });
      this.queryOptions.order = sortConditions;
    } else {
      this.queryOptions.order = [["id", "DESC"]]; // Default sort by createdAt descending
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields
        .split(",")
        .map((field) => field.trim());
      this.queryOptions.attributes = fields;
    } else {
      // Default: exclude specific fields if needed
      this.queryOptions.attributes = { exclude: ["deletedAt"] };
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || undefined;
    const offset = (page - 1) * limit;

    this.queryOptions.limit = limit || 10000;
    this.queryOptions.offset = offset || 0;

    return this;
  }

  /**
   * Add search functionality across multiple columns
   * @param {Array<string>} searchFields - Array of column names to search in
   * @returns {this} Returns the APIFeatures instance for chaining
   */
  search(searchFields = []) {
    if (this.queryString.search && searchFields.length > 0) {
      const searchTerm = this.queryString.search.trim();

      if (searchTerm) {
        // Create search conditions for each field
        const searchConditions = searchFields.map((field) => ({
          [field]: {
            [Op.like]: `%${searchTerm}%`,
          },
        }));

        // Add search conditions to existing where clause using Op.or
        if (this.queryOptions.where) {
          // If there are existing conditions, wrap them with Op.and
          const existingWhere = this.queryOptions.where;
          this.queryOptions.where = {
            [Op.and]: [
              existingWhere,
              {
                [Op.or]: searchConditions,
              },
            ],
          };
        } else {
          // If no existing conditions, just use Op.or
          this.queryOptions.where = {
            [Op.or]: searchConditions,
          };
        }
      }
    }

    return this;
  }

  getQuery() {
    return this.queryOptions; // Return the complete query options for use in the Sequelize query
  }

  /**
   * Get pagination metadata based on the current query conditions
   * @param {Object} Model - Sequelize model to count
   * @param {Object} additionalQueryOptions - Additional query options (include, where, etc.) to merge with count query
   * @returns {Promise<Object>} Pagination metadata object with page, limit, totalItems, totalPages
   */
  async getPaginationMetadata(Model, additionalQueryOptions = {}) {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10000;

    // Create count query options (same conditions but without limit, offset, attributes, order)
    const countOptions = {
      where: this.queryOptions.where,
      distinct: true, // Required when counting with includes that have one-to-many relationships
    };

    // Merge additional query options (like includes, additional where conditions)
    if (additionalQueryOptions.include) {
      countOptions.include = additionalQueryOptions.include;
    }

    if (additionalQueryOptions.where) {
      countOptions.where = {
        ...countOptions.where,
        ...additionalQueryOptions.where,
      };
    }

    // Get total count
    const totalItems = await Model.count(countOptions);

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / limit);

    return {
      page,
      limit,
      totalItems,
      totalPages,
    };
  }
}

module.exports = APIFeatures;
