# FORGE Engineering & Product Vision Rules

Forge is not a traditional IDE with AI features attached.
Forge is an AI-native engineering environment built around multi-agent workflows, parallel cognition, deep project understanding, and premium interaction design.

Every implementation decision should reinforce:
- clarity
- scalability
- modularity
- responsiveness
- visual polish
- intelligent workflows
- extensibility
- calm premium UX

The application should feel:
- modern
- technically sophisticated
- minimal but powerful
- responsive and fluid
- highly structured
- agent-first rather than editor-first

Avoid:
- cluttered UI
- legacy desktop-app patterns
- excessive visual noise
- random component styling
- deeply coupled systems
- large monolithic files
- fragile state synchronization
- inconsistent spacing or typography
- unnecessary abstraction

---

# Architecture Rules

## General Principles

- Prefer modular systems over tightly coupled logic.
- Build for long-term scalability, not short-term speed.
- Features should be composable and independently extensible.
- Shared systems should be reusable and centralized.
- Separate UI state, business logic, and backend communication cleanly.

## Core Architectural Philosophy

Forge is built around:
- multi-agent orchestration
- shared contextual memory
- recursive workspace systems
- asynchronous task execution
- real-time UI updates
- intelligent context management

Architecture should reflect this directly.

## Rules

- Avoid giant files.
- Prefer feature-based architecture.
- Keep components focused and single-purpose.
- Shared logic belongs in hooks/services/utils.
- Do not duplicate logic across features.
- Avoid prop drilling whenever possible.
- Use strongly typed interfaces everywhere.
- Prefer composition over inheritance.
- Keep business logic outside UI components.
- Minimize hidden side effects.

## Async Systems

- All async operations must support:
  - cancellation
  - loading states
  - error states
  - optimistic updates where appropriate

- Long-running AI operations should always expose:
  - progress
  - status
  - streaming support
  - interruption capability

---

# State Management Philosophy

## Philosophy

State should be:
- predictable
- localized when possible
- global only when necessary
- easy to debug
- reactive without becoming chaotic

Avoid:
- excessive global state
- cascading rerenders
- deeply nested state trees
- duplicated derived state

## Rules

### Local State
Use local component state for:
- UI toggles
- hover states
- temporary interactions
- modal visibility
- small ephemeral UI state

### Shared State
Use centralized state only for:
- workspace layout
- agent sessions
- project context
- authentication
- theme/preferences
- file system state
- chat/task synchronization

### Derived State
- Never store computable state redundantly.
- Prefer selectors/computed values.
- Memoize expensive derived calculations.

### Persistence
Persist:
- layouts
- workspace sessions
- agent state
- user preferences
- project memory

Do not persist:
- transient hover state
- temporary animations
- unstable intermediate UI state

---

# Component Conventions

## Component Philosophy

Components should be:
- small
- reusable
- predictable
- visually consistent
- accessible
- composable

Avoid:
- massive "god components"
- deeply nested JSX
- mixed responsibilities
- hidden side effects

## Rules

### File Size
- Components should generally remain under ~250 lines.
- Extract subcomponents aggressively when complexity grows.

### Naming
Use:
- PascalCase for components
- camelCase for functions/variables
- clear semantic names

Avoid vague names like:
- data
- thing
- stuff
- handler2

### Component Structure

Preferred order:
1. imports
2. types/interfaces
3. constants
4. hooks/state
5. derived state
6. callbacks
7. effects
8. render helpers
9. JSX return

### Props
- Keep props minimal and explicit.
- Prefer typed interfaces.
- Avoid boolean prop explosions.
- Prefer compositional APIs over configuration-heavy components.

### Reusability
Shared UI belongs in:
- `/components/ui`

Feature-specific UI belongs in:
- feature folders

---

# Styling Rules

## Design Philosophy

Forge should feel:
- premium
- calm
- technical
- intelligent
- spatially balanced

Visual inspiration:
- modern IDEs
- cinematic UI
- high-end productivity software
- minimal dashboard systems

Avoid:
- excessive saturation
- rainbow accents
- heavy gradients everywhere
- noisy shadows
- excessive borders
- inconsistent spacing

## Color System

Primary palette:
- slate
- graphite
- soft gray
- muted blue
- subtle violet accents

Accent colors should be:
- restrained
- purposeful
- consistent

Use color to communicate:
- focus
- hierarchy
- state
- importance

Not decoration.

## Spacing

- Use consistent spacing scale everywhere.
- Prefer breathing room over cramped density.
- Maintain alignment precision.

## Typography

- Strong hierarchy.
- Large readable headings.
- Medium-weight UI labels.
- Clean monospace usage for technical sections.
- Avoid oversized paragraph blocks.

## Borders & Surfaces

Prefer:
- subtle contrast differences
- layered surfaces
- soft separators

Avoid:
- hard borders everywhere
- bright outlines
- excessive glassmorphism

---

# Animation Rules

## Philosophy

Animations should:
- reinforce structure
- improve spatial understanding
- feel smooth and intelligent
- never distract

Forge animations should feel:
- fluid
- intentional
- slightly cinematic
- responsive
- physics-aware

Avoid:
- flashy motion
- excessive bounce
- random floating effects
- slow interactions
- over-animated dashboards

## Rules

### Timing
- Fast interactions should feel immediate.
- Most UI transitions: 150ms–300ms.
- Larger layout transitions: 300ms–500ms.

### Motion Style
Prefer:
- smooth easing
- subtle fades
- spatial transitions
- opacity + transform animations

Avoid:
- animating width/height excessively
- jittery transitions
- harsh linear movement

### Layout Motion
Recursive pane splitting and workspace transitions should feel:
- spatially aware
- smooth
- physically coherent

### Hover States
Hover effects should be:
- subtle
- responsive
- low-amplitude

Avoid aggressive glow effects.

---

# File Structure Rules

## Philosophy

Structure should make the codebase:
- discoverable
- scalable
- intuitive
- modular

Avoid:
- dumping files into giant folders
- mixing unrelated systems
- deeply confusing nesting

## Preferred Structure

/src
  /app
  /components
    /ui
    /layout
    /workspace
    /agents
  /features
    /chat
    /editor
    /agents
    /projects
    /terminal
  /hooks
  /services
  /stores
  /types
  /utils
  /styles
  /lib

## Rules

### Components
- Generic reusable UI → `/components/ui`
- Feature-specific UI → feature folder

### Hooks
- Shared reusable hooks only
- Prefix all hooks with `use`

### Services
Services should contain:
- API logic
- AI orchestration
- backend communication
- persistence logic

No UI logic in services.

### Utils
Utils must remain:
- pure
- stateless
- deterministic

### Types
Shared types belong in:
- `/types`

Avoid redefining interfaces repeatedly.

---

# AI Agent Coding Behavior Rules

When implementing features:
- prioritize maintainability over shortcuts
- prioritize clarity over cleverness
- prioritize UX quality over feature quantity

Before coding:
- understand the surrounding architecture
- inspect related systems
- preserve existing conventions
- avoid introducing inconsistency

When modifying files:
- preserve formatting consistency
- preserve architectural patterns
- avoid unnecessary rewrites

Always think:
- “Does this feel like Forge?”
- “Does this scale?”
- “Would this feel premium to use daily?”
- “Does this improve engineering flow?”

The product should feel like:
an intelligent engineering operating system,
not just an AI chatbot attached to a text editor.