# PowerSolid Chat Frontend

A minimal React application for testing the PowerSolid AI chatbot functionality.

## Features

- User authentication (login)
- Real-time chat with AI assistant using Server-Sent Events (SSE)
- Streaming responses for better UX
- Product-specific conversations
- Clean and modern UI

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:

Copy `.env.example` to `.env` and update the values:

```env
# Backend API URL
VITE_API_URL=https://powersolid-be.7esx4z.easypanel.host

# Static Product ID for chat functionality
VITE_PRODUCT_ID=1
```

## Running the Application

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

### 1. Login

Enter your PowerSolid credentials:
- Phone Number: Your registered phone number (e.g., +9647XXXXXXXXX)
- Password: Your account password

### 2. Chat

Once logged in, you can:
- Send messages to the AI assistant
- View streaming responses in real-time
- Start a new conversation with the "New Chat" button
- Logout when done

## API Integration

The frontend connects to the following backend endpoints:

- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/chatbot/conversations` - Create new conversation
- `GET /api/v1/chatbot/conversations/:id` - Load conversation history
- `POST /api/v1/chatbot/conversations/:id/messages` - Send message
- `GET /__transmit/events` - SSE connection for real-time updates

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | - |
| `VITE_PRODUCT_ID` | Static product ID for conversations | 1 |

## Technical Details

### Authentication

The app uses bearer token authentication. The token is:
- Stored in localStorage
- Automatically restored on page reload
- Sent with all API requests in the Authorization header

### Real-time Communication

Messages are streamed using Server-Sent Events (SSE) via AdonisJS Transmit:
1. Client connects to `/__transmit/events`
2. Subscribes to conversation channel
3. Receives real-time message chunks and events

### Message Types

The SSE connection receives different event types:

- `user_message` - User message added to conversation
- `assistant_chunk` - Streaming text chunk from AI
- `assistant_complete` - Complete AI response
- `done` - Streaming completed
- `error` - Error occurred

## Build for Production

Build the app for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Tech Stack

- React 18
- Vite
- Server-Sent Events (SSE)
- CSS3 (no external UI libraries)
