# Online Multiplayer Ludo

A browser-based multiplayer Ludo game with a Node.js server.

## Features

- Classical Indian-style board UI
- Dice roll animation with built-in sound effects
- Click-to-move tokens directly on board
- Password-protected rooms (`sabkhelo`)
- 2-4 players per room (max 5 active rooms total)
- Exit Room button with server-side leave handling
- Real-time updates via Server-Sent Events (SSE)
- Server-authoritative game logic:
  - turn order
  - dice roll and legal moves
  - roll 1 gives extra turn
  - third consecutive 1 sends moved token back home and ends turn
  - block strategy (two stacked tokens block opponents)
  - token spawning on six
  - home lane progression
  - captures (except on safe cells)
  - extra turn on six
  - three consecutive sixes skip rule
  - winner ranking and game end
- Auto cleanup after each match:
  - game data and logs reset automatically after game over

## Local Run

1. Open terminal in this folder.
2. Start server:
   ```bash
   node server.js
   ```
3. Open `http://localhost:3000`.
4. Use room password: `sabkhelo`.

## Render Deploy

- Build command: `npm install`
- Start command: `npm start`
- No environment variables required.

## API Summary

- `POST /api/create-room` `{ name, password }`
- `POST /api/join-room` `{ roomCode, name, password }`
- `POST /api/leave-room` `{ roomCode, playerId }`
- `POST /api/start-game` `{ roomCode, playerId }`
- `POST /api/roll` `{ roomCode, playerId }`
- `POST /api/move` `{ roomCode, playerId, tokenIndex }`
- `GET /api/state?roomCode=...&playerId=...`
- `GET /api/events?roomCode=...&playerId=...` (SSE)

