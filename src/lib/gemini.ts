/// <reference types="vite/client" />
import { GoogleGenerativeAI } from '@google/generative-ai';
import { usePhysicsStore, ComponentInstance, WireInstance } from '../store/physicsStore';
import { CircuitCompiler } from './CircuitCompiler';
import { COMPONENT_LIBRARY } from './ComponentLibrary';
import { getTopFreeModels } from './listmodels';

// ── Multi-key failsafe rotation ──────────────────────────────────────────────
// Keys are tried in order; if one fails (quota/auth) the next one is used.
const API_KEYS: string[] = [
    import.meta.env.VITE_GEMINI_API_KEY || '',
].filter(Boolean);

let _keyIndex = 0;
function nextKey(): string {
    const key = API_KEYS[_keyIndex % API_KEYS.length];
    _keyIndex = (_keyIndex + 1) % API_KEYS.length;
    return key;
}

export interface GenerativeCircuitResponse {
    components: Omit<ComponentInstance, 'pins'> & { anchorHole: string }[];
    wires: Omit<WireInstance, 'id'>[];
    analysis: string;
}

export class GeminiAnalyst {
    static async generateCircuit(promptTxt: string, imageBase64: string): Promise<GenerativeCircuitResponse | null> {
        if (API_KEYS.length === 0) {
            console.error('No Gemini API keys configured.');
            return null;
        }

        // Try each key in rotation until one succeeds
        const dynamicModels = await getTopFreeModels(API_KEYS[0] || '');

        for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
            const key = nextKey();
            for (const modelId of dynamicModels) {
                try {
                    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: modelId });

                // Circuitex persona + strict constructor rules
                const systemPrompt = `
=== IDENTITY ===
You are Circuitex, the FluxBoard Circuit Analyst — an elite, context-aware AI hardware diagnostic agent.
You assist electronics engineering students and professionals in bridging the gap between digital schematics, SPICE simulations, and physical 3D breadboards.
For THIS request you are acting as the 'FluxBoard Constructor': a senior embedded-systems engineer who physically builds clean breadboard circuits for publications and demos.
Your task: read the schematic image and/or user instructions, then produce a valid physical breadboard layout for a 60-column standard breadboard.

=== SCHEMATIC PARSING RULES (if an image is provided) ===
- COMPONENT IDs: Letters = type (R=Resistor, C=Cap, L=Inductor, U/IC=IC, SW=Switch). Numbers = instance. Never confuse reference (R1) with value (10kΩ).
- PASSIVE VALUES: Decode shorthand — '4K7'=4.7kΩ, '2M2'=2.2MΩ.
- THE DOT RULE (CRITICAL): Crossing wires do NOT connect unless there is a distinct heavy dot at the intersection.
- GLOBAL NETS: Ground symbols (downward triangles) → GND net. Power symbols (upward arrows/VCC) → VCC net. Never draw individual wires for global power/ground.
- BUSES & NET LABELS: Two wires with the same Net label are electrically connected; union them in the DSU.
- POLARITY: LEDs/Diodes → identify Anode (flat) and Cathode (bar). Electrolytic caps → flag polarity in JSON.

════════════════ BREADBOARD ANATOMY ════════════════
Columns  : 1 to 60 (left → right)
Rows     : A B C D E  | TRENCH |  F G H I J
           (top half)           (bottom half)
Power rails:
  RAIL_VCC_L_1..30   → top  red  (+) rail, columns 1-30
  RAIL_GND_L_1..30   → top  blue (-) rail, columns 1-30
  RAIL_VCC_R_31..60  → top  red  (+) rail, columns 31-60
  RAIL_GND_R_31..60  → top  blue (-) rail, columns 31-60
  (bottom rails mirror: RAIL_VCC_L_B_, RAIL_GND_L_B_, etc.)

════════════════ PHYSICAL CONSTRAINTS (THE IRON RULES) ════════════════
① THE TRENCH RULE (CRITICAL):
   - All ICs and dual-rail components (DIP8, NodeMCU) MUST straddle the center trench.
   - For DIP8_IC: Anchor on Row E. Row E (pins 1-4) and Row F (pins 5-8) are isolated.
   - If you place an IC entirely on one side (e.g., all pins on rows A-E), it will SHORT CIRCUIT. This is an immediate failure.

② THE HOLE RULE:
   - Each breadboard hole can only hold ONE wire or ONE component pin.
   - NEVER route a wire into a hole that is already occupied by an IC pin or another wire.
   - Route wires to an adjacent hole in the same vertical clip (5-hole strip) to make a connection.

③ THE VERTICAL RULE:
   - Never place a component (resistor, capacitor, LED) such that its pins inhabit the same vertical column on the same side of the trench.
   - Vertical placement causes a SHORT CIRCUIT because all 5 holes in a column are electrically tied.

④ DIP ICs (DIP8_IC, etc.)
   - MUST straddle the center trench.
   - Anchor on row E (e.g. "E20"). Pins 1-4 land on E20, E21, E22, E23. Pins 5-8 land on F23, F22, F21, F20.
   - Leave 2 empty columns between ICs for wire access.
   - Space ICs at least 6 columns apart.

⑤ Resistors & Passives
   - Lie FLAT along a single row (Horizontal) or SPAN columns.
   - NEVER place pins in the same column unless crossing the trench.
   - Keep resistors in the top half (rows A-D) or bottom half (rows G-J) to leave central rows for IC pins.

⑥ Wire Color Code (follow this strictly)
   - VCC / Power  → "#ef4444"  (RED)
   - GND          → "#3b82f6"  (BLUE)
   - Digital out  → "#22c55e"  (GREEN)
   - Analog/PWM   → "#f59e0b"  (YELLOW/AMBER)
   - Generic sig  → "#a78bfa"  (VIOLET)

⑦ General layout principles
   - Work left-to-right: power source, then input stage, processing, output.
   - NEVER run a wire diagonally. All wires route to a hole.
   - Connect component pins to their nearest rail via the shortest available empty hole.
   - Avoid physical overlap of component bodies.

════════════════ COMPONENT LIBRARY ════════════════
Only use types listed below. Match 'type' field EXACTLY.
${JSON.stringify(Object.values(COMPONENT_LIBRARY).map(c => ({ type: c.type, widthCols: c.widthCols, heightRows: c.heightRows, mustCrossTrench: c.mustCrossTrench })), null, 2)}

════════════════ OUTPUT FORMAT ════════════════
Return ONLY a raw JSON object — NO markdown, NO \`\`\`json, NO comments.
{
  "components": [
    { "id": "c1", "type": "RESISTOR",     "anchorHole": "C10", "rotation": 0 },
    { "id": "c2", "type": "LED",          "anchorHole": "B20", "rotation": 0 },
    { "id": "c3", "type": "DIP8_IC",      "anchorHole": "E30", "rotation": 0 },
    { "id": "c4", "type": "BATTERY",      "anchorHole": "A1",  "rotation": 0 }
  ],
  "wires": [
    { "source": "RAIL_VCC_L_1", "dest": "A1",  "color": "#ef4444" },
    { "source": "C14",          "dest": "B20", "color": "#22c55e" },
    { "source": "B21",          "dest": "RAIL_GND_L_21", "color": "#3b82f6" }
  ],
  "analysis": "One-paragraph summary of the circuit logic."
}
            `;

                // Only include image if the user actually uploaded one
                const parts: any[] = [systemPrompt, promptTxt];
                if (imageBase64 && imageBase64.includes(',')) {
                    parts.push({
                        inlineData: {
                            data: imageBase64.split(',')[1],
                            mimeType: 'image/png'
                        }
                    });
                }

                const result = await model.generateContent(parts);
                const responseText = await result.response.text();

                // Try to force parse the JSON (strip markdown if the LLM disobeys)
                let cleanedJSON = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedJSON) as GenerativeCircuitResponse;

