# EM Antenna Field Simulator

An interactive browser-based electromagnetic field simulator for exploring antenna radiation, interference, polarization, phased arrays, and scattering by passive conducting wires.

**Live demo:** [www.antennasim.com](https://www.antennasim.com)  
**Source code:** [rotemTsafrir/dipole_sim](https://github.com/rotemTsafrir/dipole_sim)

Build a scene, adjust source amplitudes and phases, and watch the electric and magnetic fields evolve. Add passive wires to explore how induced currents change the total field.

The simulator is an educational visualization tool. It displays a planar slice of a three-dimensional field, using normalized simulation units and approximate antenna models.

## Features

- Hertzian dipoles with adjustable current moment, phase, and orientation.
- Circular loops with prescribed uniform circulating current.
- Center-fed dipoles with prescribed sinusoidal current distributions.
-  Passive thin PEC wires with induced currents solved in one globally coupled system.
-  Passive PEC plane perpendicular to the simulation plane.
- Linear arrays of Hertzian dipoles or circular loops.
- Animated electric-field, magnetic-field, and energy-flux-proxy views.
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

The inspector reports mesh size, unknown count, peak current, solver residual, and relevant warnings. Yellow brightness represents the magnitude of the instantaneous current and Yellow chevrons represent the direction; the peak-current readout instead uses phasor magnitude.

**Wires are electrically separate.** Crossing or touching endpoints do not create a junction. Arranging several wires into a polygon does not create an electrically closed loop.

## Field visualization

The geometry lies in the XY plane. The displayed electric field has in-plane components, while the displayed magnetic field is perpendicular to the plane.

| Mode | What it shows |
| --- | --- |
| Electric field | Instantaneous field strength and local direction arrows. |
| Magnetic field | Perpendicular magnetic field, with red and blue indicating opposite directions. |
| Energy flux | A qualitative energy-flow visualization with arrows directed along the instantaneous cross product of the electric and magnetic fields. |

The energy-flow direction is based on:

$$
\mathbf S \propto \mathbf E \times \mathbf B
$$

Colors, brightness, and arrow lengths use nonlinear display scaling.

## Using the workspace

1. Open **Add** and choose a component.
2. Follow the placement prompts to set its endpoints, position, or direction.
3. Select a component on the canvas or in the **Scene** list.
4. Edit its parameters in **Properties**.
5. Choose a field view and adjust frequency, wave speed, or display quality.
6. Pause the animation to inspect the instantaneous fields.

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
The same convention applies to magnetic fields and currents. This is a steady-state, single-frequency calculation; the animation does not simulate switch-on transients.

### Current elements and the Green function

Prescribed active currents and solved passive currents are integrated as current elements. A wire contribution carries a current moment equal to its current multiplied by its integration length. A Hertzian source already specifies that moment directly.

The implementation uses a regularized outgoing-wave kernel:

$$
G_a(\mathbf r,\mathbf r') = \frac{e^{-ikR_a}}{R_a}, \qquad R_a = \sqrt{\lVert\mathbf r-\mathbf r'\rVert^2+a^2}
$$

The regularization length $a$ is the wire radius for passive sources and a fixed smoothing length for active sources. It avoids a singular field at a current element, but also makes very near-source fields approximate.

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

This produces one complex linear system for all passive wires. Integration by parts gives a weak form of the electric-field integral equation, and composite Gaussian quadrature evaluates the interactions. Quadrature samples are integration points, not additional current unknowns.

The solver checks the relative algebraic residual before displaying the induced fields. A small residual indicates that the discretized equations were solved accurately; it does not establish the physical accuracy of the approximation.

### Performance

Complex field data are cached so the animation can reconstruct instantaneous fields without repeating the electromagnetic solve every frame. Panning can reuse overlapping cached regions.

Changes to active excitation require a new passive-current solution when passive wires are present. More wires, finer meshes, smaller radii, and higher display quality can increase computation time.

The current passive solver allows up to **320 complex unknowns** and **6000 integration samples**. If a solve fails or a limit is exceeded, the interface reports the issue and clears the passive contribution rather than displaying stale induced currents.

## Scope and limitations

- **Prescribed active currents:** driven dipoles, loops, and array elements do not respond self-consistently to nearby objects. Passive-wire coupling is included, but feedback onto active-source currents is not.
- **Approximate thin-wire PEC model:** the solver represents axial wire current with a reduced finite-radius kernel, rather than solving a full surface-current problem.
- **Separate straight wires:** electrical junctions and connected wire loops are not modeled.
- **Mesh sensitivity:** inspect results as mesh length changes. Excessively fine intervals relative to the wire radius can produce unstable or sensitive current profiles; finer is not always better.
- **Small-loop assumption:** loop current is uniform and prescribed, including when the loop becomes electrically large and that approximation is no longer reliable.
- **Near-source smoothing:** fields very close to sources or wires should be interpreted qualitatively.
- **Normalized units:** displayed amplitudes and energy-flux colors are not calibrated SI measurements. Feed impedance, matching, and input power are not calculated.
- **Planar visualization:** the screen shows a slice through 3D fields, not a genuinely two-dimensional propagation model or a full 3D viewer.

The passive-wire calculation is a simplified method-of-moments model. The simulator is intended for exploration and intuition, rather than validated engineering design.

## Things to explore

- Change a dipole's electrical length and compare near- and far-field structure.
- Vary the relative phase of two perpendicular Hertzian sources and inspect the rotating electric field.
- Compare electric-dipole and small-loop fields.
- Build broadside and end-fire arrays, then vary spacing and progressive phase.
- Place a passive wire parallel to a source and vary its length and separation.
- Add several separate passive wires and observe how coupling changes their currents and scattered fields.
- Compare current distributions and fields across several passive mesh resolutions.

## Running locally

Download or clone the repository and serve its folder with a local static web server. For example, if Python is installed and available as `python`:

```sh
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Alternatively, use an editor's static-server extension, such as VS Code Live Server. Testing local files does not require a Git commit.

## Technology

The simulator runs in the browser using JavaScript and **p5.js**. Field calculation, the passive-wire solve, and rendering run client-side; no server-side electromagnetic computation is required.

Feedback, bug reports, and suggestions are welcome. When reporting a numerical issue, include the scene geometry, frequency, wave speed, wire radii, mesh settings, and any solver warning.
