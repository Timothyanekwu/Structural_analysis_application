# Structuro Studio - Technical Project Guide

This document provides a high-level overview of the application's architecture, key components, and the structural analysis integration.

## 🏗️ Architecture Overview

The application is built with **Next.js 15 (App Router)** and uses a **Glassmorphic Design System** implemented with vanilla Tailwind CSS.

### Core Directory Structure

- `/src/app/analysis`: The main workspace for structural modeling and results.
- `/_lib`: Contains the structural analysis kernel (Solvers, Elements, Logic).
- `/src/components`: Reusable UI components (Canvas, Forms, Modals).

---

## 🧩 Key Components

### 1. Analysis Workspace (`page.tsx`)
The heart of the application. It manages the global state for:
- **Members**: Array of beams/columns with their nodes and loads.
- **Active Modal**: A unified state controller (`'none' | 'member' | 'solve'`) that manages UI transitions.
- **Unique Nodes**: Auto-calculated from members for spatial consistency.

### 2. Geometry Kernel Preview (`StructurePreview.tsx`)
A custom-built HTML/CSS canvas (using SVG/Divs) that provides real-time visual feedback of the structure.
- **Pan/Zoom**: Interactive workspace navigation.
- **Dynamic Rulers**: Provide spatial context.
- **Load Visualization**: Renders point loads and UDLs as vector arrows.

### 3. Member Form (`MemberForm.tsx`)
A complex form that handles:
- **Spatial Alignment**: Enforces horizontal/vertical locks for Beams and Columns.
- **Nodal Linking**: Automatically detects and snaps to existing nodes (`existingNodes`).
- **Load Injection**: Interface for adding multiple vector forces (Point/UDL) with specific angles.

---

## ⚙️ Structural Solver Integration

The application integrates a custom logic layer to compute structural responses.

### Data Flow for Solving
1. **Extraction**: Frontend `members` are mapped to `SolverMember` (Beam, Column, InclinedMember) instances.
2. **Support Mapping**: Sequential supports are linked to generate a consistent global stiffness matrix.
3. **Execution**: 
   - `BeamSolver` handles linear continuous span analysis.
   - `FrameSolver` handles 2D frame analysis using the slope-deflection/matrix method.
4. **Post-Processing**: Final moments and reactions are extracted and formatted into a structured report.

### Key Logic Files
- `FixedEndMoments.ts`: Calculates initial FEMs based on member loading.
- `beamSolver.ts` & `frameSolver.ts`: The primary computational engines.

---

## 🎨 UI Design Patterns

Structuro Studio uses a **Premium Dark Aesthetic**:
- **Glassmorphism**: Panels use `backdrop-blur-xl` and semi-transparent backgrounds (`bg-white/5`).
- **HUD Layers**: Floating HUDs provide real-time precision data (Nodal counts, Total span).
- **Interactive States**: Smooth transitions between the modeling HUD and the results report.

### Color Palette
- **Primary**: Green (`#096B30`) - Represents steady-state structure/stability.
- **Accent**: Amber - Represents active vector forces/loads.
- **Background**: Near-black (`#050505`) - Minimizes visual fatigue during long modeling sessions.

---

## 📄 Automated Reporting

The "Solve" protocol generates two types of output concurrently:
1. **Interactive Results Modal**: A styled grid showing FEMs, end moments, and reactions.
2. **Raw Text Report**: A documentation-style text buffer that can be copied or downloaded as a `.txt` file for professional record-keeping.
