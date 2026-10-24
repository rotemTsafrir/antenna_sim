# EM Antenna Field Simulator

An interactive browser-based electromagnetic field simulator for exploring antenna radiation, interference, polarization, phased arrays, and scattering by passive conducting wires and an infinite conducting plane.

**Live demo:** [www.antennasim.com](https://www.antennasim.com)  
**Source code:** [rotemTsafrir/dipole_sim](https://github.com/rotemTsafrir/dipole_sim)

Build a scene, adjust source amplitudes and phases, and watch the electric and magnetic fields evolve. Add passive wires or an infinite conducting plane to explore induced currents, scattering, and reflection.

The simulator is an educational visualization tool. It displays a planar slice of a three-dimensional field, using normalized simulation units and approximate antenna models.

## Features

- Hertzian dipoles with adjustable current moment, phase, and orientation.
- Circular loops with prescribed uniform circulating current.
- Center-fed dipoles with prescribed sinusoidal current distributions.
- Passive thin PEC wires with induced currents solved in one globally coupled system.
- Infinite PEC plane perpendicular to the simulation plane, with reflected fields and surface-current visualization.
- Linear arrays of Hertzian dipoles or circular loops.
- Animated electric-field, magnetic-field, energy-flux, and energy-density views.
- Cycle-averaged, peak-normalized far-field radiation patterns in the XY plane.
- Independent gamma controls for heatmaps, arrow lengths, and current colors.
- Spatial field caching and optional temporal heatmap caching.
- Built-in example scenes.
- Current visualization, component properties, a scene list, pan and zoom, and adjustable display quality.

## Components

### Hertzian dipole

An ideal infinitesimal electric-current element. Its amplitude represents the current moment $I\ell$, rather than current alone. The displayed symbol sets its position and direction; the symbol length is not a physical antenna length.

Use it to explore elementary radiation patterns, coherent interference, and the effect of relative phase between differently oriented sources.

### Small circular loop

A circular loop with a prescribed uniform circulating current. Adjust its current amplitude, phase, and radius. The inspector reports its circumference relative to wavelength and its magnetic-moment magnitude:

$$
m = I A = I\pi a^2
$$

Here, $a$ is the loop radius. At fixed current, reducing the radius also reduces the magnetic moment. The model is intended for electrically small loops; the interface warns when the circumference becomes too large relative to the wavelength.

### Center-fed dipole

A finite straight-wire dipole with an assumed sinusoidal current distribution. Place it by choosing two endpoints, then adjust the current amplitude, excitation phase, and feed gap.

The inspector shows its electrical length relative to the wavelength. Its current distribution is prescribed: nearby passive wires scatter its field but do not modify the driven dipole's assumed current.

### Linear antenna array

A linear array is edited as a single component. Choose Hertzian dipoles or circular loops, then set:

- Number of elements.
- Spacing in wavelengths.
- Global amplitude per element and global phase.
- Progressive phase step.
- Array-axis direction.
- Dipole orientation or loop radius, depending on element type.

All elements have the same excitation magnitude. Their phases follow:

$$
\phi_n = \phi_0 + n\Delta\phi, \qquad n = 0,\ldots,N-1
$$

The global phase refers to element zero. Physical spacing follows the wavelength when frequency or wave speed changes. The array's source currents remain prescribed; coupling does not change their excitations.

### Passive PEC wire

Place a separate straight wire by clicking its two endpoints. Adjust its radius and maximum mesh-segment length in the inspector.

The wire has no imposed excitation. Its complex current is induced by the active sources and by every other passive wire in the scene. All passive-wire unknowns are solved together, so multiple scattering and electromagnetic coupling between passive wires are included within the model.

Each wire is divided into mesh intervals. The unknowns are current phasors at interior nodes, with linear interpolation between nodes and zero current at the two open ends. An $N$-interval wire therefore has $N-1$ complex unknowns.

The inspector reports mesh size, unknown count, peak current, solver residual, and relevant warnings. Yellow brightness represents the magnitude of the instantaneous current, and yellow chevrons indicate its direction; the peak-current readout instead uses phasor magnitude.

**Wires are electrically separate.** Separate wires must not overlap or touch; crossings and touching endpoints do not create electrical junctions. Arranging several wires into a polygon does not create an electrically closed loop.

### Infinite PEC plane

Choose two points to define the line where an infinite perfect electric conductor (PEC) intersects the simulation plane. The conductor extends indefinitely along this line and perpendicular to the screen; the two points do not define its physical extent.

Only one PEC plane is supported. Sources may be placed on either side, but each physical source element and each passive wire must remain entirely on one side without touching or crossing the plane. Separate elements of an array may occupy opposite sides.

Fields on each side are calculated independently using the method of images. The plane reflects fields and blocks transmission between the two half-spaces. Reflected coupling is included in the passive-wire system.

Orange-yellow arrows along the plane's trace show the direction and magnitude of its instantaneous induced sheet-current density. This current is calculated from the magnetic-field jump across both sides of the plane and is tangent to its trace for the supported geometry. It is a surface-current density, not the total current through a wire.

## Field visualization

The geometry lies in the XY plane. The displayed electric field has in-plane components, while the displayed magnetic field is perpendicular to the plane.

| Mode | What it shows |
| --- | --- |
| Electric field | Instantaneous field strength and local direction arrows. |
| Magnetic field | Perpendicular magnetic field, with red and blue indicating opposite directions. |
| Energy flux | A qualitative energy-flow visualization with arrows directed along the instantaneous cross product of the electric and magnetic fields. |
| Energy density | Instantaneous electric plus magnetic energy density, shown as a scalar heatmap without arrows. |

The energy-flow direction is based on:

$$
\mathbf S \propto \mathbf E \times \mathbf B
$$

The energy density uses the simulator's normalized convention, $\mu=1$ and $\epsilon=1/c^2$:

$$
u = \frac{1}{2}\left(\frac{E_x^2+E_y^2}{c^2}+B_z^2\right)
$$

Both energy flux and energy density are calculated from instantaneous fields, rather than cycle averages. Energy density describes locally stored field energy; energy flux describes its direction of transport.

### Advanced display settings

Open **Advanced** to adjust heatmap gamma, arrow-length gamma, and current-color gamma independently. Gamma is applied after intensity compression:

- Values below 1 make weaker values more visible.
- Values above 1 emphasize stronger values.
- **Reset display settings** restores the defaults.

These controls change the visualization only. They do not change source currents, solved fields, or the passive-wire solution. Colors and arrow lengths use nonlinear scaling and should not be read as linear quantitative scales.

### Radiation pattern

Open **Radiation pattern** to view the far-field angular power distribution in the XY plane. The plot includes the active sources, solved passive-wire currents, and PEC images when a plane is present.

Power is averaged over an excitation cycle and normalized to the peak of the displayed cut. Choose a **−40 to 0 dB** scale or a **log1p** scale. Angles follow the simulation axes. This is a planar cut through the three-dimensional pattern, not a full 3D pattern or an absolute gain measurement.

The pattern need not resemble the instantaneous energy-flow arrows near an antenna: the arrows include reactive near-field behavior and vary through the cycle, while the radiation pattern describes cycle-averaged far-field power.

## Using the workspace

1. Open **Add** and choose a component.
2. Follow the placement prompts to set its endpoints, position, or direction.
3. Select a component on the canvas or in the **Scene** list.
4. Edit its parameters in **Properties**.
5. Choose a field view and adjust frequency, wave speed, or display quality.
6. Pause the animation to inspect the instantaneous fields.
7. Open **Advanced** to tune display contrast or **Radiation pattern** to inspect the far-field distribution.

Use the **Pan** tool or middle-button dragging to move around the scene. The mouse wheel zooms around the cursor; footer buttons also control zoom. Zoom changes the view, not the physical dimensions of the components.

Low, Medium, and High quality settings control field sampling and applicable active-source discretization. **Passive-wire mesh resolution is controlled separately** by each wire's maximum segment length; changing display quality does not change its current basis.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` | Select tool |
| `H` | Pan tool |
| `A` | Open Add menu |
| `Space` | Pause / resume |
| `Delete` / `Backspace` | Delete selected component |
| `Esc` | Cancel the current operation |
| `0` | Reset zoom |

## How the simulation works

### Frequency-domain fields and animation

All active sources share one frequency. The wavelength and wavenumber are:

$$
\lambda = \frac{c}{f}, \qquad \omega = 2\pi f, \qquad k = \frac{\omega}{c}
$$

Here, $c$ is the selected simulation wave speed. Complex phasors store field amplitude and phase.
Instantaneous fields are reconstructed using the $e^{i\omega t}$ convention:

$$
\mathbf{E}(\mathbf{r},t) = \mathrm{Re}(\widetilde{\mathbf{E}}(\mathbf{r})e^{i\omega t})
$$
The same convention applies to magnetic fields and currents. This is a steady-state, single-frequency calculation; the animation does not simulate switch-on transients.

### Current elements and the Green function

Prescribed active currents and solved passive currents are integrated as current elements. A wire contribution carries a current moment equal to its current multiplied by its integration length. A Hertzian source already specifies that moment directly.

Field visualization and active-source excitation use a regularized outgoing-wave kernel:

$$
G_a(\mathbf r,\mathbf r') = \frac{e^{-ikR_a}}{R_a}, \qquad R_a = \sqrt{\lVert\mathbf r-\mathbf r'\rVert^2+a^2}
$$

The regularization length $a$ is the wire radius for passive sources and a fixed smoothing length for active sources. It avoids a singular field at a current element, but also makes very near-source fields approximate. The passive-wire interaction matrix uses the cylindrical formulation described below, rather than using this smoothing kernel for every interaction.

In the implementation's normalized units, the vector potential and fields are related by:

$$
\widetilde{\mathbf A}(\mathbf r) = \int I(s')\,\hat{\mathbf t}(s')\,G_a(\mathbf r,\mathbf r(s'))\,ds'
$$

$$
\widetilde{\mathbf E} = -i\omega\left[\widetilde{\mathbf A}+\frac{1}{k^2}\nabla\left(\nabla\cdot\widetilde{\mathbf A}\right)\right], \qquad \widetilde{\mathbf B} = \nabla\times\widetilde{\mathbf A}
$$

The usual common physical prefactor is omitted in these normalized expressions. Analytic derivatives of the kernel are used to evaluate the electric and magnetic fields. Active and passive contributions use consistent current-moment scaling and are added as complex phasors.

### Passive-wire solution

On each passive wire, the scalar current is expanded in triangular basis functions:

$$
I(s) = \sum_{n=1}^{N-1} I_n f_n(s)
$$

Each basis function peaks at an interior node and decreases linearly to zero at its two neighboring nodes. The current is continuous along the wire and vanishes at its open endpoints.

Galerkin testing enforces a weighted tangential PEC boundary condition for each basis function:

$$
\int f_m(s)\,\hat{\mathbf t}(s)\cdot\left[\widetilde{\mathbf E}_{\mathrm{active}}(s)+\widetilde{\mathbf E}_{\mathrm{passive}}(s)\right]ds = 0
$$

This produces one complex linear system for all passive wires. Integration by parts gives a weak form of the electric-field integral equation. The implementation uses a circumferentially averaged cylindrical self-interaction kernel and reciprocal Galerkin mutual interactions, evaluated with numerical quadrature. Quadrature samples are integration points, not additional current unknowns. When a PEC plane is present, image contributions account for reflected coupling; wires on opposite sides are electromagnetically isolated by the plane.

The solver checks the relative algebraic residual before displaying the induced fields. A small residual indicates that the discretized equations were solved accurately; it does not establish the physical accuracy of the approximation.

### Performance

Complex field data are cached so the animation can reconstruct instantaneous fields without repeating the electromagnetic solve every frame. Panning can reuse overlapping cached regions. With **Temporal cache** enabled, phase-indexed heatmaps are cached as well; arrows and currents continue to update continuously. Cache allocation is bounded, and temporal caching may be unavailable for a large sampled view.

Changes to active excitation require a new passive-current solution when passive wires are present. Cached matrix factors can be reused when the passive geometry and relevant wave parameters remain unchanged. More wires, finer meshes, smaller radii, and higher display quality can increase computation time.

The current passive solver allows up to **320 complex unknowns**. If a solve fails or a limit is exceeded, the interface reports the issue and clears the passive contribution rather than displaying stale induced currents.

## Scope and limitations

- **Prescribed active currents:** driven dipoles, loops, and array elements do not respond self-consistently to nearby objects. Passive-wire coupling is included, but feedback onto active-source currents is not.
- **Approximate thin-wire PEC model:** the solver represents axial wire current with cylindrical self interactions and approximate mutual interactions, rather than solving a full surface-current problem. End caps are not modeled, and displayed near-wire fields retain smoothing.
- **Ideal infinite plane:** only one zero-thickness PEC plane is supported. Finite edges, apertures, material losses, and transmission through the plane are not modeled.
- **Separate straight wires:** electrical junctions and connected wire loops are not modeled.
- **Mesh sensitivity:** inspect results as mesh length changes. Excessively fine intervals relative to the wire radius can produce unstable or sensitive current profiles; finer is not always better.
- **Small-loop assumption:** loop current is uniform and prescribed, including when the loop becomes electrically large and that approximation is no longer reliable.
- **Near-source smoothing:** fields very close to sources or wires should be interpreted qualitatively.
- **Normalized units:** displayed amplitudes and energy-flux colors are not calibrated SI measurements. Feed impedance, matching, and input power are not calculated yet.
- **Planar visualization:** the screen shows a slice through 3D fields, not a full 3D viewer.

The passive-wire calculation is a simplified method-of-moments model. The simulator is intended for exploration and intuition, rather than validated engineering design.

## Things to explore

- Change a dipole's electrical length and compare near- and far-field structure.
- Vary the relative phase of two perpendicular Hertzian sources and inspect the rotating electric field.
- Compare electric-dipole and small-loop fields.
- Build broadside and end-fire arrays, then vary spacing and progressive phase.
- Place a passive wire parallel to a source and vary its length and separation.
- Add several separate passive wires and observe how coupling changes their currents and scattered fields.
- Compare current distributions and fields across several passive mesh resolutions.
- Place a source near a PEC plane and vary its orientation and distance to study reflection.
- Compare instantaneous energy-flow arrows with the cycle-averaged far-field pattern.
- Compare energy density near electric dipoles and small loops.

## Running locally

Download or clone the repository and serve its folder with a local static web server. For example, if Python is installed and available as `python`:

```sh
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Alternatively, use an editor's static-server extension, such as VS Code Live Server. Testing local files does not require a Git commit.

## Technology

The simulator runs in the browser using JavaScript and **p5.js**. Field calculation, the passive-wire solve, and rendering run client-side; no server-side electromagnetic computation is required.

Feedback, bug reports, and suggestions are welcome. When reporting a numerical issue, include the scene geometry, frequency, wave speed, wire radii, mesh settings, and any solver warning.
