import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, Copy, Check, Download, FileText, RefreshCw, Eye, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getContrastColor(hexcolor: string) {
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
    const r = parseInt(hexcolor.substring(0,2), 16) || 0;
    const g = parseInt(hexcolor.substring(2,4), 16) || 0;
    const b = parseInt(hexcolor.substring(4,6), 16) || 0;
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'text-[#1A1A1A]' : 'text-white';
}

// Types
type Color = { hex: string; name: string; usage: string };
type Typography = { headerFont: string; bodyFont: string; reasoning: string };
type BrandIdentity = {
  brandVoice: string;
  colorPalette: Color[];
  typography: Typography;
  logoPrompt: string;
  secondaryMarkPrompt: string;
};

// --- Components ---

function FontLoader({ font }: { font: string }) {
  if (!font) return null;
  const formattedFont = font.replace(/\s+/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${formattedFont}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`;
  return <link href={url} rel="stylesheet" />;
}

export default function App() {
  const [mission, setMission] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [brandData, setBrandData] = useState<BrandIdentity | null>(null);
  const [primaryLogo, setPrimaryLogo] = useState<string | null>(null);
  const [secondaryMark, setSecondaryMark] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRegeneratingPalette, setIsRegeneratingPalette] = useState(false);
  const [isPreviewTypographyOpen, setIsPreviewTypographyOpen] = useState(false);

  const regeneratePalette = async () => {
    if (!mission.trim() || !brandData) return;
    setIsRegeneratingPalette(true);
    try {
      const res = await fetch('/api/generate-palette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission })
      });
      if (!res.ok) throw new Error('Failed to regenerate palette');
      const newPalette = await res.json();
      setBrandData({ ...brandData, colorPalette: newPalette });
    } catch (err) {
      console.error('Error regenerating palette:', err);
      // Optional: Show toast instead of alert in complex apps
    } finally {
      setIsRegeneratingPalette(false);
    }
  };

  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F4F4F2',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Brand-Bible.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mission.trim()) return;

    setLoading(true);
    setBrandData(null);
    setPrimaryLogo(null);
    setSecondaryMark(null);

    try {
      setCurrentStep('Analyzing mission to define brand voice, colors, and typography...');
      const brandRes = await fetch('/api/generate-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission })
      });
      
      if (!brandRes.ok) throw new Error('Failed to generate brand foundation');
      const data: BrandIdentity = await brandRes.json();
      setBrandData(data);

      setCurrentStep('Generating primary logo...');
      const primaryRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: data.logoPrompt, aspectRatio: '1:1' })
      });
      if (primaryRes.ok) {
        const pData = await primaryRes.json();
        setPrimaryLogo(`data:image/png;base64,${pData.imageBase64}`);
      }

      setCurrentStep('Generating secondary mark...');
      const secondaryRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: data.secondaryMarkPrompt, aspectRatio: '1:1' })
      });
      if (secondaryRes.ok) {
        const sData = await secondaryRes.json();
        setSecondaryMark(`data:image/png;base64,${sData.imageBase64}`);
      }

    } catch (error) {
      console.error(error);
      alert('Failed to generate brand. Please try again.');
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F2] text-[#1A1A1A] p-2 md:p-6 lg:p-12 font-sans selection:bg-[#1A1A1A] selection:text-white flex items-center justify-center">
      {brandData?.typography.headerFont && <FontLoader font={brandData.typography.headerFont} />}
      {brandData?.typography.bodyFont && <FontLoader font={brandData.typography.bodyFont} />}

      <div className="w-full max-w-7xl flex flex-col md:flex-row border-[8px] md:border-[12px] border-[#1A1A1A] min-h-[calc(100vh-1rem)] md:min-h-[800px] bg-[#F4F4F2] overflow-hidden">
        <AnimatePresence mode="wait">
          {!brandData && !loading ? (
            <motion.div 
              key="input-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center p-6 bg-white w-full h-full"
            >
              <div className="w-full max-w-xl space-y-8 border-4 border-[#1A1A1A] p-6 md:p-10 bg-[#F4F4F2] shadow-[12px_12px_0px_0px_rgba(26,26,26,1)]">
                <div className="space-y-4">
                  <div className="text-[10px] tracking-[0.3em] font-bold text-[#1A1A1A] mb-2 uppercase border-b-2 border-[#1A1A1A] pb-2 inline-block">Identity System v1.0</div>
                  <h1 className="text-4xl md:text-5xl font-black leading-none uppercase tracking-tighter">Brand<br/>Generator</h1>
                  <p className="text-[10px] font-mono text-[#1A1A1A] uppercase tracking-widest leading-relaxed">Define your mission. Let AI craft your complete visual identity.</p>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6 mt-8">
                  <div className="relative flex flex-col">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] mb-2">Mission Profile Input</label>
                    <textarea 
                      value={mission}
                      onChange={(e) => setMission(e.target.value)}
                      placeholder="e.g., We are a sustainable outdoor gear company focusing on lightweight, biodegradable materials for the modern minimalist explorer..."
                      className="w-full resize-none border-2 border-[#1A1A1A] bg-white p-4 text-sm shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all focus:outline-none focus:translate-y-[2px] focus:translate-x-[2px] focus:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] font-serif italic"
                      rows={5}
                      required
                    />
                    <div className="mt-6 flex justify-end">
                      <button 
                        type="submit"
                        disabled={!mission.trim()}
                        className="flex items-center gap-2 bg-[#1A1A1A] px-8 py-3 text-[10px] font-bold tracking-widest text-white uppercase hover:bg-slate-800 disabled:opacity-50 transition-colors"
                      >
                        Execute
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : loading ? (
             <motion.div 
              key="loading-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 bg-white w-full h-full min-h-[600px]"
            >
               <div className="relative flex h-24 w-24 items-center justify-center">
                   <div className="absolute inset-0 animate-ping border-4 border-[#1A1A1A] bg-transparent rounded-none"></div>
                   <div className="h-10 w-10 bg-[#1A1A1A] animate-spin" />
               </div>
               <div className="space-y-4 max-w-sm mt-8">
                  <h2 className="text-2xl font-black uppercase tracking-widest text-[#1A1A1A] animate-pulse">Compiling Assets</h2>
                  <p className="text-[10px] font-mono text-slate-500 uppercase h-6">{currentStep}</p>
               </div>
            </motion.div>
          ) : brandData ? (
            <motion.div 
              key="dashboard-view"
              ref={dashboardRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col md:flex-row w-full flex-1"
            >
              <aside className="w-full md:w-80 flex flex-col border-b md:border-b-0 md:border-r border-[#1A1A1A] bg-white shrink-0">
                <div className="p-6 md:p-8 border-b border-[#1A1A1A]">
                  <div className="text-[10px] tracking-[0.3em] font-bold text-[#1A1A1A] mb-2 uppercase">Identity System v1.0</div>
                  <h1 
                    className="text-4xl lg:text-5xl font-black leading-[0.9] uppercase tracking-tighter" 
                    style={{ fontFamily: brandData.typography.headerFont ? `"${brandData.typography.headerFont}", sans-serif` : 'inherit' }}
                  >
                    Brand<br/>Bible
                  </h1>
                </div>
                <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-8">
                  <section>
                    <h2 className="text-[10px] font-bold uppercase tracking-widest mb-4 text-slate-400">Mission Profile</h2>
                    <p className="text-base font-serif italic leading-snug" style={{ fontFamily: brandData.typography.bodyFont ? `"${brandData.typography.bodyFont}", sans-serif` : 'inherit' }}>
                      {brandData.brandVoice}
                    </p>
                  </section>
                  <section className="space-y-4">
                    <div className="flex justify-between items-end pb-2 border-b border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Project ID</span>
                      <span className="text-[10px] font-mono">#AF-{new Date().getFullYear()}</span>
                    </div>
                    <div className="flex justify-between items-end pb-2 border-b border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Archetype</span>
                      <span className="text-[10px] font-mono text-right truncate pl-2 max-w-[120px]">{brandData.colorPalette[0]?.name || 'The Creator'}</span>
                    </div>
                    <div className="flex justify-between items-end pb-2 border-b border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Font Pairing</span>
                      <span className="text-[10px] font-mono text-right max-w-[120px] truncate">{brandData.typography.headerFont}</span>
                    </div>
                  </section>
                  <div className="mt-auto pt-4 md:pt-8 w-full space-y-3">
                    <button 
                      onClick={exportPDF}
                      disabled={isExporting || !primaryLogo || !secondaryMark}
                      className="w-full bg-white border-2 border-[#1A1A1A] text-[#1A1A1A] py-3 text-[10px] font-bold tracking-widest uppercase hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Generate PDF
                    </button>
                    <button 
                      onClick={() => { setBrandData(null); setMission(''); }}
                      className="w-full bg-[#1A1A1A] text-white py-3 text-[10px] font-bold tracking-widest uppercase hover:bg-slate-800 transition-colors"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              </aside>

              <main className="flex-1 flex flex-col bg-[#F4F4F2] min-h-0 overflow-y-auto overflow-x-hidden w-full">
                <div className="flex flex-col lg:flex-row border-b border-[#1A1A1A] shrink-0">
                  <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-[#1A1A1A] p-8 md:p-10 flex flex-col items-center justify-center bg-white min-h-[300px]">
                    <div className="w-full flex justify-between items-start mb-8 self-start">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Primary Mark</span>
                      {primaryLogo && (
                        <a 
                          href={primaryLogo} 
                          download="primary-mark.png" 
                          className="text-slate-400 hover:text-[#1A1A1A] transition-colors"
                          title="Download Primary Mark"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
                      {primaryLogo ? (
                         <img src={primaryLogo} alt="Primary Logo" className="w-full h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                      ) : (
                         <div className="flex flex-col items-center justify-center w-full h-full border-4 border-[#1A1A1A] gap-3 text-[#1A1A1A] font-mono text-[10px] uppercase">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span>Rendering</span>
                         </div>
                      )}
                    </div>
                  </div>
                  <div className="lg:w-1/2 p-8 md:p-10 bg-slate-100 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-full flex justify-between items-start mb-8 self-start">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Secondary Mark</span>
                      {secondaryMark && (
                        <a 
                          href={secondaryMark} 
                          download="secondary-mark.png" 
                          className="text-slate-400 hover:text-[#1A1A1A] transition-colors"
                          title="Download Secondary Mark"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center p-4">
                        {secondaryMark ? (
                           <img src={secondaryMark} alt="Secondary Mark" className="w-full h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
                        ) : (
                           <div className="flex flex-col items-center justify-center w-full h-full border-2 border-[#1A1A1A] gap-3 text-[#1A1A1A] font-mono text-[10px] uppercase bg-white">
                              <Loader2 className="h-6 w-6 animate-spin" />
                              <span>Rendering</span>
                           </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row shrink-0 border-b border-[#1A1A1A] min-h-[200px]">
                  <div className="sm:w-20 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-[#1A1A1A] bg-white flex flex-col items-center justify-center py-6 sm:py-0 gap-8 relative">
                    <span className="sm:rotate-[-90deg] whitespace-nowrap text-[10px] font-bold tracking-[0.5em] uppercase text-[#1A1A1A]">Palette</span>
                    <button 
                      onClick={regeneratePalette}
                      disabled={isRegeneratingPalette}
                      className="sm:absolute sm:bottom-6 text-slate-400 hover:text-[#1A1A1A] transition-colors disabled:opacity-50"
                      title="Regenerate Palette"
                    >
                      <RefreshCw className={cn("w-4 h-4", isRegeneratingPalette && "animate-spin")} />
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col sm:flex-row h-auto sm:h-full relative overflow-hidden">
                    <AnimatePresence mode="popLayout">
                      {isRegeneratingPalette && (
                         <motion.div 
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center"
                         >
                           <Loader2 className="w-8 h-8 text-[#1A1A1A] animate-spin" />
                         </motion.div>
                      )}
                    </AnimatePresence>
                    {brandData.colorPalette.map((color, i) => (
                      <ColorCard key={color.hex + i} color={color} isLast={i === brandData.colorPalette.length - 1} />
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row">
                  <div className="flex-1 p-8 md:p-10 bg-white border-b lg:border-b-0 lg:border-r border-[#1A1A1A]">
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] block">Typography: Header</span>
                      <button 
                        onClick={() => setIsPreviewTypographyOpen(true)}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#1A1A1A] transition-colors"
                        title="Preview Typography"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                    </div>
                    <h3 
                      className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-none mb-6 text-[#1A1A1A]"
                      style={{ fontFamily: brandData.typography.headerFont ? `"${brandData.typography.headerFont}", sans-serif` : 'inherit' }}
                    >
                      {brandData.typography.headerFont}
                    </h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-widest font-mono">
                      {brandData.typography.reasoning}
                    </p>
                  </div>
                  <div className="flex-1 p-8 md:p-10 bg-[#F4F4F2]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] block mb-6">Typography: Body</span>
                    <h3 
                      className="text-2xl md:text-3xl font-serif italic mb-6 text-[#1A1A1A]"
                      style={{ fontFamily: brandData.typography.bodyFont ? `"${brandData.typography.bodyFont}", sans-serif` : 'inherit' }}
                    >
                      {brandData.typography.bodyFont}
                    </h3>
                    <div 
                      className="text-sm text-slate-700 leading-relaxed max-w-lg space-y-6"
                      style={{ fontFamily: brandData.typography.bodyFont ? `"${brandData.typography.bodyFont}", sans-serif` : 'inherit' }}
                    >
                       <p>The foundation of the identity. Selected for high readability and a classic editorial feel. Provides a necessary human warmth against the rigid geometry of the display typeface.</p>
                       <p className="font-mono text-[10px] uppercase text-slate-400 tracking-[0.2em]">Aa Bb Cc Dd Ee Ff Gg<br/>0123456789</p>
                    </div>
                  </div>
                </div>
              </main>

              {/* Typography Preview Modal */}
              <AnimatePresence>
                {isPreviewTypographyOpen && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/80 backdrop-blur-sm"
                  >
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="bg-[#F4F4F2] border-[8px] md:border-[12px] border-[#1A1A1A] w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col shadow-[16px_16px_0px_0px_rgba(255,255,255,0.1)] relative"
                    >
                      <div className="flex items-center justify-between border-b-[4px] md:border-b-[8px] border-[#1A1A1A] p-6 bg-white sticky top-0 z-10">
                        <div className="text-[10px] tracking-[0.3em] font-bold text-[#1A1A1A] uppercase bg-[#1A1A1A] text-white px-3 py-1">Typography Preview</div>
                        <button 
                          onClick={() => setIsPreviewTypographyOpen(false)}
                          className="hover:scale-110 active:scale-95 transition-transform"
                        >
                          <X className="w-8 h-8 text-[#1A1A1A]" />
                        </button>
                      </div>
                      <div className="p-8 md:p-16 space-y-16 bg-white">
                        <div className="space-y-8">
                            <div className="flex items-center gap-4 border-b-2 border-[#1A1A1A] pb-4">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] bg-[#F4F4F2] px-3 py-1">Headers</span>
                              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{brandData.typography.headerFont}</span>
                            </div>
                            <div className="space-y-6 text-[#1A1A1A]" style={{ fontFamily: `"${brandData.typography.headerFont}", sans-serif` }}>
                              <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9]">The quick brown fox.</h1>
                              <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">Jumps over the lazy dog.</h2>
                              <h3 className="text-2xl md:text-3xl font-semibold uppercase tracking-tight">Pack my box with five dozen liquor jugs.</h3>
                            </div>
                        </div>
                        <div className="space-y-8">
                            <div className="flex items-center gap-4 border-b-2 border-[#1A1A1A] pb-4">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] bg-[#F4F4F2] px-3 py-1">Body Copy</span>
                              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{brandData.typography.bodyFont}</span>
                            </div>
                            <div className="space-y-6 text-[#1A1A1A]" style={{ fontFamily: `"${brandData.typography.bodyFont}", sans-serif` }}>
                              <p className="text-xl md:text-3xl leading-relaxed italic max-w-4xl">
                                Typography is the visual representation of language. It is a powerful tool that designers use to communicate messages and evoke emotions.
                              </p>
                              <p className="text-lg md:text-xl leading-relaxed max-w-3xl">
                                In a brand identity system, typography works in concert with color and form to establish a distinct voice. 
                                The contrast between a stark, geometric display face and a warm, highly legible serif or humanist sans-serif 
                                creates a rhythm that guides the reader's eye. Good typography should feel inevitable—as though these words 
                                could not have been set in any other way.
                              </p>
                            </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ColorCard({ color, isLast }: { color: Color; isLast: boolean; key?: React.Key }) {
  const [copied, setCopied] = useState(false);
  const textColorClass = getContrastColor(color.hex);
  const secondaryTextColorClass = textColorClass === 'text-white' ? 'text-white/70' : 'text-[#1A1A1A]/70';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={cn(
        "flex-1 h-full p-4 md:p-6 flex flex-col justify-end transition-opacity hover:opacity-95 relative cursor-pointer min-h-[120px] sm:min-h-0 group",
        !isLast && "border-b sm:border-b-0 sm:border-r border-[#1A1A1A]"
      )}
      style={{ backgroundColor: color.hex }}
      onClick={copyToClipboard}
    >
      <div className={cn("absolute top-4 right-4", textColorClass)}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <span className={cn("font-mono text-[10px] block mb-1", textColorClass)}>{color.hex}</span>
      <span className={cn("text-[8px] uppercase font-bold tracking-widest line-clamp-2", secondaryTextColorClass)}>
        {color.name}
      </span>
      <span className={cn("text-[8px] uppercase font-mono mt-1 opacity-60 line-clamp-1 border-t border-current/20 pt-1 mt-1", secondaryTextColorClass)}>
        Use: {color.usage}
      </span>
    </div>
  );
}

