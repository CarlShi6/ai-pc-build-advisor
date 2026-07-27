import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowDownRight, ArrowRight, BadgeCheck, Bot, Box, Check,
  CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Cpu, Fan, Gauge,
  GitCompareArrows, HardDrive, ImageOff, Info, Layers3, MemoryStick, MonitorCog,
  PackageCheck, PanelLeft, Power, Send, ShieldCheck, ShoppingBag,
  SlidersHorizontal, Sparkles, Target, X, Zap,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI PC Build Advisor — Decision Workspace" },
      { name: "description", content: "A visual workspace for choosing, comparing, and purchasing a compatible custom PC build." },
    ],
  }),
  component: BuildWorkspace,
});

type Part = {
  id: string; category: string; eyebrow: string; name: string; price: number;
  retailer: string; stock: string; stockTone: "good" | "low"; specs: string[];
  reason: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  visual: string; compatibility: string;
};

const parts: Part[] = [
  { id: "cpu", category: "Processor", eyebrow: "CPU", name: "AMD Ryzen 7 7800X3D", price: 369, retailer: "Newegg", stock: "In stock", stockTone: "good", specs: ["8 cores / 16 threads", "Up to 5.0 GHz", "96MB L3 cache", "120W TDP"], reason: "Best-in-class gaming performance without overspending on cores you won’t use.", Icon: Cpu, visual: "cpu", compatibility: "Fits AM5 platform" },
  { id: "gpu", category: "Graphics", eyebrow: "GPU", name: "NVIDIA GeForce RTX 4080 SUPER 16GB", price: 999, retailer: "Best Buy", stock: "In stock", stockTone: "good", specs: ["16GB GDDR6X", "10240 CUDA cores", "320W board power", "DLSS 3.5"], reason: "The strongest fit for 1440p high refresh and smooth 4K without 4090 pricing.", Icon: MonitorCog, visual: "gpu", compatibility: "Clearance verified" },
  { id: "motherboard", category: "Motherboard", eyebrow: "BOARD", name: "MSI MAG B650 Tomahawk WiFi", price: 219, retailer: "Amazon", stock: "In stock", stockTone: "good", specs: ["AM5 socket", "DDR5", "Wi‑Fi 6E", "3× M.2 slots"], reason: "Reliable power delivery and the connectivity you need, without enthusiast extras.", Icon: Cpu, visual: "board", compatibility: "BIOS ready" },
  { id: "ram", category: "Memory", eyebrow: "RAM", name: "G.Skill Flare X5 32GB DDR5-6000", price: 104, retailer: "Newegg", stock: "Low stock", stockTone: "low", specs: ["32GB (2×16GB)", "DDR5-6000", "CL30 latency", "AMD EXPO"], reason: "The AM5 sweet spot: enough capacity for gaming, streaming, and everyday creation.", Icon: MemoryStick, visual: "ram", compatibility: "EXPO profile supported" },
  { id: "ssd", category: "Storage", eyebrow: "SSD", name: "Samsung 990 PRO 2TB NVMe", price: 169, retailer: "Amazon", stock: "In stock", stockTone: "good", specs: ["2TB capacity", "7,450 MB/s read", "PCIe 4.0", "5-year warranty"], reason: "Fast enough for large game libraries and creator files with room to grow.", Icon: HardDrive, visual: "ssd", compatibility: "M.2 slot available" },
  { id: "cooler", category: "CPU Cooler", eyebrow: "COOLING", name: "Arctic Liquid Freezer III 360", price: 119, retailer: "Amazon", stock: "In stock", stockTone: "good", specs: ["360mm radiator", "3× 120mm fans", "AM5 ready", "PWM control"], reason: "Quiet thermal headroom keeps boost clocks stable during long sessions.", Icon: Fan, visual: "cooler", compatibility: "Top mount verified" },
  { id: "psu", category: "Power Supply", eyebrow: "PSU", name: "Corsair RM850x 850W 80+ Gold", price: 139, retailer: "Best Buy", stock: "In stock", stockTone: "good", specs: ["850W output", "80+ Gold", "Fully modular", "ATX 3.1"], reason: "Meets this build’s demand with efficient, quiet power and modern GPU support.", Icon: Power, visual: "psu", compatibility: "Review upgrade headroom" },
  { id: "case", category: "Case", eyebrow: "CHASSIS", name: "Fractal Design North XL", price: 179, retailer: "Newegg", stock: "In stock", stockTone: "good", specs: ["Full tower", "Mesh front", "GPU up to 413mm", "Tempered glass"], reason: "Excellent airflow with a refined look and effortless room for every selected part.", Icon: Box, visual: "case", compatibility: "All dimensions verified" },
];

