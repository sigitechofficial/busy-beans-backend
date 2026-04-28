const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Busy Beans Coffee API",
      version: "1.0.0",
      description:
        "API documentation for Busy Beans Coffee backend application",
      contact: {
        name: "API Support",
        email: "support@busybeans.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 8011}`,
        description: "Development server",
      },
      {
        url: "https://testingbb.trimworldwide.com",
        description: "Testing server",
      },
      {
        url: "https://api.busybeans.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User and admin authentication endpoints",
      },
      {
        name: "Users",
        description: "User management endpoints",
      },
      {
        name: "Admin",
        description: "Admin management endpoints",
      },
      {
        name: "Orders",
        description: "Order management endpoints",
      },
      {
        name: "Products",
        description: "Product management endpoints",
      },
      {
        name: "Subscriptions",
        description: "Subscription management endpoints",
      },
      {
        name: "Leads",
        description: "Lead management endpoints",
      },
      {
        name: "QuickBooks",
        description: "QuickBooks integration endpoints",
      },
    ],
  },
  apis: ["./routes/*.js", "./controllers/**/*.js"], // Path to the API files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
