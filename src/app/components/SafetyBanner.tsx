import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    AlertOctagon,
    AlertTriangle,
    Info,
    Box,
    X,
} from 'lucide-react';
import { usePhysicsStore } from '../../store/physicsStore';

// ── Severity tiers ──────────────────────────────────────────────────────────

type Tier = 'critical' | 'warning' | 'caution' | 'info';

const TIER_CONFIG: Record<Tier, {
    bg: string;
    border: string;
    text: string;
    glow: string;
    Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
}> = {
    critical: {
        bg: 'rgba(239,68,68,0.12)',
        border: 'rgba(239,68,68,0.60)',
        text: '#fca5a5',
        glow: '0 0 18px rgba(239,68,68,0.35)',
        Icon: AlertOctagon,
        label: 'CRITICAL',
    },
    warning: {
        bg: 'rgba(249,115,22,0.12)',
        border: 'rgba(249,115,22,0.60)',
        text: '#fdba74',
        glow: '0 0 18px rgba(249,115,22,0.30)',
        Icon: AlertTriangle,
        label: 'WARNING',
    },
    caution: {
        bg: 'rgba(234,179,8,0.12)',
        border: 'rgba(234,179,8,0.55)',
        text: '#fde047',
        glow: '0 0 14px rgba(234,179,8,0.25)',
        Icon: Info,
        label: 'CAUTION',
    },
    info: {
        bg: 'rgba(59,130,246,0.10)',
        border: 'rgba(59,130,246,0.50)',
        text: '#93c5fd',
        glow: '0 0 14px rgba(59,130,246,0.20)',
        Icon: Box,
        label: 'INFO',
    },
};

// Map the emoji prefix PhysicsEngine injects → tier
function resolveTier(msg: string): Tier {
    if (msg.startsWith('💀') || msg.startsWith('⚡')) return 'critical';
    if (msg.startsWith('🔄')) return 'warning';
    if (msg.startsWith('🔌')) return 'caution';
    return 'info';   //lol 
}

// ── Single toast card ────────────────────────────────────────────────────────

interface ToastCardProps {
    id: string;           // stable key for AnimatePresence
    message: string;
    onDismiss: (id: string) => void;
}

function ToastCard({ id, message, onDismiss }: ToastCardProps) {
    const tier = resolveTier(message);
    const config = TIER_CONFIG[tier];
    const { Icon } = config;

    return (
        <motion.div
            layout
            key={id}
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{
                background: config.bg,
                border: `1px solid ${config.border}`,
                boxShadow: config.glow,
                borderRadius: '12px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                maxWidth: '380px',
                backdropFilter: 'blur(12px)',
            }}
        >
            {/* Severity icon */}
            <div style={{ flexShrink: 0, paddingTop: '1px' }}>
                <Icon className="w-4 h-4" style={{ color: config.text }} />
            </div>

            {/* Message body */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p
                    style={{
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: config.text,
                        marginBottom: '2px',
                        opacity: 0.7,
                    }}
                >
                    {config.label}
                </p>
                <p
                    style={{
                        fontSize: '11.5px',
                        fontFamily: 'monospace',
                        color: config.text,
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                    }}
                >
                    {message}
                </p>
            </div>

            {/* Dismiss button */}
            <button
                onClick={() => onDismiss(id)}
                style={{
                    flexShrink: 0,
                    color: config.text,
                    opacity: 0.55,
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: 'none',
                    transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.opacity = '0.55')}
                title="Dismiss"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </motion.div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SafetyBanner() {
    // Pull live errors directly from the physics store.
    // This re-renders automatically every time rebuildGraph() runs.
    const errors = usePhysicsStore(state => state.errors);

    // Local dismissal tracking (dismissed IDs won't re-show until errors list
    // changes — when the user fixes the circuit they disappear on their own).
    const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

    const dismiss = (id: string) =>
        setDismissed(prev => new Set([...prev, id]));

    // Build unique ID per error message (hash-based, stable for same text)
    const toastItems = errors
        .map((msg: string, idx: number) => ({ id: `${idx}::${msg}`, message: msg }))
        .filter((item: { id: string; message: string }) => !dismissed.has(item.id));

    // Clear dismissed list whenever the underlying errors array changes
    // (user fixed something → fresh set of errors = fresh banners)
    React.useEffect(() => {
        setDismissed(new Set());
    }, [errors]);

    if (toastItems.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: '72px',   // below the 56px navbar
                right: '16px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'none',  // container doesn't eat clicks
            }}
        >
            <AnimatePresence mode="popLayout">
                {toastItems.map(item => (
                    <div key={item.id} style={{ pointerEvents: 'all' }}>
                        <ToastCard
                            id={item.id}
                            message={item.message}
                            onDismiss={dismiss}
                        />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}

