import { useState, useEffect } from "react";

const MEMBERS = ["Blake", "Nick", "Jordan", "Zack", "Andrew", "Jermaine"];
const CATEGORIES = ["Taste", "Texture", "Biscuit", "Chicken", "Presentation"];

const SUGGESTED_SPOTS = [
  { name: "Bojangles", type: "Fast Food", note: "Southern staple — famous Bo-Berry Biscuits & seasoned chicken" },
  { name: "Chick-fil-A", type: "Fast Food", note: "Juicy pressure-cooked chicken on a buttered biscuit" },
  { name: "McDonald's", type: "Fast Food", note: "Classic McChicken Biscuit — a road trip go-to" },
  { name: "Hardee's", type: "Fast Food", note: "Hand-breaded chicken, made-from-scratch biscuits" },
  { name: "Popeyes", type: "Fast Food", note: "Spicy Louisiana-style chicken on a flaky biscuit" },
  { name: "The Biscuit Shop", type: "Local", note: "Memphis OG — rotating specials, big portions" },
  { name: "Brother Juniper's", type: "Local", note: "Midtown Memphis brunch legend, thick biscuits" },
  { name: "Sunrise Memphis", type: "Local", note: "Eclectic Midtown spot with creative biscuit builds" },
  { name: "Flea Market Restaurant", type: "Local", note: "Cash-only South Memphis institution, soul food roots" },
  { name: "Whole Hog Café", type: "Local", note: "BBQ joint that does a mean chicken biscuit on weekends" },
];

const StarRating = ({ value, onChange, disabled }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        onClick={() => !disabled && onChange(star)}
        style={{
          background: "none",
          border: "none",
          cursor: disabled ? "default" : "pointer",
          fontSize: 28,
          padding: "2px 1px",
          color: star <= value ? "#E8A020" : "#3a2a12",
          transition: "transform 0.1s",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => { if (!disabled) e.target.style.transform = "scale(1.2)"; }}
        onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; }}
      >
        ★
      </button>
    ))}
  </div>
);

const overallScore = (ratings) => {
  const vals = Object.values(ratings).filter(Boolean);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};

// Average all reviews for the same restaurant
const avgScore = (reviews, restaurantName) => {
  const matching = reviews.filter(
    (r) => r.name.toLowerCase() === restaurantName.toLowerCase() && r.overall
  );
  if (!matching.length) return null;
  const avg = matching.reduce((a, b) => a + parseFloat(b.overall), 0) / matching.length;
  return avg.toFixed(1);
};

const ScoreBadge = ({ score }) => {
  if (!score) return null;
  const n = parseFloat(score);
  const color = n >= 4.5 ? "#22c55e" : n >= 3.5 ? "#E8A020" : n >= 2.5 ? "#f97316" : "#ef4444";
  return (
    <div style={{
      background: color,
      color: "#fff",
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 700,
      fontSize: 22,
      borderRadius: 8,
      padding: "4px 14px",
      letterSpacing: 1,
      minWidth: 54,
      textAlign: "center",
    }}>{score}</div>
  );
};

const MemberTag = ({ name }) => (
  <span style={{
    background: "#3d2510",
    color: "#E8A020",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "'Oswald', sans-serif",
  }}>{name}</span>
);

