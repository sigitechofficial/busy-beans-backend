# Use the official Node.js 22 image as the base image
FROM node:22

# Author of the Dockerfile
LABEL author="Ali Hamza"

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./

# Install all dependencies (including socket.io, if declared in package.json)
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port your application runs on
EXPOSE 8011

# Start the application
CMD ["node", "testbb.js"]





