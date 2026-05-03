# HVAC Helper - Floor Plan Annotation Tool

**HVAC Helper** is a local-first, browser-based floor plan annotation tool designed for HVAC professionals. It serves as a streamlined alternative to tools like plandroid.com, allowing users to load PDF floor plans, draw labeled zones (rectangles or polygons), and export a new PDF with those annotations burned in, pixel-perfectly aligned.

## 🚀 Features

- **Multi-page PDF Support:** Load and navigate multi-page architectural sets.
- **Interactive Drawing Engine:**
  - **Rectangles:** Click-and-drag to define standard zones.
  - **Custom Polygons:** Click-to-place nodes for irregular spaces; click the start node to close the path.
  - **Live Transformation:** Move and resize any shape using a bounding box interface (Konva Transformer).
- **Section Management:** 
  - Sidebar for listing, renaming, and deleting zones.
  - Automatic color-coding for visual distinction.
  - **Page-Aware:** Each shape is strictly tied to the specific page it was drawn on.
- **Professional Export:**
  - **Rotation-Aware:** Handles PDFs with internal rotation metadata (0°, 90°, 180°, 270°).
  - **Coordinate Mapping:** Translates visual Konva coordinates (Top-Left, Pixels) to PDF coordinates (Bottom-Left, Points) with precision.
  - **Burned-in Annotations:** Exports the original PDF with vector-quality overlays and labels.

## 🛠 Tech Stack

- **Framework:** React 19 (JavaScript) + Vite
- **Styling:** Tailwind CSS 4 (Zero custom CSS)
- **Canvas Interaction:** `react-konva` & `konva`
- **PDF Rendering:** `pdfjs-dist` (Direct rendering to canvas)
- **PDF Export:** `pdf-lib` (Metadata-aware manipulation)
- **Icons:** `lucide-react`

## 🏗 Architecture

The app is built on three completely separate concerns to ensure performance and reliability:

1.  **PDF Display (pdfjs-dist):** Renders the PDF page to a hidden canvas, converts it to a data URL, and displays it as a static background layer in the Konva Stage.
2.  **Shape Drawing (react-konva):** Handles all user interactions, selection, and shape state management in an interactive overlay layer.
3.  **PDF Export (pdf-lib):** Loads the original PDF bytes, iterates through the shape state, converts coordinates, and draws the final annotations onto the output document.

## 📁 Project Structure

- `src/components/`: Modular, single-purpose UI components (Toolbar, ShapeList, AnnotationCanvas).
- `src/hooks/`: Encapsulated logic for PDF loading, shape CRUD, and drawing state.
- `src/utils/`: Core utilities for coordinate conversion (`coordinates.js`), PDF export (`pdfExport.js`), and color management.

## 🏃 Getting Started

1.  **Install Dependencies:**
    ```powershell
    npm install
    ```
2.  **Run Development Server:**
    ```powershell
    npm run dev
    ```
3.  **Build for Production:**
    ```powershell
    npm run build
    ```

## 📜 Development Rules

- **Language:** JavaScript only (No TypeScript).
- **Styling:** Tailwind CSS only. No custom `.css` files.
- **Logic:** Keep components small. Explain non-obvious architectural decisions in comments.
- **Coordinates:** Never pass raw Konva coordinates to `pdf-lib`. Always use the conversion functions in `src/utils/coordinates.js`.

---
*Developed for professional HVAC precision. Local-first, private, and secure.*