export default function App() {
  const [view, setView] = useState("home");
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ name: "", reviewer: "", notes: "", ratings: {} });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const r = localStorage.getItem("cb-reviews");
      if (r) setReviews(JSON.parse(r));
      // Restore last-used reviewer
      const lastReviewer = localStorage.getItem("cb-last-reviewer");
      if (lastReviewer) setForm((f) => ({ ...f, reviewer: lastReviewer }));
    } catch {}
    setLoading(false);
  }, []);

  const saveReviews = (updated) => {
    setReviews(updated);
    localStorage.setItem("cb-reviews", JSON.stringify(updated));
  };

  const submitReview = () => {
    if (!form.name.trim() || !form.reviewer) return;
    const rev = {
      id: Date.now(),
      name: form.name.trim(),
      reviewer: form.reviewer,
      notes: form.notes.trim(),
      ratings: form.ratings,
      overall: overallScore(form.ratings),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    saveReviews([rev, ...reviews]);
    localStorage.setItem("cb-last-reviewer", form.reviewer);
    setForm((f) => ({ name: "", reviewer: f.reviewer, notes: "", ratings: {} }));
    setSaved(true);
    setTimeout(() => { setSaved(false); setView("list"); }, 1200);
  };

  const deleteReview = (id) => {
    saveReviews(reviews.filter((r) => r.id !== id));
  };

  // Unique restaurants sorted by their group average
  const leaderboard = Array.from(new Set(reviews.map((r) => r.name)))
    .map((name) => ({ name, score: avgScore(reviews, name) }))
    .sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));

  const sorted = [...reviews].sort((a, b) => parseFloat(b.overall || 0) - parseFloat(a.overall || 0));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1a0f05",
      fontFamily: "'Inter', sans-serif",
      color: "#f5e6cc",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #E8A020 100%)",
        padding: "28px 20px 20px",
        textAlign: "center",
        borderBottom: "3px solid #E8A020",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ fontSize: 44, marginBottom: 4 }}>🍗</div>
        <div style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#fff",
          textShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>Memphis Biscuit Boys</div>
        <div style={{ fontSize: 13, color: "#fde68a", letterSpacing: 3, marginTop: 2, textTransform: "uppercase" }}>
          Chicken Biscuit Rankings
        </div>
      </div>

      {/* Nav */}
      <div style={{
        display: "flex",
        background: "#2d1a08",
        borderBottom: "1px solid #3d2510",
      }}>
        {[
          { id: "home", label: "🏠 Home" },
          { id: "add", label: "＋ Add Review" },
          { id: "list", label: `📋 Reviews (${reviews.length})` },
          { id: "suggestions", label: "📍 Where to Go" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              flex: 1,
              padding: "12px 4px",
              background: view === tab.id ? "#E8A020" : "none",
              border: "none",
              color: view === tab.id ? "#1a0f05" : "#c9a97a",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* HOME */}
        {view === "home" && (
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#c9a97a" }}>Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🫙</div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: "#E8A020", marginBottom: 8 }}>
                  No reviews yet, fellas.
                </div>
                <div style={{ color: "#c9a97a", marginBottom: 24 }}>
                  You're heading to Bojangles tomorrow — add your first review after that run.
                </div>
                <button onClick={() => setView("add")} style={btnStyle}>
                  Add First Review
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, color: "#E8A020", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
                  🏆 Current Leaderboard
                </div>
                {leaderboard.slice(0, 5).map((entry, i) => {
                  const reviewers = reviews
                    .filter((r) => r.name.toLowerCase() === entry.name.toLowerCase())
                    .map((r) => r.reviewer);
                  return (
                    <div key={entry.name} style={cardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: 28,
                            color: i === 0 ? "#E8A020" : "#5a3a1a",
                            minWidth: 32,
                          }}>#{i + 1}</span>
                          <div>
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, color: "#f5e6cc" }}>{entry.name}</div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              {reviewers.map((rev) => <MemberTag key={rev} name={rev} />)}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <ScoreBadge score={entry.score} />
                          <div style={{ fontSize: 10, color: "#9a7050", marginTop: 3 }}>avg of {reviewers.length}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {leaderboard.length > 5 && (
                  <button onClick={() => setView("list")} style={{ ...btnStyle, width: "100%", marginTop: 8 }}>
                    See All {reviews.length} Reviews
                  </button>
                )}
              </div>
            )}

            {/* Bojangles callout */}
            <div style={{
              marginTop: 28,
              background: "linear-gradient(135deg, #7c2d12, #431407)",
              border: "1px solid #E8A020",
              borderRadius: 12,
              padding: 18,
            }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: "#E8A020", marginBottom: 4 }}>
                📅 UP NEXT: BOJANGLES
              </div>
              <div style={{ color: "#f5e6cc", fontSize: 14, marginBottom: 12 }}>
                Tomorrow's mission. Known for their famous seasoned chicken and made-from-scratch biscuits. The Bo-Berry Biscuit is legendary — but you're there for the chicken.
              </div>
              <button onClick={() => setView("add")} style={btnStyle}>
                Pre-load Review Form →
              </button>
            </div>
          </div>
        )}

        {/* ADD REVIEW */}
        {view === "add" && (
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: "#E8A020", marginBottom: 20, textTransform: "uppercase", letterSpacing: 1 }}>
              New Review
            </div>

            {/* Who are you? */}
            <div style={cardStyle}>
              <label style={labelStyle}>Who are you?</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {MEMBERS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setForm({ ...form, reviewer: m })}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: form.reviewer === m ? "#E8A020" : "#3d2510",
                      background: form.reviewer === m ? "#E8A020" : "#1a0f05",
                      color: form.reviewer === m ? "#1a0f05" : "#c9a97a",
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      letterSpacing: 0.5,
                      transition: "all 0.15s",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Restaurant Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Bojangles"
                style={inputStyle}
              />
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, color: "#E8A020", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>
                Rate Each Category
              </div>
              {CATEGORIES.map((cat) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#f5e6cc", minWidth: 110 }}>{cat}</span>
                  <StarRating
                    value={form.ratings[cat] || 0}
                    onChange={(v) => setForm({ ...form, ratings: { ...form.ratings, [cat]: v } })}
                  />
                </div>
              ))}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #3d2510", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: "#E8A020" }}>OVERALL</span>
                <ScoreBadge score={overallScore(form.ratings)} />
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any thoughts on this spot? Hot honey? Soggy biscuit? Spill it."
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <button
              onClick={submitReview}
              disabled={!form.name.trim() || !form.reviewer || saved}
              style={{
                ...btnStyle,
                width: "100%",
                fontSize: 16,
                padding: "14px 20px",
                opacity: (!form.name.trim() || !form.reviewer) ? 0.5 : 1,
                background: saved ? "#22c55e" : "#E8A020",
              }}
            >
              {saved ? "✓ Saved!" : "Submit Review"}
            </button>
            {!form.reviewer && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#9a7050" }}>
                Pick your name above to submit
              </div>
            )}
          </div>
        )}

        {/* LIST */}
        {view === "list" && (
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: "#E8A020", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
              All Reviews
            </div>
            {reviews.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#c9a97a" }}>No reviews yet. Go eat some biscuits.</div>
            ) : (
              sorted.map((r) => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: "#f5e6cc" }}>{r.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {r.reviewer && <MemberTag name={r.reviewer} />}
                        <span style={{ fontSize: 12, color: "#9a7050" }}>{r.date}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ScoreBadge score={r.overall} />
                      <button onClick={() => deleteReview(r.id)} style={{
                        background: "none", border: "none", cursor: "pointer", color: "#5a3a1a", fontSize: 18,
                      }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                    {CATEGORIES.map((cat) => (
                      <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#9a7050", textTransform: "uppercase", letterSpacing: 0.5 }}>{cat}</span>
                        <div style={{ display: "flex", gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span key={s} style={{ fontSize: 12, color: s <= (r.ratings[cat] || 0) ? "#E8A020" : "#3a2a12" }}>★</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {r.notes && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "#c9a97a", fontStyle: "italic", borderTop: "1px solid #3d2510", paddingTop: 8 }}>
                      "{r.notes}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* SUGGESTIONS */}
        {view === "suggestions" && (
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: "#E8A020", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
              Where to Go
            </div>
            <div style={{ fontSize: 13, color: "#9a7050", marginBottom: 20 }}>Memphis & chains — all fair game for the rankings.</div>

            {["Fast Food", "Local"].map((type) => (
              <div key={type}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: "#c9a97a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, marginTop: 8 }}>
                  {type === "Fast Food" ? "⚡ Fast Food" : "🏡 Local Memphis"}
                </div>
                {SUGGESTED_SPOTS.filter((s) => s.type === type).map((spot) => {
                  const spotScore = avgScore(reviews, spot.name);
                  const reviewers = reviews
                    .filter((r) => r.name.toLowerCase() === spot.name.toLowerCase())
                    .map((r) => r.reviewer);
                  return (
                    <div key={spot.name} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: "#f5e6cc" }}>{spot.name}</span>
                          {spot.name === "Bojangles" && (
                            <span style={{ background: "#E8A020", color: "#1a0f05", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>Tomorrow</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#9a7050", marginBottom: reviewers.length ? 6 : 0 }}>{spot.note}</div>
                        {reviewers.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {reviewers.map((rev) => <MemberTag key={rev + spot.name} name={rev} />)}
                          </div>
                        )}
                      </div>
                      <div style={{ marginLeft: 12 }}>
                        {spotScore ? (
                          <div style={{ textAlign: "center" }}>
                            <ScoreBadge score={spotScore} />
                            <div style={{ fontSize: 10, color: "#9a7050", marginTop: 3 }}>{reviewers.length} review{reviewers.length !== 1 ? "s" : ""}</div>
                          </div>
                        ) : (
                          <button onClick={() => { setForm((f) => ({ ...f, name: spot.name })); setView("add"); }} style={{
                            background: "none",
                            border: "1px solid #3d2510",
                            color: "#9a7050",
                            borderRadius: 6,
                            padding: "5px 10px",
                            fontSize: 11,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}>Rate it</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

const cardStyle = {
  background: "#2d1a08",
  border: "1px solid #3d2510",
  borderRadius: 12,
  padding: "16px",
  marginBottom: 12,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  color: "#9a7050",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  background: "#1a0f05",
  border: "1px solid #3d2510",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#f5e6cc",
  fontSize: 15,
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const btnStyle = {
  background: "#E8A020",
  color: "#1a0f05",
  border: "none",
  borderRadius: 8,
  padding: "11px 20px",
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
};
