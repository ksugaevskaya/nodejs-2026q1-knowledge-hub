# Knowledge Hub

A REST API for a **Knowledge Hub** platform using Nest.js framework. The Knowledge Hub allows users to create, edit, and organize articles by categories and tags.

## Prerequisites

- Node.js 24.x.x or higher - [Download & Install Node.js](https://nodejs.org/en/download/)
- npm package manager (comes with Node.js)
- Git - [Download & Install Git](https://git-scm.com/downloads)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/ksugaevskaya/nodejs-2026q1-knowledge-hub.git
cd nodejs-2026q1-knowledge-hub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=4000
```

The `.env.example` file with default values is already provided.

## Running the Application

### Development mode

```bash
npm start
```

### Watch mode (auto-reload on changes)

```bash
npm start:dev
```

### Production mode

First, build the application:

```bash
npm run build
```

Then run:

```bash
npm run start:prod
```

The application will start on the port specified in `.env` (default: 4000).

## API Documentation

Once the application is running, you can access the OpenAPI/Swagger documentation at:

```
http://localhost:4000/doc
```

For more information about OpenAPI/Swagger, visit https://swagger.io/.

## API Resources

The API provides endpoints for managing the following resources:

### Users (`/user`)

- GET `/user` - Get all users
- GET `/user/:id` - Get user by ID
- POST `/user` - Create a new user
- PUT `/user/:id` - Update user password
- DELETE `/user/:id` - Delete user

### Articles (`/article`)

- GET `/article` - Get all articles (supports filtering by `status`, `categoryId`, `tag`)
- GET `/article/:id` - Get article by ID
- POST `/article` - Create a new article
- PUT `/article/:id` - Update article
- DELETE `/article/:id` - Delete article

### Categories (`/category`)

- GET `/category` - Get all categories
- GET `/category/:id` - Get category by ID
- POST `/category` - Create a new category
- PUT `/category/:id` - Update category
- DELETE `/category/:id` - Delete category

### Comments (`/comment`)

- GET `/comment?articleId={articleId}` - Get comments for an article
- POST `/comment` - Create a new comment
- DELETE `/comment/:id` - Delete comment

## Testing

### Run all tests

```bash
npm run test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run specific test suite

```bash
npm run test -- <path-to-suite>
```

### Run all tests with authorization

```bash
npm run test:auth
```

### Run only specific test suite with authorization

```bash
npm run test:auth -- <path to suite>
```

### Run refresh token tests

```bash
npm run test:refresh
```

### Run RBAC (role-based access control) tests

```bash
npm run test:rbac
```

### Code coverage

```bash
npm run test:cov
```

## Code Quality

### Linting

```bash
npm run lint
```

### Code formatting

```bash
npm run format
```

## Debugging in VSCode

Press <kbd>F5</kbd> to debug.

For more information, visit: https://code.visualstudio.com/docs/editor/debugging
