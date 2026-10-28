# EM Antenna Field Simulator

An interactive browser-based electromagnetic field simulator for exploring antenna radiation, interference, polarization, phased arrays, and scattering by passive conducting wires and an infinite conducting plane.

**Live demo:** [www.antennasim.com](https://www.antennasim.com)  
**Source code:** [rotemTsafrir/antenna_sim](https://github.com/rotemTsafrir/antenna_sim)

Build a scene, adjust source amplitudes and phases, and watch the electric and magnetic fields evolve. Add passive wires or an infinite conducting plane to explore induced currents, scattering, and reflection.

The simulator is an educational visualization tool. It displays a planar slice of a three-dimensional field, using normalized simulation units and approximate antenna models.

## Features

- Hertzian dipoles with adjustable current moment, phase, and orientation.
- Circular loops with prescribed uniform circulating current.
- Voltage-fed center-fed dipoles and end-fed wire antennas with self-consistently solved currents.
- Explicit counterpoises and voltage-source or open-circuit feed terminations.
- Passive thin PEC wires coupled to all voltage-fed wire antennas in one global system.
- Signed average source-power contributions, total 3D radiated power, and power-balance diagnostics.
- Infinite PEC plane perpendicular to the simulation plane, with reflected fields and surface-current visualization.
- Linear arrays of Hertzian dipoles or circular loops.
- Animated electric-field, magnetic-field, energy-flux, and energy-density views.
- Cycle-averaged, peak-normalized far-field radiation patterns in the XY plane.
- Independent gamma controls for heatmaps, arrow lengths, and current colors.
- Spatial field caching, optional temporal heatmap caching, and adaptive field resolution.
- Shared PEC-wire mesh control, adjustable arrow densities, and animation clock speed.
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

A finite thin PEC rod driven at its center by an ideal voltage source with zero source impedance. Place it by choosing the two outer endpoints, then adjust **Feed voltage · peak**, voltage phase, feed separation, and wire radius. Voltage and current amplitudes are peak phasors in normalized simulation units.

The current distribution is solved with the method of moments, together with every other driven and passive PEC wire. Nearby wires, other sources, and the PEC plane can change its amplitude, phase, and shape. Current vanishes at the two outer tips.

The narrow feed is represented by a uniform impressed electric field over the selected feed region; zero separation gives the delta-gap limit. An equivalent axial current is retained through this region. The model does not resolve detailed feed geometry or gap capacitance, and feed separation is limited to remain small relative to the wavelength and antenna dimensions.

Choose **Open circuit** under **Feed termination** to constrain net port current to zero and solve the induced terminal voltage. This differs from setting the voltage source to zero, which shorts the feed. An open port can still have induced currents elsewhere on the antenna.

The inspector reports electrical length, feed current magnitude and phase, mesh size, peak wire current, and average power contribution. In open-circuit mode it also reports induced voltage magnitude and phase. Set the shared maximum PEC segment length in **Advanced**.

### End-driven wire antenna

Listed as **End-fed antenna** in the Add menu, this is an unbalanced two-arm PEC antenna with an explicit short counterpoise and a longer radiating arm. Both arms participate in the same coupled current solution.

The first placement click sets the counterpoise tip; the second sets the long-arm tip. The feed sits at the marked junction near the first endpoint. Choose a counterpoise length of **5%, 10%, 15%, 20%, or 25%** of the total tip-to-tip length; the default is 5%. The remaining length forms the long arm.

The feed voltage, phase, separation, wire radius, and open-circuit option work as for the center-fed dipole. The inspector additionally reports counterpoise and radiating-arm lengths. The mesh is aligned with the feed position and may use more intervals than the shared maximum segment length alone would suggest.

This model includes the return conductor explicitly. It does not assume an invisible ground, coaxial shield, or matching transformer, and it does not model a complete practical end-fed antenna installation.

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

Place a separate straight wire by clicking its two endpoints. Adjust its radius in the inspector. Set the maximum segment length for all PEC wires in **Advanced**.

The wire has no imposed excitation. Its complex current is induced by the prescribed-current sources and by the driven and passive PEC wires in the scene. All PEC-wire currents are solved together, so multiple scattering and mutual coupling include the center-fed and end-fed antennas as well as passive wires.

Each wire is divided into mesh intervals. The unknowns are current phasors at interior nodes, with linear interpolation between nodes and zero current at the two open ends. An $N$-interval wire therefore has $N-1$ complex unknowns.

The inspector reports mesh size, current-unknown count, peak current, and relevant warnings. **Advanced** shows the coupled-solve status and each wire’s segment length relative to wavelength. Yellow brightness represents the magnitude of the instantaneous current, and yellow chevrons indicate its direction; the peak-current readout instead uses phasor magnitude.

**Wires are electrically separate.** Separate wires must not overlap or touch; crossings and touching endpoints do not create electrical junctions. Arranging several wires into a polygon does not create an electrically closed loop.

### Infinite PEC plane

Choose two points to define the line where an infinite perfect electric conductor (PEC) intersects the simulation plane. The conductor extends indefinitely along this line and perpendicular to the screen; the two points do not define its physical extent.

Only one PEC plane is supported. Sources may be placed on either side, but each physical source element and each driven or passive PEC wire must remain entirely on one side without touching or crossing the plane. Separate elements of an array may occupy opposite sides.

Fields on each side are calculated independently using the method of images. The plane reflects fields and blocks transmission between the two half-spaces. Reflected coupling is included in the coupled PEC-wire system, including driven antennas.

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

The gamma controls change the visualization only. They do not change source currents, solved fields, or the PEC-wire solution. Colors and arrow lengths use nonlinear scaling and should not be read as linear quantitative scales.

Advanced also provides independent field-arrow and wire/plane-current-arrow densities; set either to zero to hide those arrows. **Simulation clock speed** changes animation time without changing frequency or wave speed. Optional **adaptive field resolution** refines field sampling with zoom and sustained frame rate without changing antenna currents or the PEC mesh. The shared PEC mesh control changes the numerical current solution, rather than just its display.

### Radiation pattern

Open **Radiation pattern** to view the far-field angular power distribution in the XY plane. The plot includes prescribed-current sources, solved driven and passive PEC-wire currents, and PEC images when a plane is present.

Power is averaged over an excitation cycle and normalized to the peak of the displayed cut. Choose a **−40 to 0 dB** scale or a **log1p** scale. Angles follow the simulation axes. This is a planar cut through the three-dimensional pattern, not a full 3D pattern or an absolute gain measurement.

The pattern need not resemble the instantaneous energy-flow arrows near an antenna: the arrows include reactive near-field behavior and vary through the cycle, while the radiation pattern describes cycle-averaged far-field power.

### Average power and diagnostics

Each source’s inspector shows its signed **Average power contribution**: positive means the source supplies net power to the field; negative means it absorbs net power. For a voltage-fed antenna, peak voltage and current phasors give:

$$
P_{\mathrm{feed}} = \frac{1}{2}\mathrm{Re}\left(\widetilde V\widetilde I^*\right)
$$

An ideal open-circuit port supplies no average power. Prescribed-current sources also have power readouts accounting for their interaction with the scene.

The **Scene** panel reports total average radiated power integrated over the full 3D far field, including interference and PEC images. This is separate from the peak-normalized XY radiation-pattern cut. All power values use simulation units, not watts.

**Advanced → Power diagnostics** compares net source power with total 3D radiation. A discrepancy above 3%, or an exceeded angular-integration budget, triggers a warning. Near-field smoothing, thin-wire approximations, and numerical quadrature can cause disagreement; these diagnostics do not certify physical accuracy.

## Using the workspace

1. Open **Add** and choose a component.
2. Follow the placement prompts to set its endpoints, position, or direction.
3. Select a component on the canvas or in the **Scene** list.
4. Edit its parameters in **Properties**.
5. Choose a field view and adjust frequency, wave speed, or display quality.
6. Pause the animation to inspect the instantaneous fields.
7. Open **Advanced** to tune display contrast or **Radiation pattern** to inspect the far-field distribution.

Use the **Pan** tool or middle-button dragging to move around the scene. The mouse wheel zooms around the cursor; footer buttons also control zoom. Zoom changes the view, not the physical dimensions of the components.

Low, Medium, and High quality settings control field sampling and applicable active-source discretization. **PEC-wire mesh resolution is controlled separately** by the shared maximum segment length in **Advanced**. This applies to center-fed dipoles, end-fed antennas, and passive wires; changing display quality does not change their current basis. Feed alignment can make the actual intervals smaller than the requested maximum.

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

Prescribed source currents and solved PEC-wire currents are integrated as current elements. A wire contribution carries a current moment equal to its current multiplied by its integration length. A Hertzian source already specifies that moment directly.

Field visualization and excitation by prescribed-current sources use a regularized outgoing-wave kernel:

$$
G_a(\mathbf r,\mathbf r') = \frac{e^{-ikR_a}}{R_a}, \qquad R_a = \sqrt{\lVert\mathbf r-\mathbf r'\rVert^2+a^2}
$$

The regularization length $a$ is the wire radius for solved PEC-wire sources and a fixed smoothing length for prescribed-current sources. It avoids a singular field at a current element, but also makes very near-source fields approximate. The PEC-wire interaction matrix uses the cylindrical formulation described below, rather than using this smoothing kernel for every interaction.

In the implementation's normalized units, the vector potential and fields are related by:

$$
\widetilde{\mathbf A}(\mathbf r) = \int I(s')\,\hat{\mathbf t}(s')\,G_a(\mathbf r,\mathbf r(s'))\,ds'
$$

$$
\widetilde{\mathbf E} = -i\omega\left[\widetilde{\mathbf A}+\frac{1}{k^2}\nabla\left(\nabla\cdot\widetilde{\mathbf A}\right)\right], \qquad \widetilde{\mathbf B} = \nabla\times\widetilde{\mathbf A}
$$

The usual common physical prefactor is omitted in these normalized expressions. Analytic derivatives of the kernel are used to evaluate the electric and magnetic fields. Prescribed and solved contributions use consistent current-moment scaling and are added as complex phasors.

### Coupled PEC-wire solution

On each driven or passive PEC wire, the scalar current is expanded in triangular basis functions:

$$
I(s) = \sum_{n=1}^{N-1} I_n f_n(s)
$$

Each basis function peaks at an interior node and decreases linearly to zero at its two neighboring nodes. The current is continuous along the wire and vanishes at its open endpoints.

Galerkin testing enforces a weighted tangential boundary condition. For an undriven wire, the condition is:

$$
\int f_m(s)\,\hat{\mathbf t}(s)\cdot\left[\widetilde{\mathbf E}_{\mathrm{prescribed}}(s)+\widetilde{\mathbf E}_{\mathrm{PEC}}(s)\right]ds = 0
$$

Here, the PEC field includes all solved driven and passive wires. On voltage-fed wires, a weighted impressed feed-field term replaces the zero right-hand side. The same feed weights define the port current used for power calculations. Each open-circuit feed adds an unknown terminal voltage and a zero-port-current constraint.

This produces one complex linear system for all driven and passive PEC wires. Integration by parts gives a weak form of the electric-field integral equation. The implementation uses a circumferentially averaged cylindrical self-interaction kernel and reciprocal Galerkin mutual interactions, evaluated with numerical quadrature. Quadrature samples are integration points, not additional current unknowns. When a PEC plane is present, image contributions account for reflected coupling; wires on opposite sides are electromagnetically isolated by the plane.

The solver checks the relative algebraic residual before displaying the solved PEC-wire fields. A small residual indicates that the discretized equations were solved accurately; it does not establish the physical accuracy of the approximation.

### Performance

Complex field data are cached so the animation can reconstruct instantaneous fields without repeating the electromagnetic solve every frame. Panning can reuse overlapping cached regions. With **Temporal cache** enabled, phase-indexed heatmaps are cached as well; arrows and currents continue to update continuously. Cache allocation is bounded, and temporal caching may be unavailable for a large sampled view.

Changes to source excitation require a new PEC-wire current solution when driven or passive wires are present. Cached matrix factors can be reused when the matrix-defining geometry, wave parameters, and feed constraints remain unchanged. More wires, finer meshes, smaller radii, and higher display quality can increase computation time.

The coupled solver allows up to **320 complex unknowns**, including wire-current unknowns and one additional voltage unknown per open port. If a solve fails or a limit is exceeded, the interface reports the issue, clears the solved PEC-wire contributions, and disables power readouts rather than displaying stale results.

## Scope and limitations

- **Prescribed-current sources:** Hertzian dipoles, circular loops, and their array elements retain imposed currents. In contrast, center-fed and end-fed PEC-wire currents respond self-consistently to other sources, wires, and the PEC plane.
- **Ideal feeds:** voltage-fed wires use zero-impedance sources and a narrow impressed-field region. Detailed terminals, gap capacitance, feedlines, transformers, matching networks, and nonzero source impedances are not modeled.
- **Approximate thin-wire PEC model:** the solver represents axial wire current with cylindrical self interactions and approximate mutual interactions, rather than solving a full surface-current problem. End caps are not modeled, and displayed near-wire fields retain smoothing.
- **Ideal infinite plane:** only one zero-thickness PEC plane is supported. Finite edges, apertures, material losses, and transmission through the plane are not modeled.
- **Separate straight wires:** electrical junctions and connected wire loops are not modeled.
- **Mesh sensitivity:** inspect results as mesh length changes. Excessively fine intervals relative to the wire radius can produce unstable or sensitive current profiles; finer is not always better.
- **Small-loop assumption:** loop current is uniform and prescribed, including when the loop becomes electrically large and that approximation is no longer reliable.
- **Near-source smoothing:** fields very close to sources or wires should be interpreted qualitatively.
- **Normalized units:** displayed amplitudes and energy-flux colors are not calibrated SI measurements. Average source power and total radiated power are reported in simulation units. The interface does not report feed impedance; practical matching networks are not modeled.
- **Planar visualization:** the screen shows a slice through 3D fields, not a full 3D viewer.

The coupled PEC-wire calculation is a simplified method-of-moments model. The simulator is intended for exploration and intuition, rather than validated engineering design.

## Things to explore

- Change a dipole's electrical length and compare near- and far-field structure.
- Vary the relative phase of two perpendicular Hertzian sources and inspect the rotating electric field.
- Compare electric-dipole and small-loop fields.
- Build broadside and end-fire arrays, then vary spacing and progressive phase.
- Place a passive wire parallel to a source and vary its length and separation.
- Add several separate passive wires and observe how coupling changes their currents, the driven antenna current, and scattered fields.
- Compare center-fed and end-fed antennas while varying the counterpoise fraction.
- Switch a receiving wire antenna between an open circuit and a zero-voltage source to compare open- and short-circuit responses.
- Compare source-power contributions and total 3D radiated power as excitation phase and geometry change.
- Compare current distributions and fields across several PEC mesh resolutions.
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

The simulator runs in the browser using JavaScript and **p5.js**. Field calculation, the coupled PEC-wire solve, and rendering run client-side; no server-side electromagnetic computation is required.

Feedback, bug reports, and suggestions are welcome. When reporting a numerical issue, include the scene geometry, frequency, wave speed, wire radii, mesh settings, and any solver warning.
