# Therapy Tycoon - System Documentation

This directory contains comprehensive documentation for all systems and subsystems in the Therapy Tycoon game.

## Quick Navigation

### Core Systems
- **[Architecture Overview](./ARCHITECTURE.md)** - High-level system design and data flow
- **[Data Model](./DATA_MODEL.md)** - Entity definitions and relationships

### Game Systems
- **[Time & Calendar System](./TIME_CALENDAR.md)** - Day/hour progression, speed controls, time simulation
- **[Economy System](./ECONOMY.md)** - Money, income sources, expenses, cash flow
- **[Session System](./SESSIONS.md)** - Therapy sessions, quality calculation, session lifecycle
- **[Scheduling System](./SCHEDULING.md)** - Calendar management, slot availability, recurring sessions
- **[Reputation System](./REPUTATION.md)** - Practice reputation, levels, progression milestones
- **[Client Management](./CLIENTS.md)** - Client arrivals, waiting list, lifecycle, treatment progress
- **[Therapist Management](./THERAPISTS.md)** - Therapist hiring, energy, burnout, specializations
- **[Training System](./TRAINING.md)** - Certifications, skill progression, training tracks
- **[Office System](./OFFICE.md)** - Buildings, rooms, telehealth, infrastructure
- **[Insurance System](./INSURANCE.md)** - Insurance panels, claims, reimbursement, denials
- **[Events System](./EVENTS.md)** - Random events, decision events, modifiers

### UI & Presentation
- **[UI System](./UI.md)** - HUD, modals, schedule view, notifications

## Project Overview

**Therapy Tycoon** is a cozy management/tycoon game where players build and operate a therapy private practice. Starting as a solo practitioner, players hire therapists, schedule clients, manage finances, and expand through training and reputation growth.

### Core Tech Stack
- **Runtime**: Bun
- **Build**: Vite
- **Framework**: React 19
- **Language**: TypeScript 5
- **State**: Zustand
- **Rendering**: PixiJS v8 (canvas) + Tailwind CSS (UI)
- **Testing**: Vitest, React Testing Library, Playwright

### Key Gameplay Loop
```
START OF DAY
    ↓
BUSINESS HOURS (8 AM - 5 PM)
  • Schedule and run therapy sessions
  • Make decisions during sessions
  • Manage therapist energy
  ↓
END OF DAY
  • Deduct operating costs
  • Update training progress
  • Save client treatment progress
    ↓
NEXT DAY
```

## System Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                       GameEngine (Time)                      │
│           Orchestrates day/hour progression                   │
└──────┬────────────────────────────────────────────────────────┘
       │ Signals: day_started, hour_changed, minute_changed
       ├─────────────────────┬──────────────────┬──────────────┐
       ↓                     ↓                  ↓              ↓
   ┌────────┐        ┌──────────────┐   ┌─────────────┐  ┌────────┐
   │Session │        │  Scheduling  │   │ Reputation  │  │Economy │
   │System  │        │   System     │   │  System     │  │System  │
   └────────┘        └──────────────┘   └─────────────┘  └────────┘
       │                   │                   │             │
       ├─────────────┬─────┴──────────┬───────┴──┬──────────┤
       │             │                │          │          │
       ↓             ↓                ↓          ↓          ↓
   ┌─────────┐ ┌──────────┐  ┌──────────┐ ┌────────┐ ┌─────────┐
   │ Clients │ │Therapists│  │  Events  │ │Training│ │Insurance│
   │         │ │          │  │  System  │ │System  │ │ System  │
   └─────────┘ └──────────┘  └──────────┘ └────────┘ └─────────┘
```

## Development Notes

- All systems are **event-driven** via a central EventBus
- Game logic is **pure** with zero React dependencies in `/src/core/`
- State is managed through **Zustand** with serializable snapshots for saves
- UI updates are **reactive** to state changes
- Canvas rendering adds **visual polish** without being critical to gameplay

## Save System

The game uses a version-controlled save structure stored in Zustand. See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on the save format and migration strategy.