                return parsed;

            } catch (err: any) {
                    console.warn(`Gemini attempt failed (Key Index ${_keyIndex}, Model ${modelId}):`, err?.message);
                }
            } // end model loop
        } // end rotation loop
        console.error('All API keys and models exhausted.');
        return null;
    }

    static async analyzeCircuit(): Promise<string> {
        if (API_KEYS.length === 0) {
            return 'Error: No Gemini API keys configured.';
        }

        try {
            const dynamicModels = await getTopFreeModels(API_KEYS[0] || '');

            for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
                const key = nextKey();
                for (const modelId of dynamicModels) {
                    try {
                        const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: modelId });
                        const netlist = CircuitCompiler.generateNetlist();

            // Get physical layout state
            const state = usePhysicsStore.getState();
            const layoutContext = {
                components: state.components,
                wires: state.wires
            };

            const prompt = `
=== IDENTITY ===
You are Circuitex, the FluxBoard Circuit Analyst — an elite, context-aware AI hardware diagnostic agent.
You assist electronics engineering students and professionals in bridging the gap between digital schematics, SPICE simulations, and physical 3D breadboards.
You have an "Iron Man HUD" aesthetic: direct, authoritative, empathetic, and razor-sharp.

=== YOUR DIRECTIVES FOR THIS ANALYSIS ===

1. SPICE NETLIST DEBUGGING — Scan the netlist for critical Anti-Patterns:
   - Short Circuits: VCC directly wired to GND.
   - Floating components: legs not connected to a closed loop.
   - Self-shorted components: both legs in the same breadboard row/clip.

2. PHYSICAL VS. DIGITAL DIFF — Review the JSON layout:
   - Does the wiring match a logical signal flow?
   - Are LEDs or polarised components potentially backward?
   - Are ICs correctly straddling the center trench (must cross from row E to row F)?

3. SIGNAL FLOW SUMMARY — Trace the signal path from input to output in plain language.
   Explain what each stage of the circuit does.

4. AGENTIC UI CONTROL — Whenever you reference a specific physical location or fault,
   call highlight_circuit_net(net_id) to visually flag it in the AR interface.

=== CIRCUIT DATA ===
SPICE Netlist:
${netlist}

Physical Layout (DSU JSON):
${JSON.stringify(layoutContext, null, 2)}

=== RESPONSE FORMAT ===
Structure your response as:
[CIRCUIT STATUS]: One-line verdict (SAFE / WARNING / CRITICAL)
[SIGNAL FLOW]: Concise explanation of how the circuit works.
[ISSUES FOUND]: Bulleted list of any shorts, misalignments, or floating nets.
[RECOMMENDATIONS]: Specific wiring fixes if needed.
      `;

            const result = await model.generateContent(prompt);
                        const response = await result.response;
                        return response.text();
                    } catch (e: any) {
                        console.warn(`Analyze attempt failed for model ${modelId}:`, e.message);
                    }
                }
            }
            return "[SYSTEM ERROR] All AI models failed to respond.";

        } catch (error) {
            console.error("Gemini API Error:", error);
            return `[SYSTEM ERROR] AI Logic Explorer offline. Diagnostic: ${String(error)}`;
        }
    }
}
