import React, { useRef, useState, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { jsPDF } from "jspdf"; 
import { 
  X, RefreshCw, Upload, History, Download, 
  Layers, ScanLine, ChevronRight, Plus, Search
} from 'lucide-react';
import axios from 'axios';

const ScannerApp = () => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null); 

  // --- States ---
  const [activeTab, setActiveTab] = useState('scan');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data: Array of Page Objects
  const [pages, setPages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Search & History
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Logic ---

  const activePage = pages[activePageIndex];

  // Logic to filter history based on search text
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const lowerQuery = searchQuery.toLowerCase();
    return history.filter(item => 
      item.name.toLowerCase().includes(lowerQuery)
    );
  }, [history, searchQuery]);

  // 1. ADD NEW PAGE (Camera)
  const capture = useCallback(() => {
    const image = webcamRef.current.getScreenshot();
    if (image) {
      const newPage = { id: Date.now(), original: image, processed: null, text: "" };
      setPages(prev => [...prev, newPage]);
      setActivePageIndex(pages.length); // Switch to new page
      setIsCameraActive(false);
    }
  }, [webcamRef, pages.length]);

  // 2. ADD NEW PAGE (Upload)
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPages(prev => {
            const newPage = { id: Date.now() + Math.random(), original: e.target.result, processed: null, text: "" };
            return [...prev, newPage];
          });
        };
        reader.readAsDataURL(file);
      });
      // Switch to the first new page (approximate)
      setActivePageIndex(pages.length); 
    }
  };

  const deletePage = (index) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    if (activePageIndex >= newPages.length) {
      setActivePageIndex(Math.max(0, newPages.length - 1));
    }
  };

  // 3. PROCESS SINGLE IMAGE (Helper)
  const processSingleImage = async (imgData, filterType) => {
    const response = await axios.post('https://scanner-backend-jref.onrender.com/process', { 
      image: imgData,
      filter_type: filterType 
    });
    return response.data; // { scanned_image, text }
  };

  // 4. PROCESS CURRENT PAGE
  const handleProcessCurrent = async (filterType = 'scan') => {
    if (!activePage) return;
    setLoading(true);
    
    try {
        const result = await processSingleImage(activePage.original, filterType);
        
        setPages(prev => prev.map((p, i) => 
            i === activePageIndex 
            ? { ...p, processed: result.scanned_image, text: result.text } 
            : p
        ));

    } catch (error) {
      console.error(error);
      alert("Error processing page. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // 5. GENERATE PDF
  const handleSavePDF = () => {
    if (pages.length === 0) return;
    
    const doc = new jsPDF();
    
    pages.forEach((page, index) => {
      const imgData = page.processed || page.original; 
      if (index > 0) doc.addPage(); 

      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    });

    const fileName = `Scan_Batch_${new Date().getTime()}.pdf`;
    const pdfBlob = doc.output('bloburl'); 
    doc.save(fileName); 

    const newEntry = {
      id: Date.now(),
      name: fileName,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      previewUrl: pdfBlob,
      pageCount: pages.length
    };
    
    setHistory(prev => [newEntry, ...prev]);
  };

  const resetAll = () => {
    setPages([]);
    setActivePageIndex(0);
    setIsCameraActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {/* 1. SIDEBAR */}
      <aside className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 z-20">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200"><Layers size={22} /></div>
            <div>
              <span className="block font-bold text-lg tracking-tight text-slate-800">LensScan</span>
              <span className="block text-xs font-medium text-slate-400">Multi-Page Pro</span>
            </div>
          </div>

          {/* ADDED SEARCH BAR BACK */}
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
      </aside>

      {/* 2. MAIN AREA */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Top Header */}
        <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur px-8 flex items-center justify-between shrink-0 z-10">
          <div>
             <h2 className="text-xl font-bold text-slate-800 capitalize">{activeTab} Dashboard</h2>
             <p className="text-sm text-slate-500 mt-0.5">
                {activeTab === 'scan' ? `${pages.length} Pages in current batch` : 'View your past scans'}
             </p>
          </div>
          {activeTab === 'scan' && pages.length > 0 && (
            <button onClick={resetAll} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <RefreshCw size={14} /> Clear All
            </button>
          )}
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-[#F8FAFC]">
          
          {/* --- VIEW: SCANNER --- */}
          {activeTab === 'scan' && (
            <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                  {/* --- LEFT: INPUT --- */}
                  <div className="flex flex-col gap-4">
                     <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-1 flex-1 flex flex-col min-h-[400px]">
                        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-50">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Input Source (Page {activePageIndex + 1})
                            </h3>
                            {isCameraActive && <span className="text-xs font-bold text-red-500 animate-pulse">● LIVE</span>}
                        </div>

                        {/* VISUAL AREA */}
                        <div className="relative flex-1 bg-slate-100 rounded-2xl overflow-hidden m-2 border border-slate-200 group">
                           {isCameraActive ? (
                                <>
                                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" />
                                  <button onClick={capture} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-2xl transition-transform active:scale-95">
                                     <div className="w-14 h-14 rounded-full border-4 border-white bg-red-500 flex items-center justify-center"></div>
                                  </button>
                                  <button onClick={() => setIsCameraActive(false)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"><X size={20} /></button>
                                </>
                           ) : activePage ? (
                                <img src={activePage.original} alt="Page Original" className="w-full h-full object-contain" />
                           ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                   <Upload size={48} className="text-slate-300 mb-4"/>
                                   <p className="font-bold text-slate-600">No pages yet</p>
                                   <p className="text-xs mt-1">Upload or take a photo to start</p>
                                   <div className="flex gap-3 mt-4">
                                      <button onClick={() => fileInputRef.current.click()} className="px-5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50">Upload</button>
                                      <button onClick={() => setIsCameraActive(true)} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">Camera</button>
                                   </div>
                                </div>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* --- RIGHT: OUTPUT --- */}
                  <div className="flex flex-col gap-4">
                     <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-1 flex-1 flex flex-col min-h-[400px]">
                        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-50">
                           <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                             <span className={`w-2 h-2 rounded-full ${activePage?.processed ? 'bg-green-500' : 'bg-slate-300'}`}></span> Result
                           </h3>
                        </div>

                        <div className="flex-1 bg-slate-50/50 p-4 rounded-b-3xl flex items-center justify-center">
                           {loading ? (
                              <div className="text-center">
                                 <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                                 <p className="text-xs font-bold text-slate-500">Processing Page {activePageIndex + 1}...</p>
                              </div>
                           ) : activePage?.processed ? (
                              <img src={activePage.processed} alt="Processed Result" className="max-h-full max-w-full rounded-xl shadow-sm border border-slate-200" />
                           ) : (
                              <div className="text-center text-slate-400">
                                 <p className="text-sm">Scan this page to see results</p>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
              </div>

              {/* --- BOTTOM CONTROL BAR --- */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-6 items-center">
                  
                  {/* Thumbnails */}
                  <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 max-w-full md:max-w-xl no-scrollbar">
                     <button onClick={() => setIsCameraActive(true)} className="w-16 h-20 shrink-0 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                        <Plus size={24} />
                        <span className="text-[10px] font-bold mt-1">Add</span>
                     </button>
                     
                     {pages.map((page, idx) => (
                        <div key={page.id} onClick={() => setActivePageIndex(idx)} className={`relative w-16 h-20 shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${idx === activePageIndex ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                           <img 
                              src={page.processed || page.original} 
                              alt={`Thumbnail ${idx + 1}`} 
                              className="w-full h-full object-cover" 
                           />
                           <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1.5 font-bold">{idx + 1}</div>
                           {idx === activePageIndex && (
                             <button onClick={(e) => { e.stopPropagation(); deletePage(idx); }} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={10}/></button>
                           )}
                        </div>
                     ))}
                  </div>

                  {/* Actions */}
                  {pages.length > 0 && (
                     <div className="flex gap-2 ml-auto">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                           <button onClick={() => handleProcessCurrent('scan')} className="px-3 py-2 text-xs font-bold hover:bg-white hover:shadow-sm rounded-md transition-all">SCAN</button>
                           <button onClick={() => handleProcessCurrent('bw')} className="px-3 py-2 text-xs font-bold hover:bg-white hover:shadow-sm rounded-md transition-all">B&W</button>
                           <button onClick={() => handleProcessCurrent('photo')} className="px-3 py-2 text-xs font-bold hover:bg-white hover:shadow-sm rounded-md transition-all">PHOTO</button>
                        </div>
                        <button onClick={handleSavePDF} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-black shadow-lg flex items-center gap-2">
                           <Download size={16} /> Save PDF ({pages.length})
                        </button>
                     </div>
                  )}
              </div>

            </div>
          )}

          {/* --- VIEW: HISTORY --- */}
          {activeTab === 'history' && (
             <div className="text-center p-10 text-slate-400">
               {filteredHistory.length === 0 ? (
                  <>
                    <History size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>No scans found</p>
                  </>
               ) : (
                  <div className="flex flex-col gap-2 max-w-lg mx-auto">
                    {filteredHistory.map(h => (
                      <div key={h.id} onClick={() => window.open(h.previewUrl)} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-300 shadow-sm transition-all text-left">
                         <div>
                            <span className="block font-bold text-slate-700">{h.name}</span>
                            <span className="text-xs text-slate-400">{h.date}</span>
                         </div>
                         <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">{h.pageCount} Pages</span>
                      </div>
                    ))}
                  </div>
               )}
             </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default ScannerApp;