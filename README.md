# Custom Map Editor - OpenFront

**🌐 Live Demo: [https://ofmapeditor.projectsmith.dev/](https://ofmapeditor.projectsmith.dev/)**

A client-side web application for creating and editing custom maps for OpenFront. This tool provides an intuitive visual interface for designing terrain, water bodies, and nation spawn points without requiring any server infrastructure.

## Features

- **Visual Map Editor**: Paint land, water, and nation spawn points with an interactive brush tool
- **Image Import**: Import existing images as map templates (supports any size)
- **Elevation Control**: Set custom elevation levels for land tiles
- **Nation Management**: Define multiple nations with custom names and spawn locations
- **Real-time Preview**: See changes instantly with minimap visualization
- **Export Functionality**: Export maps in OpenFront-compatible format
- **Client-Side Only**: No server required - runs entirely in your browser
- **Performance Optimized**: Handles large maps with smooth painting, zooming, and panning

## Credits

This project uses the map generation format from the [OpenFront Map Generator](https://github.com/openfrontio/OpenFrontIO/tree/main/map-generator).

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/zuperzonic1/Custom-Map-OpenFront.git
cd Custom-Map-OpenFront
```

2. Install dependencies:
```bash
npm install
```

### Running the Application

#### Development Mode
```bash
npm run dev
```
The application will start on `http://localhost:5173` (or another port if 5173 is in use).

#### Production Build
```bash
npm run build
```
This creates an optimized production build in the `dist/` directory.

#### Preview Production Build
```bash
npm run preview
```

### Running Tests
```bash
npm run test
```

## Project Structure

```
Custom-Map-OpenFront/
├── cypress/                    # End-to-end test files and configuration
│   ├── downloads/             # Test download outputs
│   └── screenshots/           # Test screenshots
├── dist/                      # Production build output (generated)
├── public/                    # Static assets
│   ├── favicon.svg           # Application icon
│   └── icons.svg             # SVG icon definitions
├── scripts/                   # Utility scripts for data cleaning
│   ├── cleanChars.cjs        # Character cleaning utilities
│   ├── cleanFile.cjs         # File cleaning script
│   └── inspectBytes.*        # Byte inspection tools
├── src/                       # Source code
│   ├── assets/               # Application assets (images, fonts, etc.)
│   ├── components/           # React components
│   │   ├── ControlsPanel.tsx # Tool controls and settings panel
│   │   └── InfoPanel.tsx     # Map information and minimap display
│   ├── lib/                  # Core library functions
│   │   ├── exportMap.ts      # Map export functionality
│   │   ├── importMap.ts      # Image import and processing
│   │   ├── mapTexture.ts     # Texture generation for map rendering
│   │   └── pixiMapRenderer.tsx # PixiJS-based map renderer
│   ├── pages/                # Page components
│   │   ├── EditorPage.tsx    # Main editor interface
│   │   ├── LandingPage.tsx   # Welcome/landing page
│   │   └── *.css             # Page-specific styles
│   ├── store/                # State management (Zustand)
│   │   ├── editorStore.ts    # Main editor state (project, tools, terrain)
│   │   └── viewportStore.ts  # Viewport state (zoom, pan - performance optimized)
│   ├── App.tsx               # Root application component
│   ├── App.css               # Global application styles
│   ├── index.css             # Base styles and CSS variables
│   └── main.tsx              # Application entry point
├── tests/                     # Cypress E2E tests
│   ├── brush.cy.js           # Brush tool tests
│   ├── editor.cy.js          # Editor functionality tests
│   ├── elevation.cy.js       # Elevation control tests
│   ├── export.cy.js          # Export functionality tests
│   ├── metadata.cy.js        # Metadata handling tests
│   ├── nations.cy.js         # Nation management tests
│   ├── performance.cy.js     # Performance benchmarks
│   ├── size.cy.js            # Map size tests
│   └── tools.cy.js           # Tool switching tests
├── .gitignore                # Git ignore rules
├── cypress.config.js         # Cypress test configuration
├── eslint.config.js          # ESLint configuration
├── index.html                # HTML entry point
├── package.json              # Project dependencies and scripts
├── README.md                 # This file
├── TECHNICAL_SPEC.md         # Technical specification and architecture
├── tsconfig.json             # TypeScript configuration (base)
├── tsconfig.app.json         # TypeScript configuration (app)
├── tsconfig.node.json        # TypeScript configuration (Node.js)
└── vite.config.ts            # Vite build configuration
```

## Key Files Explained

- **`src/store/editorStore.ts`**: Main application state including map project data, tool selection, and terrain information. Uses Zustand with Immer middleware for immutable updates and persist middleware for localStorage.

- **`src/store/viewportStore.ts`**: Separate high-performance store for viewport state (zoom, pan). Split from editorStore to avoid serialization overhead during frequent viewport updates.

- **`src/lib/pixiMapRenderer.tsx`**: Core rendering engine using PixiJS for hardware-accelerated canvas rendering. Handles all map visualization, panning, zooming, and brush interactions.

- **`src/lib/exportMap.ts`**: Exports maps in OpenFront-compatible binary format with terrain data, nation spawn points, and metadata.

- **`src/lib/importMap.ts`**: Processes uploaded images and converts them to map terrain data.

- **`src/components/ControlsPanel.tsx`**: UI controls for tool selection, brush size, elevation, nation names, zoom control, and map size configuration.

- **`src/components/InfoPanel.tsx`**: Displays project statistics and a minimap overview with real-time viewport indicator.

## Technology Stack

- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **PixiJS** - Hardware-accelerated 2D rendering
- **Zustand** - Lightweight state management
- **Immer** - Immutable state updates
- **Cypress** - End-to-end testing

## Architecture Notes

The application uses a split-store architecture for optimal performance:
- `editorStore`: Handles project data with deferred persistence to avoid blocking the main thread
- `viewportStore`: Plain store without middleware for zero-overhead viewport updates during pan/zoom operations

This architecture enables smooth performance even with large maps (5000x5000+ pixels).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.