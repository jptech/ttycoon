# Therapy Tycoon

A cozy management/tycoon game where you build and operate your own therapy private practice. Hire therapists, schedule clients, manage finances, and grow your reputation through training and specialization.

**[Play Now](https://jptech.github.io/ttycoon/)** | [Documentation](./docs/README.md)

## About the Game

In Therapy Tycoon, you start with a small practice and one therapist. As you successfully treat clients and build your reputation, you'll unlock new opportunities:

- **Hire & Train Therapists** - Recruit staff with different specializations and send them to training programs to expand their skills
- **Schedule Sessions** - Match clients with the right therapists based on their conditions and your team's expertise
- **Manage Finances** - Balance session fees, therapist salaries, insurance claims, and office expenses
- **Grow Your Practice** - Upgrade your office, add new rooms, and unlock telehealth services
- **Build Reputation** - Deliver quality care to increase your practice level and attract more clients

## Getting Started

### Play Online

Visit **[jptech.github.io/ttycoon](https://jptech.github.io/ttycoon/)** to play directly in your browser.

### Run Locally

```bash
# Clone the repository
git clone https://github.com/jptech/ttycoon.git
cd ttycoon

# Install dependencies (requires Bun)
bun install

# Start development server
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **State**: Zustand
- **Graphics**: PixiJS (office visualization)
- **Styling**: Tailwind CSS + shadcn/ui

## Development

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run test         # Run tests (watch mode)
bun run test --run   # Run tests once
bun run lint         # Lint code
bun run typecheck    # Type check
```

## Architecture

The game uses an event-driven architecture with pure game logic separated from UI:

```
src/
├── core/           # Pure game logic (no React dependencies)
│   ├── engine/     # GameEngine, TimeController, SaveManager
│   ├── systems/    # 8 independent game systems
│   ├── entities/   # Factory functions for game objects
│   └── events/     # EventBus (central communication hub)
├── store/          # Zustand state management
├── components/     # React UI components
├── game/           # PixiJS rendering layer
└── hooks/          # Custom React hooks
```

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed system design.

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md) - System design and data flow
- [Data Model](./docs/DATA_MODEL.md) - Entity definitions
- [Sessions](./docs/SESSIONS.md) - How therapy sessions work
- [Economy](./docs/ECONOMY.md) - Financial systems
- [Full Documentation Index](./docs/README.md)

## License

MIT
