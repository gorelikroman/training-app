FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . ./

# Make start script executable
RUN chmod +x ./start-dev.sh

# Expose ports for the API server and Vite dev server
EXPOSE 3000 5173

# Command to run both servers
CMD ["./start-dev.sh"]
