# HVAC Helper - Planning & Layout Tool

An interactive web-based alternative to plandroid.com for HVAC professionals. This tool allows users to load floor plan PDFs, define zones/sections using interactive drawing tools, and export the modified plan back to a PDF with all annotations preserved and correctly aligned.

## 🚀 Current State (Phase 1 Prototype)

The project has successfully reached its first milestone, providing a robust foundation for PDF manipulation and interactive spatial planning.

### Key Features
- **PDF Core:**
  - Load and view multi-page PDF floor plans directly in the browser.
  - Automatic scaling to fit the workspace while maintaining high-resolution rendering.
  - Page-by-page navigation for complex architectural sets.
- **Interactive Drawing Engine:**
  - **Rectangles:** Click-and-drag to define standard zones (rooms, units, etc.).
  - **Custom Polygons:** Click-to-node drawing for irregular spaces. Close paths by clicking the start node.
  - **Live Transformation:** Move and resize any section with a familiar "bounding box" interface (powered by Konva).
- **Section Management:**
  - Dynamic sidebar to list, rename, and delete defined sections.
  - Automatic color-coding for visual distinction between zones.
  - Sections are page-aware (only shown on the page they were drawn).
- **Rotation-Aware Export:**
  - Export the original PDF with all drawings and labels overlaid.
  - **Smart Coordinate Mapping:** Automatically handles internal PDF rotations (0, 90, 180, 270 degrees) so annotations always land exactly where they were drawn visually.
  - Maintains transparency and vector quality in the final output.

## 🛠 Tech Stack
- **Framework:** React + Vite
- **Styling:** Tailwind CSS 4
- **PDF Engine:** `pdf-lib` (manipulation) & `react-pdf` (rendering)
- **Canvas/Drawing:** `react-konva` & `konva`
- **Icons:** `lucide-react`

## 🔭 The Vision

HVAC Helper is designed to grow into a comprehensive suite for HVAC design and calculation.

- **Ductwork Design:** Interactive tools to lay out flexible and rigid ducting with automatic sizing hints.
- **Load Calculations:** Integrated calculators to determine heating/cooling requirements based on section area and volume.
- **Equipment Placement:** Drag-and-drop library for indoor/outdoor units, vents, and thermostats.
- **BOM Generation:** Automatically generate a Bill of Materials based on the drawn plan.
- **Cloud Sync:** Save and share plans across teams.

## 🏃 Getting Started

1. **Install Dependencies:**
   ```powershell
   npm install
   ```
2. **Run Development Server:**
   ```powershell
   npm run dev
   ```
3. **Build for Production:**
   ```powershell
   npm run build
   ```

---
*Developed with focus on local-first processing and professional precision.*
