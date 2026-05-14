import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://kkmkfkcrpotenbjeluga.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbWtma2NycG90ZW5iamVsdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQ3NDcsImV4cCI6MjA5NDM2MDc0N30._XIeH9pIGlsdL1j2D_wrQkJF-w01P7Mfq1ED4kOiN4M"
);

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function App() {
  const [entries, setEntries] = useState([]);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("money_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data);
      setBalance(data.reduce((sum, e) => sum + Number(e.change), 0));
    }
    setLoading(false);
  };

  const apply = async (sign) => {
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("money_entries")
      .insert({
        change: sign * val,
        note: note.trim() || null,
        ts: new Date().toLocaleString(),
      })
      .select()
      .single();

    if (!error && data) {
      setEntries((prev) => [data, ...prev]);
      setBalance((prev) => prev + Number(data.change));
      setAmount("");
      setNote("");
    }
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("money_entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (!error) {
      setEntries([]);
      setBalance(0);
    }
    setShowReset(false);
    setSaving(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") apply(1);
  };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.balanceLabel}>Balance</div>

        {loading ? (
          <div style={styles.loadingBalance}>—</div>
        ) : (
          <div style={{ ...styles.balance, color: balance < 0 ? "#ff6b6b" : "#e2e2e2" }}>
            {fmt(balance)}
          </div>
        )}

        <input
          style={styles.input}
          type="number"
          placeholder="0.00"
          value={amount}
          min="0"
          disabled={saving}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={handleKey}
        />
        <input
          style={{ ...styles.input, ...styles.noteInput }}
          type="text"
          placeholder="Note (optional)"
          value={note}
          maxLength={80}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKey}
        />

        <div style={styles.btnRow}>
          <button
            style={{ ...styles.btn, ...styles.btnAdd, opacity: saving ? 0.5 : 1 }}
            onClick={() => apply(1)}
            disabled={saving}
          >
            + Add
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnSub, opacity: saving ? 0.5 : 1 }}
            onClick={() => apply(-1)}
            disabled={saving}
          >
            − Subtract
          </button>
        </div>

        {!loading && entries.length > 0 && (
          <div style={styles.log}>
            {entries.map((e) => (
              <div key={e.id} style={styles.entry}>
                <div style={styles.entryLeft}>
                  <span style={{ ...styles.entryAmount, color: e.change < 0 ? "#ff6b6b" : "#6bffb8" }}>
                    {e.change > 0 ? "+" : ""}
                    {fmt(e.change)}
                  </span>
                  {e.note && <span style={styles.entryNote}>{e.note}</span>}
                </div>
                <span style={styles.entryTs}>{e.ts}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div style={styles.resetWrap}>
            {!showReset ? (
              <button style={styles.resetBtn} onClick={() => setShowReset(true)} disabled={saving}>
                Reset
              </button>
            ) : (
              <div style={styles.confirmRow}>
                <span style={styles.confirmText}>Erase everything?</span>
                <button
                  style={{ ...styles.btn, ...styles.btnSub, padding: "6px 16px", opacity: saving ? 0.5 : 1 }}
                  onClick={reset}
                  disabled={saving}
                >
                  Yes
                </button>
                <button
                  style={{ ...styles.btn, background: "#2a2a2a", padding: "6px 16px", color: "#aaa" }}
                  onClick={() => setShowReset(false)}
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100dvh",
    background: "#0f0f0f",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "40px 16px 80px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  balanceLabel: {
    color: "#666",
    fontSize: 13,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: -6,
  },
  balance: {
    fontSize: 52,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    marginBottom: 8,
  },
  loadingBalance: {
    fontSize: 52,
    fontWeight: 700,
    color: "#333",
    lineHeight: 1,
    marginBottom: 8,
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    color: "#e2e2e2",
    fontSize: 18,
    padding: "14px 16px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  noteInput: {
    fontSize: 14,
    padding: "10px 16px",
    color: "#aaa",
  },
  btnRow: {
    display: "flex",
    gap: 10,
    marginTop: 2,
  },
  btn: {
    flex: 1,
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    padding: "14px 0",
    cursor: "pointer",
  },
  btnAdd: {
    background: "#1a3a2a",
    color: "#6bffb8",
  },
  btnSub: {
    background: "#3a1a1a",
    color: "#ff6b6b",
  },
  log: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 360,
    overflowY: "auto",
  },
  entry: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#1a1a1a",
    borderRadius: 8,
    padding: "10px 14px",
    gap: 8,
  },
  entryLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  entryAmount: {
    fontSize: 15,
    fontWeight: 600,
  },
  entryNote: {
    fontSize: 12,
    color: "#666",
  },
  entryTs: {
    fontSize: 11,
    color: "#444",
    whiteSpace: "nowrap",
  },
  resetWrap: {
    marginTop: 12,
    display: "flex",
    justifyContent: "center",
  },
  resetBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    color: "#555",
    fontSize: 13,
    padding: "8px 20px",
    cursor: "pointer",
  },
  confirmRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  confirmText: {
    color: "#888",
    fontSize: 13,
  },
};
