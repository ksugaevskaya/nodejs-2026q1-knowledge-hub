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
npm install --force
```

### 3. Configure environment variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=4000
LOG_LEVEL=log
LOG_MAX_FILE_SIZE=1024

CRYPT_SALT=10
JWT_SECRET_KEY=secret123123
JWT_SECRET_REFRESH_KEY=secret123123
TOKEN_EXPIRE_TIME=1h
TOKEN_REFRESH_EXPIRE_TIME=24h

POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=knowledge_hub
POSTGRES_HOST=db
POSTGRES_PORT=5432

DATABASE_URL="postgresql://user:password@localhost:5432/knowledge_hub"
DATABASE_URL_DOCKER="postgresql://user:password@db:5432/knowledge_hub"

GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
RAG_VECTOR_DB_PROVIDER=qdrant
RAG_VECTOR_DB_URL=http://vectordb:6333
RAG_VECTOR_COLLECTION=knowledge_hub_articles
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=200
RAG_CONVERSATION_MAX_MESSAGES=20
AI_RATE_LIMIT_RPM=20
AI_CACHE_TTL_SEC=300
```

The `.env.example` file with default values is already provided.
`LOG_LEVEL` controls the minimum log verbosity (`error`, `warn`, `log`, `debug`, `verbose`), and `LOG_MAX_FILE_SIZE` sets the log rotation threshold in kilobytes.
Paste your Gemini key into `GEMINI_API_KEY` in the local `.env` file.

## Gemini API Setup

The RAG integration uses the Google Gemini HTTP API with:

- generation model: `gemini-2.0-flash`
- embedding model: `text-embedding-004`

### How to obtain a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Open the API key management page in AI Studio.
4. Create a new API key.
5. Copy the generated key.
6. Paste the key into `GEMINI_API_KEY` inside `.env`.

## Vector Database

This project uses `Qdrant` as the external vector database.

- Docker Compose service name: `vectordb`
- Internal application URL: `http://vectordb:6333`
- Persistent Docker volume: `qdrant_data`

## Running the Application

### Full startup flow after clone

1. Install dependencies:

```bash
npm install --force
```

2. Copy `.env.example` to `.env` and set a valid `GEMINI_API_KEY`.

3. Start the full stack:

```bash
docker compose up --build
```

This starts:

- Nest.js application
- PostgreSQL database
- Qdrant vector database

4. Wait until the API container logs:

```
LOG [NestApplication] Nest application successfully started
```

5. Build or refresh the vector index:

```bash
curl -X POST http://localhost:4000/ai/rag/index \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"onlyPublished":true}'
```

6. Run sample RAG requests:

Semantic search:

```bash
curl -X POST http://localhost:4000/ai/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query":"What is NestJS?","limit":5}'
```

RAG chat:

```bash
curl -X POST http://localhost:4000/ai/rag/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"question":"Summarize the Knowledge Hub article about NestJS"}'
```

If you want to test manually then keep reading guide below.

### Prepare DB

Before starting the app you need to stop docker service with running BE (you can do it from Docker app). Then you need to run following commands:

1. To generate prisma types

```
npx prisma generate
```

2. If database migration wasn't run by docker

```
npx prisma migrate dev
```

3. If seed wasn't run by docker

```
npx prisma db seed
```

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

## Testing AI Endpoints

After the app is running and the Gemini key is configured, create or find an existing article ID and call the AI endpoints.

Example summarize request:

```bash
curl -X POST http://localhost:4000/ai/articles/<article-id>/summarize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"maxLength":"medium"}'
```

Example translate request:

```bash
curl -X POST http://localhost:4000/ai/articles/<article-id>/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"targetLanguage":"Spanish"}'
```

Example analyze request:

```bash
curl -X POST http://localhost:4000/ai/articles/<article-id>/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"task":"review"}'
```

Example delete indexed article request:

```bash
curl -X DELETE http://localhost:4000/ai/rag/index/articles/<article-id> \
  -H "Authorization: Bearer <token>"
```

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

### AI (`/ai`)

- POST `/ai/articles/:articleId/summarize` - Generate a summary for an existing article
- POST `/ai/articles/:articleId/translate` - Translate article content
- POST `/ai/articles/:articleId/analyze` - Analyze article content and return suggestions
- POST `/ai/rag/index` - Build or refresh the RAG vector index from Knowledge Hub articles
- POST `/ai/rag/search` - Run semantic search over indexed article chunks
- POST `/ai/rag/chat` - Ask a grounded question using retrieved Knowledge Hub chunks
- DELETE `/ai/rag/index/articles/:articleId` - Remove one article from the vector index

## Known Limitations

- Gemini free-tier quotas are limited and may cause upstream throttling during repeated tests.
- AI output is non-deterministic, so repeated requests can return different phrasing.
- RAG endpoints are slower than standard CRUD operations because they depend on Gemini plus external vector search.
- Indexing time grows with article count and article length because embeddings are generated chunk by chunk.
- Gemini availability can depend on Google account access and regional support.
- Qdrant and the API must both be running in Docker Compose for RAG endpoints to work.

## Testing

### Run all tests

```bash
npm run test
```

### Run unit tests

```bash
npm run test:unit
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

## 🐳 Docker Image

The application image is available on Docker Hub:

👉 https://hub.docker.com/r/ksugaevskaya/knowledge-hub-api

### Run the application

```bash
docker pull ksugaevskaya/knowledge-hub-api:latest
docker run -p 4000:4000 ksugaevskaya/knowledge-hub-api:latest
```