const replacement = { name: "NVIDIA GeForce RTX 4070 Ti SUPER 16GB", price: 799 };

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /></div>;
}

function ProductVisual({ part, failed, onFail }: { part: Part; failed: boolean; onFail: () => void }) {
  const Icon = part.Icon;
  return (
    <button className={`part-visual visual-${part.visual}`} onClick={(event) => { event.stopPropagation(); onFail(); }} aria-label={`Preview placeholder for ${part.category}. Click to test image failure.`}>
      {failed ? <span className="failed-visual"><ImageOff size={25} /><small>Preview unavailable</small><em>Category placeholder</em></span> : <>
        <span className="visual-grid" /><Icon size={47} strokeWidth={1.25} /><span className="visual-label">{part.eyebrow}</span>
      </>}
    </button>
  );
}

function BuildWorkspace() {
  const [selectedId, setSelectedId] = useState("gpu");
  const [detailPart, setDetailPart] = useState<Part | null>(null);
  const [comparePart, setComparePart] = useState<Part | null>(null);
  const [replacementPart, setReplacementPart] = useState<Part | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"needs" | "build" | "summary">("build");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const total = useMemo(() => parts.reduce((sum, part) => sum + part.price, 0), []);
  const budget = 2500;
  const delta = budget - total;
  const selectedPart = parts.find((part) => part.id === selectedId) ?? parts[1];
  const toggleImageFailure = (id: string) => setFailedImages((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const sendMessage = () => {
    if (!chatText.trim()) return;
    setMessages((current) => [...current, chatText.trim()]);
    setChatText("");
  };

  return (
    <div className="advisor-shell">
      <header className="workspace-header">
        <div className="workspace-brand"><BrandMark /><span className="brand-name">AI装机助手</span><span className="brand-divider">/</span><span className="brand-subtitle">BUILD ADVISOR</span></div>
        <div className="build-context"><span className="context-dot" /><div><small>ACTIVE BUILD</small><strong>1440p Performance</strong></div><button aria-label="Open build menu"><ChevronRight size={16} /></button></div>
        <nav className="header-actions" aria-label="Account"><button>Saved Builds</button><button className="avatar-button" aria-label="Account menu">CG</button></nav>
      </header>

      <main className="workspace-frame">
        <aside className={`requirements-rail ${mobilePanel === "needs" ? "mobile-active" : ""}`}>
          <div className="rail-scroll">
            <div className="rail-heading"><div><span className="section-kicker">YOUR BUILD BRIEF</span><h2>What matters most</h2></div><button className="icon-button" aria-label="Edit requirements"><SlidersHorizontal size={17} /></button></div>
            <section className="brief-card">
              <div className="brief-budget"><span>Target budget</span><strong>$2,500</strong><em>Flexible by $100</em></div>
              <div className="brief-meter"><span style={{ width: "91%" }} /></div>
              <div className="brief-grid">
                <div><Target size={15} /><span><small>PLAY AT</small>1440p / 165Hz</span></div>
                <div><Gauge size={15} /><span><small>PRIORITY</small>Performance</span></div>
                <div><Sparkles size={15} /><span><small>LOOK</small>Dark / minimal</span></div>
                <div><MonitorCog size={15} /><span><small>USE</small>Gaming + creator</span></div>
              </div>
              <div className="preference-tags"><span>NVIDIA preferred</span><span>Wi‑Fi required</span><span>Quiet build</span></div>
            </section>
            <section className="advisor-chat">
              <div className="chat-title"><span><Bot size={17} /> AI build guide</span><em>Ready</em></div>
              <div className="chat-thread">
                <div className="chat-message assistant"><div className="mini-avatar"><Sparkles size={13} /></div><p>I’ve balanced your build around high-refresh 1440p play, with enough memory and storage for creative work.</p></div>
                <div className="chat-message user"><p>Keep it quiet, and don’t sacrifice upgrade room.</p></div>
                <div className="chat-message assistant"><div className="mini-avatar"><Sparkles size={13} /></div><p>Done. The case and cooling are intentionally oversized for lower fan speeds.</p></div>
                {messages.map((message, index) => <div className="chat-message user" key={`${message}-${index}`}><p>{message}</p></div>)}
              </div>
              <div className="quick-prompts"><button onClick={() => setComparePart(parts[1])}>Can I save $200?</button><button onClick={() => setWarningOpen(true)}>Check upgrade headroom</button></div>
            </section>
          </div>
          <div className="chat-composer"><input value={chatText} onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="Ask about this build…" aria-label="Ask the AI build guide" /><button onClick={sendMessage} aria-label="Send message"><Send size={16} /></button></div>
        </aside>

        <section className={`build-workspace ${mobilePanel === "build" ? "mobile-active" : ""}`}>
          <div className="workspace-scroll">
            <div className="workspace-intro">
              <div><span className="recommendation-pill"><Sparkles size={12} /> RECOMMENDED FOR YOU</span><h1>1440p Performance Build</h1><p>A balanced, quiet gaming system with creator-ready headroom.</p></div>
              <div className="workspace-tools"><button className="text-button" onClick={() => toggleImageFailure(selectedId)}><ImageOff size={14} /> Test image fallback</button><button className="outline-button"><SlidersHorizontal size={15} /> Refine build</button></div>
            </div>
            <div className="decision-strip">
              <div><span className="decision-icon"><Gauge size={17} /></span><p><small>GAMING</small><strong>Excellent</strong></p></div>
              <div><span className="decision-icon"><CircleDollarSign size={17} /></span><p><small>VALUE</small><strong>89 / 100</strong></p></div>
              <div><span className="decision-icon"><Zap size={17} /></span><p><small>EST. POWER</small><strong>612W</strong></p></div>
              <div><span className="decision-icon"><ShieldCheck size={17} /></span><p><small>FIT CHECK</small><strong>7 verified</strong></p></div>
            </div>
            <div className="parts-heading"><div><h2>Recommended components</h2><span>8 parts · click a card to focus</span></div><span className="compact-hint"><Info size={13} /> Prices are prototype data</span></div>
            <div className="component-list">
              {parts.map((part, index) => (
                <article className={`component-card ${selectedId === part.id ? "selected" : ""}`} key={part.id} onClick={() => setSelectedId(part.id)}>
                  <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
                  <ProductVisual part={part} failed={failedImages.includes(part.id)} onFail={() => toggleImageFailure(part.id)} />
                  <div className="part-main">
                    <div className="part-meta"><span>{part.category}</span><span className={`stock ${part.stockTone}`}>{part.stock}</span></div>
                    <h3>{part.name}</h3>
                    <div className="spec-list">{part.specs.map((spec) => <span key={spec}>{spec}</span>)}</div>
                    <p className="selection-reason"><Sparkles size={13} /> {part.reason}</p>
                  </div>
                  <div className="part-actions">
                    <div className="price-block"><strong>${part.price.toLocaleString()}</strong><span>at {part.retailer}</span></div>
                    <span className={`compat-status ${part.id === "psu" ? "warning" : ""}`}>{part.id === "psu" ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}{part.compatibility}</span>
                    <div className="card-buttons">
                      <button onClick={(event) => { event.stopPropagation(); setComparePart(part); }}><GitCompareArrows size={15} /> Compare</button>
                      <button onClick={(event) => { event.stopPropagation(); setReplacementPart(part); }}><Layers3 size={15} /> Replace</button>
                      <button className="detail-button" onClick={(event) => { event.stopPropagation(); setDetailPart(part); }} aria-label={`View details for ${part.name}`}><ChevronRight size={17} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {comparePart && <div className="center-overlay compare-overlay" role="dialog" aria-modal="true" aria-label="Component comparison">
            <div className="overlay-header"><div><span className="section-kicker">SIDE-BY-SIDE DECISION</span><h2>Save $200 without losing the experience</h2></div><button className="icon-button" onClick={() => setComparePart(null)} aria-label="Close comparison"><X size={18} /></button></div>
            <div className="comparison-hero">
              <div className="compare-product current"><span className="choice-tag">CURRENT PICK</span><ProductVisual part={comparePart} failed={false} onFail={() => {}} /><h3>{comparePart.name}</h3><strong>${comparePart.price}</strong></div>
              <div className="versus">VS</div>
              <div className="compare-product recommended"><span className="choice-tag"><BadgeCheck size={13} /> BEST VALUE</span><ProductVisual part={comparePart} failed={false} onFail={() => {}} /><h3>{replacement.name}</h3><strong>${replacement.price}</strong></div>
            </div>
            <div className="delta-grid">
              <div className="positive"><CircleDollarSign size={17} /><span><small>PRICE</small><strong>Save $200</strong></span></div>
              <div><Gauge size={17} /><span><small>PERFORMANCE</small><strong>−11% at 4K</strong></span></div>
              <div className="positive"><Target size={17} /><span><small>VALUE</small><strong>+8 points</strong></span></div>
              <div className="positive"><Zap size={17} /><span><small>POWER</small><strong>−35 watts</strong></span></div>
              <div className="positive"><ShieldCheck size={17} /><span><small>COMPATIBILITY</small><strong>No impact</strong></span></div>
            </div>
            <div className="tradeoff-grid"><div><h4><ArrowDownRight size={15} /> Main gains</h4><p>$200 back in budget, lower heat output, and nearly identical 1440p performance.</p></div><div><h4><AlertTriangle size={15} /> Main tradeoffs</h4><p>Less 4K headroom and slower ray tracing in the most demanding games.</p></div></div>
            <div className="recommendation-callout"><span><Sparkles size={18} /></span><div><small>AI RECOMMENDATION</small><strong>Choose the 4070 Ti SUPER if 1440p is your real priority.</strong></div><button onClick={() => { setComparePart(null); setReplacementPart(parts[1]); }}>Choose this option <ArrowRight size={15} /></button></div>
          </div>}

          {detailPart && <div className="center-overlay detail-overlay" role="dialog" aria-modal="true" aria-label="Component details">
            <div className="overlay-header"><div><span className="section-kicker">{detailPart.category}</span><h2>{detailPart.name}</h2></div><button className="icon-button" onClick={() => setDetailPart(null)} aria-label="Close details"><X size={18} /></button></div>
            <div className="detail-layout"><ProductVisual part={detailPart} failed={failedImages.includes(detailPart.id)} onFail={() => toggleImageFailure(detailPart.id)} /><div><span className="detail-price">${detailPart.price} <small>at {detailPart.retailer}</small></span><p>{detailPart.reason}</p><h4>What you need to know</h4><ul>{detailPart.specs.map((spec) => <li key={spec}><Check size={14} /> {spec}</li>)}<li><ShieldCheck size={14} /> {detailPart.compatibility}</li></ul></div></div>
            <div className="detail-footer"><button className="outline-button" onClick={() => toggleImageFailure(detailPart.id)}><ImageOff size={15} /> Toggle image failure</button><button className="primary-button" onClick={() => { setDetailPart(null); setComparePart(detailPart); }}>Compare alternatives <ArrowRight size={15} /></button></div>
          </div>}
        </section>

        <aside className={`summary-rail ${mobilePanel === "summary" ? "mobile-active" : ""}`}>
          <div className="summary-top"><div className="summary-heading"><span className="section-kicker">YOUR BUILD</span><span className="live-dot">LIVE</span></div><div className="total-price"><span>Estimated total</span><strong>${total.toLocaleString()}</strong><small>8 components</small></div><div className="budget-status"><div><span>Budget</span><strong>${budget.toLocaleString()}</strong></div><div><span>Remaining</span><strong>${delta}</strong></div><div className="budget-track"><span style={{ width: `${(total / budget) * 100}%` }} /></div><p>9% under your target <CheckCircle2 size={13} /></p></div></div>
          <div className="summary-scores">
            <button className="warning-summary" onClick={() => setWarningOpen(!warningOpen)}><span className="warning-icon"><AlertTriangle size={17} /></span><div><small>COMPATIBILITY</small><strong>Review 1 note</strong></div><ChevronRight size={17} /></button>
            {warningOpen && <div className="warning-detail"><strong>Power headroom is tight</strong><p>The 850W PSU is safe for this build, but leaves limited room for a future flagship GPU.</p><button onClick={() => setReplacementPart(parts[6])}>Review PSU options</button></div>}
            <div className="score-row"><div><span><Gauge size={15} /> Performance</span><strong>94</strong></div><div className="score-track"><span style={{ width: "94%" }} /></div><small>Excellent for 1440p high refresh</small></div>
            <div className="score-row"><div><span><CircleDollarSign size={15} /> Value</span><strong>89</strong></div><div className="score-track"><span style={{ width: "89%" }} /></div><small>Strong price-to-performance</small></div>
            <div className="power-card"><div className="power-ring"><Zap size={18} /><strong>612W</strong></div><div><small>ESTIMATED POWER</small><strong>72% PSU load</strong><span>Healthy under load</span></div></div>
          </div>
          <div className="summary-insight"><Sparkles size={15} /><p><strong>Well balanced.</strong> The GPU drives your target resolution while the CPU keeps high-frame-rate games responsive.</p></div>
          <div className="summary-footer"><button className="primary-button shopping-button" onClick={() => setShoppingOpen(true)}><ShoppingBag size={17} /> Preview shopping list <ArrowRight size={16} /></button><button className="save-button"><ClipboardList size={15} /> Save or export build</button><p><ShieldCheck size={12} /> Compatibility checked across 14 rules</p></div>
        </aside>
      </main>

      <nav className="mobile-tabs" aria-label="Workspace sections"><button className={mobilePanel === "needs" ? "active" : ""} onClick={() => setMobilePanel("needs")}><PanelLeft size={18} />Needs</button><button className={mobilePanel === "build" ? "active" : ""} onClick={() => setMobilePanel("build")}><Cpu size={18} />Build</button><button className={mobilePanel === "summary" ? "active" : ""} onClick={() => setMobilePanel("summary")}><ClipboardList size={18} />Summary</button></nav>

      {replacementPart && <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Confirm replacement"><div className="confirm-modal">
        <div className="confirm-icon"><GitCompareArrows size={22} /></div><span className="section-kicker">PREVIEW CHANGE</span><h2>Replace {replacementPart.category}?</h2><p>This prototype will preview the lower-cost alternative. Your current selection is preserved until you confirm.</p>
        <div className="replacement-summary"><div><span>Current</span><strong>{replacementPart.name}</strong><small>${replacementPart.price}</small></div><ArrowRight size={18} /><div><span>Alternative</span><strong>{replacementPart.id === "gpu" ? replacement.name : `Recommended ${replacementPart.category} alternative`}</strong><small>${Math.max(79, replacementPart.price - 40)}</small></div></div>
        <div className="confirm-actions"><button className="outline-button" onClick={() => setReplacementPart(null)}>Keep current part</button><button className="primary-button" onClick={() => setReplacementPart(null)}><Check size={15} /> Confirm replacement</button></div>
      </div></div>}

      {shoppingOpen && <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Shopping list preview"><div className="shopping-modal">
        <div className="overlay-header"><div><span className="section-kicker">PURCHASE PLAN</span><h2>Shopping list preview</h2></div><button className="icon-button" onClick={() => setShoppingOpen(false)} aria-label="Close shopping list"><X size={18} /></button></div>
        <div className="shopping-summary"><PackageCheck size={21} /><div><strong>8 parts from 3 retailers</strong><span>All prices are reference estimates</span></div><strong>${total.toLocaleString()}</strong></div>
        <div className="shopping-list">{parts.map((part) => <div key={part.id}><span className="shop-icon"><part.Icon size={16} /></span><p><strong>{part.name}</strong><small>{part.retailer} · {part.stock}</small></p><strong>${part.price}</strong></div>)}</div>
        <div className="shopping-actions"><button className="outline-button" onClick={() => setShoppingOpen(false)}>Back to build</button><button className="primary-button"><ShoppingBag size={15} /> Open purchase references</button></div>
      </div></div>}
    </div>
  );
}
