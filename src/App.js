import React, { useRef, useState, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { jsPDF } from "jspdf"; 
import { 
  Camera, X, RefreshCw, Upload, History, FileText, Download, 
  Settings, Layers, Image as ImageIcon, Search, Type, Maximize2, 
  Wand2, ScanLine, Image, FileType, ChevronRight, Check
} from 'lucide-react';
import axios from 'axios';

const ScannerApp = () => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null); 

  // --- States ---
  const [activeTab, setActiveTab] = useState('scan');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data
  const [imgSrc, setImgSrc] = useState(null);
  const [processedImg, setProcessedImg] = useState(null);
  const [extractedText, setExtractedText] = useState(""); 
  
  // Search & History
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Logic ---

  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const lowerQuery = searchQuery.toLowerCase();
    return history.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) || 
      (item.textContent && item.textContent.toLowerCase().includes(lowerQuery))
    );
  }, [history, searchQuery]);

  const capture = useCallback(() => {
    const image = webcamRef.current.getScreenshot();
    if (image) {
      setImgSrc(image);
      setIsCameraActive(false);
    }
  }, [webcamRef]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImgSrc(e.target.result); 
        setIsCameraActive(false);
        // Clear processed result when new file uploaded
        setProcessedImg(null); 
        setExtractedText("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessImage = async (filterType = 'scan') => {
    if (!imgSrc) return;
    setLoading(true);
    
    try {
      const response = await axios.post('https://scanner-backend-jref.onrender.com', { 
        image: imgSrc,
        filter_type: filterType 
      });
      
      if (response.data.status === "success") {
        setProcessedImg(response.data.scanned_image);
        setExtractedText(response.data.text);
      }
    } catch (error) {
      console.error(error);
      alert("Backend Error: Ensure Python is running on port 8000");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePDF = () => {
    if (!processedImg) return;
    const doc = new jsPDF();
    const imgProps = doc.getImageProperties(processedImg);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    doc.addImage(processedImg, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    
    if (extractedText) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text("OCR Extracted Text", 10, 15);
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(extractedText, 180);
      doc.text(splitText, 10, 25);
    }

    const fileName = `Scan_${new Date().getTime()}.pdf`;
    const pdfBlob = doc.output('bloburl'); // Generate blob for preview
    doc.save(fileName); // Download file

    const newEntry = {
      id: Date.now(),
      name: fileName,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      previewUrl: pdfBlob,
      textContent: extractedText
    };
    
    setHistory(prev => [newEntry, ...prev]);
  };

  const resetAll = () => {
    setImgSrc(null);
    setProcessedImg(null);
    setExtractedText("");
    setIsCameraActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Helper Component for Highlighting
  const HighlightedText = ({ text, highlight }) => {
    if (!highlight.trim() || !text) return text || "";
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlight.toLowerCase() ? 
        <span key={i} className="bg-yellow-300 text-black rounded px-0.5">{part}</span> : part
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*, application/pdf" className="hidden" />

      {/* 1. SIDEBAR */}
      <aside className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 z-20">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200"><Layers size={22} /></div>
            <div>
              <span className="block font-bold text-lg tracking-tight text-slate-800">LensScan</span>
              <span className="block text-xs font-medium text-slate-400">Pro Digitizer</span>
            </div>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search history..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-10 pr-3 py-3 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <nav className="p-4 space-y-1">
          <button onClick={() => setActiveTab('scan')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'scan' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <ScanLine size={18} /> Scanner
            {activeTab === 'scan' && <ChevronRight size={14} className="ml-auto opacity-50" />}
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <History size={18} /> History
            {history.length > 0 && <span className="ml-auto bg-white text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">{history.length}</span>}
          </button>
        </nav>

        <div className="mt-auto p-5 border-t border-slate-100 bg-slate-50/50">
           <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400"><Settings size={18} /></div>
              <div className="text-xs">
                 <p className="font-bold text-slate-700">Settings</p>
                 <p className="text-slate-400">v2.4.0 (Stable)</p>
              </div>
           </div>
        </div>
      </aside>

      {/* 2. MAIN AREA */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Top Header */}
        <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur px-8 flex items-center justify-between shrink-0 z-10">
          <div>
             <h2 className="text-xl font-bold text-slate-800 capitalize">{activeTab} Dashboard</h2>
             <p className="text-sm text-slate-500 mt-0.5">Manage, process and export your documents.</p>
          </div>
          {activeTab === 'scan' && imgSrc && (
            <button onClick={resetAll} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <RefreshCw size={14} /> Start Over
            </button>
          )}
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-[#F8FAFC]">
          
          {/* --- VIEW: SCANNER --- */}
          {activeTab === 'scan' && (
            <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* --- LEFT COLUMN: INPUT --- */}
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-1">
                   {/* Container Header */}
                   <div className="px-6 py-4 flex justify-between items-center border-b border-slate-50 mb-1">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Input Source
                      </h3>
                      {isCameraActive && <span className="text-xs font-bold text-red-500 animate-pulse">● LIVE</span>}
                   </div>

                   {/* VISUAL AREA */}
                   <div className="relative aspect-[4/3] bg-slate-100 rounded-2xl overflow-hidden m-2 border border-slate-200 group">
                      {isCameraActive ? (
                        <>
                          <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" />
                          <button onClick={capture} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-2xl transition-transform active:scale-95">
                             <div className="w-14 h-14 rounded-full border-4 border-white bg-red-500 flex items-center justify-center"></div>
                          </button>
                        </>
                      ) : imgSrc ? (
                        // PREVIEW UPLOADED IMAGE HERE
                        <img src={imgSrc} alt="Input" className="w-full h-full object-contain" />
                      ) : (
                        // EMPTY STATE
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                           <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                             <Upload size={32} className="text-blue-500"/>
                           </div>
                           <p className="font-bold text-slate-600">No document selected</p>
                           <p className="text-sm mb-6">Upload an image or use the camera</p>
                           <div className="flex gap-3">
                              <button onClick={() => fileInputRef.current.click()} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
                                Upload File
                              </button>
                              <button onClick={() => setIsCameraActive(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                                Use Camera
                              </button>
                           </div>
                        </div>
                      )}
                      
                      {/* Close Camera Button */}
                      {isCameraActive && (
                        <button onClick={() => setIsCameraActive(false)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 backdrop-blur-sm">
                          <X size={20} />
                        </button>
                      )}
                   </div>

                   {/* CONTROLS (Only visible if image exists) */}
                   {imgSrc && !isCameraActive && (
                     <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <button onClick={() => handleProcessImage('scan')} disabled={loading} className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 border border-transparent transition-all">
                          <ScanLine size={20} /> <span className="text-[10px] font-bold">SMART SCAN</span>
                        </button>
                        <button onClick={() => handleProcessImage('enhance')} disabled={loading} className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 border border-transparent transition-all">
                          <Wand2 size={20} /> <span className="text-[10px] font-bold">ENHANCE</span>
                        </button>
                        <button onClick={() => handleProcessImage('bw')} disabled={loading} className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 border border-transparent transition-all">
                          <FileType size={20} /> <span className="text-[10px] font-bold">B & W</span>
                        </button>
                        <button onClick={() => handleProcessImage('photo')} disabled={loading} className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 border border-transparent transition-all">
                          <Image size={20} /> <span className="text-[10px] font-bold">ORIGINAL</span>
                        </button>
                     </div>
                   )}
                </div>
              </div>

              {/* --- RIGHT COLUMN: OUTPUT --- */}
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-1 h-full flex flex-col">
                   <div className="px-6 py-4 flex justify-between items-center border-b border-slate-50 mb-1">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${processedImg ? 'bg-green-500' : 'bg-slate-300'}`}></span> Processed Output
                      </h3>
                      {processedImg && (
                        <button onClick={handleSavePDF} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-all shadow-md">
                           <Download size={14} /> Download PDF
                        </button>
                      )}
                   </div>

                   <div className="flex-1 bg-slate-50/50 p-4 overflow-y-auto rounded-b-3xl">
                      {loading ? (
                         <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                            <h4 className="font-bold text-slate-700">Analyzing Document...</h4>
                            <p className="text-xs text-slate-400 mt-1">Applying CV filters & OCR</p>
                         </div>
                      ) : processedImg ? (
                         <div className="space-y-6">
                            {/* 1. Final Image Card */}
                            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                               <div className="flex justify-between items-center mb-2 px-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Visual Result</span>
                                  <button onClick={() => window.open(processedImg)} className="text-slate-400 hover:text-blue-600"><Maximize2 size={14}/></button>
                               </div>
                               <img src={processedImg} alt="Processed" className="w-full rounded-xl border border-slate-100" />
                            </div>

                            {/* 2. Text Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                               <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                  <div className="flex items-center gap-2 text-slate-500">
                                     <Type size={14} /> <span className="text-[10px] font-bold uppercase">Extracted Text</span>
                                  </div>
                                  <button onClick={() => navigator.clipboard.writeText(extractedText)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700">COPY TEXT</button>
                               </div>
                               <div 
                                 className="p-4 text-sm font-mono text-slate-600 leading-relaxed outline-none min-h-[150px]"
                                 contentEditable
                                 suppressContentEditableWarning
                               >
                                  <HighlightedText text={extractedText || "No readable text detected."} highlight={searchQuery} />
                               </div>
                            </div>
                         </div>
                      ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                            <Layers size={64} className="mb-4 stroke-1"/>
                            <p className="text-sm font-medium">Output will appear here</p>
                         </div>
                      )}
                   </div>
                </div>
              </div>

            </div>
          )}

          {/* --- VIEW: HISTORY --- */}
          {activeTab === 'history' && (
             <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                   <table className="w-full text-left border-collapse">
                     <thead className="bg-slate-50/80 border-b border-slate-100">
                       <tr>
                         <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Document Name</th>
                         <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Scanned</th>
                         <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {filteredHistory.length === 0 ? (
                         <tr><td colSpan="3" className="p-12 text-center text-slate-400 italic">No history found. Start scanning!</td></tr>
                       ) : (
                         filteredHistory.map(item => (
                           <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                             <td className="p-5">
                               <div className="flex items-center gap-4">
                                  <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-red-500 shadow-sm group-hover:border-red-200 group-hover:scale-105 transition-all">
                                    <FileText size={20}/>
                                  </div>
                                  <div>
                                    <span className="block font-bold text-slate-700 text-sm">{item.name}</span>
                                    <span className="block text-[10px] text-slate-400 mt-0.5">PDF Document</span>
                                  </div>
                               </div>
                             </td>
                             <td className="p-5 text-sm text-slate-500 font-medium">{item.date}</td>
                             <td className="p-5 text-right">
                               <button 
                                 onClick={() => window.open(item.previewUrl, '_blank')}
                                 className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                               >
                                 View PDF
                               </button>
                             </td>
                           </tr>
                         ))
                       )}
                     </tbody>
                   </table>
                </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default ScannerApp;