FROM node:18-slim

# Set non-interactive mode for apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Preconfigure tzdata by installing it first
RUN apt-get update && \
    apt-get install -y --no-install-recommends tzdata

# Then install texlive-full and latexmk
RUN apt-get update && \
    apt-get install -y --no-install-recommends texlive-full latexmk && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install node dependencies
RUN npm install

# Copy the rest of the application code
COPY index.js ./

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the service
CMD ["npm", "start"]