# PDF Zone Editor

A small React/Vite web app for loading a PDF, selecting a page, drawing rectangular zones, and exporting a new annotated PDF.

## Features

- Load a PDF from disk
- Select a specific page to work on
- Draw rectangle zones on the page
- Each zone uses a different color
- Save annotations into a new PDF

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the displayed URL in your browser.

## Notes

- This version supports rectangular zones only.
- Annotations are saved into the exported PDF as filled rectangles.
