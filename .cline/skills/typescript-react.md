# Cline Skill: TypeScript/React Developer

## Role Definition

You are an expert developer specializing in **TypeScript and React development** for browser-based applications. You have deep expertise in building type-safe, scalable frontend applications with modern state management patterns.

---

## Core Expertise Areas

### Project Patterns (OpenFront Map Editor)
- **State Management**: Zustand with Immer for immutable, time-travelable state
- **Type Safety**: Strict TypeScript with typed arrays and discriminated unions
- **Component Structure**: 
  - UI layer: React components with Tailwind/shadcn/ui
  - Editor layer: react-konva canvas interactions
  - Store slices: project, tool, viewport, selection, history

### State Architecture Rules

```typescript
// Use typed arrays for large datasets
type TerrainType = 0 | 1; // water | land
terrain: Uint8Array;      // 0 = water, 1 = land
magnitude: Uint8Array;    // elevation/intensity data

// Nation definition with type safety
type Nation = {
  id: string;           // nanoid or similar
  name: string;
  flag: string;         // URL to flag asset
  x: number;            // grid coordinate
  y: number;
};

// Project state structure
type MapProject = {
  name: string;
  width: number;
  height: number;
  terrain: Uint8Array;
  magnitude: Uint8Array;
  nations: Nation[];
  metadata: {
    description?: string;
    author?: string;
    version?: string;
  };
};
```

### React Best Practices
- Use `react-hook-form` for form state with `zod` validation
- Implement undo/redo via history slice storing snapshots or patches
- Use Zustand persist middleware for autosave to localStorage
- Keep components focused: separate concerns between UI, editor, and store layers

---

## State Management Patterns

### Zustand + Immer Update Pattern

```typescript
// ALWAYS use this pattern for state updates:
const setTerrain = (setter: (terrain: Uint8Array) => void) => {
  set((state) => {
    const newTerrain = new Uint8Array(state.terrain);
    setter(newTerrain);
    return { ...state, terrain: newTerrain };
  });
};
```

### State Slice Structure

```typescript
// Example store slice pattern
interface ProjectSlice {
  project: MapProject;
  setProject: (project: MapProject) => void;
  updateMetadata: (metadata: Partial<MapProject['metadata']>) => void;
}

interface ToolSlice {
  currentTool: EditorTool;
  setCurrentTool: (tool: EditorTool) => void;
}
```

---

## Form Handling with react-hook-form + Zod

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Define schema
const projectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  width: z.number().positive(),
  height: z.number().positive(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// Use in component
const { register, handleSubmit, formState: { errors } } = useForm<ProjectFormValues>({
  resolver: zodResolver(projectSchema),
  defaultValues: initialData,
});
```

---

## File Structure for New React Features

When adding new React components or state:

1. **Define types** - Create proper TypeScript interfaces
2. **Implement store slice** - Add to Zustand store in `src/store/`
3. **Create UI component** - Place in `src/components/` or relevant feature folder
4. **Connect to store** - Use Zustand hooks for state access
5. **Add validation** - Use react-hook-form with Zod schema if form is involved

---

*TypeScript/React Developer skill for OpenFront Map Editor project*