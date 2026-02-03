import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Webcam from 'react-webcam';
import { jsPDF } from "jspdf"; 
import Cropper from 'react-cropper'; 
// import "cropperjs/dist/cropper.css"; 

import { 
  X, RefreshCw, Upload, History, Download, 
  Layers, ScanLine, ChevronRight, Plus, Search,
  RotateCw, Camera, FilePlus, Copy, Check,
  Maximize2, Scissors, Scaling, Wand2, Crop, Save, Menu
} from 'lucide-react';
import axios from 'axios';

const ScannerApp = () => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null); 
  const appendInputRef = useRef(null); 
  const cropperRef = useRef(null); 

  // --- States ---
  const [activeTab, setActiveTab] = useState('scan');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data
  const [pages, setPages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Tools State
  const [showEditTools, setShowEditTools] = useState(false); 
  const [isCropping, setIsCropping] = useState(false);

  // View Mode
  const [resultView, setResultView] = useState('image'); 
  const [copySuccess, setCopySuccess] = useState(false);

  // Search & History
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Mobile specific
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const activePage = pages[activePageIndex];

  // --- Responsive Check ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Utilities ---
  
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const lowerQuery = searchQuery.toLowerCase();
    return history.filter(item => 
      item.name.toLowerCase().includes(lowerQuery)
    );
  }, [history, searchQuery]);

  // 1. IMAGE MANIPULATION
  const manipulateImage = (operation, value) => {
    if (!activePage) return;
    
    if (operation === 'rotate') {
        const img = new Image();
        img.src = activePage.original;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.height;
            canvas.height = img.width;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((90 * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            
            const newData = canvas.toDataURL("image/jpeg", 0.95);
            setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, original: newData, processed: null } : p));
        };
    } else if (operation === 'resize') {
        const img = new Image();
        img.src = activePage.original;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.width * value;
            canvas.height = img.height * value;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const newData = canvas.toDataURL("image/jpeg", 0.95);
            setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, original: newData, processed: null } : p));
        }
    }
  };

  const handleCropSave = () => {
    if (typeof cropperRef.current?.cropper !== 'undefined') {
      const croppedData = cropperRef.current.cropper.getCroppedCanvas().toDataURL("image/jpeg");
      setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, original: croppedData, processed: null } : p));
      setIsCropping(false);
    }
  };

  // 2. CAPTURE / UPLOAD
  const capture = useCallback(() => {
    const image = webcamRef.current.getScreenshot();
    if (image) {
      const newPage = { id: Date.now(), original: image, processed: null, text: "" };
      setPages(prev => [...prev, newPage]);
      setActivePageIndex(pages.length); 
      setIsCameraActive(false);
    }
  }, [webcamRef, pages.length]);

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
      if (pages.length === 0) setActivePageIndex(0);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (appendInputRef.current) appendInputRef.current.value = "";
  };

  const deletePage = (index) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    if (activePageIndex >= newPages.length) {
      setActivePageIndex(Math.max(0, newPages.length - 1));
    }
  };

  // 3. API CALLS
  const handleAutoBoundary = async () => {
    if (!activePage) return;
    setLoading(true);
    try {
        const response = await axios.post('https://scanner-backend-jref.onrender.com/process', { 
            image: activePage.original,
            filter_type: 'photo' 
        });
        setPages(prev => prev.map((p, i) => 
            i === activePageIndex 
            ? { ...p, original: response.data.scanned_image, processed: null } 
            : p
        ));
    } catch (error) {
        console.error("Auto-boundary failed", error);
        alert("Could not detect document boundaries.");
    } finally {
        setLoading(false);
    }
  };

  const handleProcessCurrent = async (filterType = 'scan') => {
    if (!activePage) return;
    setLoading(true);
    setResultView('image'); 
    try {
        const response = await axios.post('https://scanner-backend-jref.onrender.com/process', { 
            image: activePage.original,
            filter_type: filterType 
        });
        const result = response.data;
        setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, processed: result.scanned_image, text: result.text } : p));
    } catch (error) {
      console.error(error);
      alert("Backend Error: Ensure Python backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // 4. SAVE PDF
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
    const fileName = `Scan_${Date.now()}.pdf`;
    const pdfBlob = doc.output('bloburl'); 
    doc.save(fileName); 
    setHistory(prev => [{
      id: Date.now(), name: fileName, date: new Date().toLocaleTimeString(), previewUrl: pdfBlob, pageCount: pages.length
    }, ...prev]);
  };

  const handleCopyText = () => {
    if (activePage?.text) {
        navigator.clipboard.writeText(activePage.text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const resetAll = () => {
    setPages([]);
    setActivePageIndex(0);
    setIsCameraActive(false);
    setResultView('image');
    setIsCropping(false);
    setShowEditTools(false);
  };

  // Camera Settings for Phone (Back Camera)
  const videoConstraints = {
    facingMode: "environment" // Use back camera on mobile
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
      <input type="file" multiple ref={appendInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {/* --- SIDEBAR (Desktop Only) --- */}
      <aside className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 z-20 shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200"><Layers size={22} /></div>
            <div>
              <span className="block font-bold text-lg tracking-tight text-slate-800">LensScan</span>
              <span className="block text-xs font-medium text-slate-400">Pro Editor</span>
            </div>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-10 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
        </div>
        <nav className="p-4 space-y-1">
          <button onClick={() => setActiveTab('scan')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'scan' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <ScanLine size={18} /> Scanner
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <History size={18} /> History
          </button>
        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-6 flex items-center justify-between shrink-0 z-10">
          <div>
             <h2 className="text-lg font-bold text-slate-800 capitalize">{activeTab}</h2>
             <p className="text-xs text-slate-500">{activeTab === 'scan' ? `${pages.length} Pages ready` : 'Past documents'}</p>
          </div>
          {activeTab === 'scan' && pages.length > 0 && (
            <button onClick={resetAll} className="flex items-center gap-2 text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-red-50">
              <RefreshCw size={14} /> <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </header>

        {/* Workspace (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F8FAFC] pb-40"> 
          
          {activeTab === 'scan' && (
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              
              {/* --- LEFT: INPUT CARD --- */}
              <div className="flex flex-col w-full h-auto min-h-[450px] md:min-h-[600px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative group">
                
                {/* Tools Header */}
                <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-white z-20 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${isCropping ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {isCropping ? 'Crop Mode' : 'Original'}
                        </h3>
                    </div>
                    
                    {activePage && !isCameraActive && !isCropping && (
                        <div className="flex gap-1 ml-4">
                             <button onClick={handleAutoBoundary} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold hover:bg-blue-100 transition-colors mr-2 whitespace-nowrap">
                                <Maximize2 size={12}/> Auto
                            </button>
                            <button onClick={() => setShowEditTools(!showEditTools)} className={`p-1.5 rounded-md transition-colors ${showEditTools ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-500'}`} title="Tools">
                                <Scissors size={16} />
                            </button>
                            <button onClick={() => setIsCropping(true)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors" title="Free Crop">
                                <Crop size={16} />
                            </button>
                            <button onClick={() => manipulateImage('rotate')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors" title="Rotate 90°">
                                <RotateCw size={16} />
                            </button>
                        </div>
                    )}
                    
                    {isCropping && (
                         <div className="flex gap-2 ml-auto">
                             <button onClick={() => setIsCropping(false)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md">Cancel</button>
                             <button onClick={handleCropSave} className="px-3 py-1 text-xs font-bold bg-slate-900 text-white hover:bg-black rounded-md flex items-center gap-1"><Check size={12}/> Done</button>
                         </div>
                    )}
                </div>

                {/* Sub-Tools Bar */}
                {showEditTools && activePage && !isCameraActive && !isCropping && (
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center gap-4 animate-in slide-in-from-top-2 overflow-x-auto">
                        <div className="flex items-center gap-2 border-r border-slate-200 pr-4 shrink-0">
                            <span className="text-[10px] font-bold text-slate-400">Ratio:</span>
                            <button onClick={() => manipulateImage('crop', 210/297)} className="text-[10px] font-bold bg-white border px-2 py-1 rounded hover:bg-blue-50">A4</button>
                            <button onClick={() => manipulateImage('crop', 1)} className="text-[10px] font-bold bg-white border px-2 py-1 rounded hover:bg-blue-50">1:1</button>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold text-slate-400">Scale:</span>
                            <button onClick={() => manipulateImage('resize', 0.8)} className="text-[10px] font-bold bg-white border px-2 py-1 rounded hover:bg-blue-50">80%</button>
                            <button onClick={() => manipulateImage('resize', 0.5)} className="text-[10px] font-bold bg-white border px-2 py-1 rounded hover:bg-blue-50">50%</button>
                        </div>
                    </div>
                )}
                
                {/* VISUAL AREA */}
                <div className="flex-1 bg-slate-100 relative flex items-center justify-center p-2 overflow-hidden min-h-[300px]">
                   {isCameraActive ? (
                        <div className="absolute inset-0 bg-black flex flex-col z-50">
                            {/* Webcam */}
                            <div className="flex-1 relative overflow-hidden">
                                <Webcam 
                                    audio={false} 
                                    ref={webcamRef} 
                                    screenshotFormat="image/jpeg" 
                                    videoConstraints={videoConstraints}
                                    className="w-full h-full object-contain" 
                                />
                            </div>
                            {/* Capture Bar */}
                            <div className="h-24 bg-black/80 flex items-center justify-center gap-8 shrink-0 pb-safe">
                                <button onClick={() => setIsCameraActive(false)} className="bg-slate-800/50 text-white p-3 rounded-full hover:bg-slate-700">
                                    <X size={20} />
                                </button>
                                <button onClick={capture} className="w-16 h-16 rounded-full border-4 border-white bg-red-500 shadow-xl active:scale-95 transition-transform"></button>
                                <div className="w-12"></div>
                            </div>
                        </div>
                   ) : activePage?.original ? (
                        isCropping ? (
                            <Cropper
                                src={activePage.original}
                                style={{ height: '100%', width: '100%' }}
                                initialAspectRatio={NaN} 
                                guides={true}
                                ref={cropperRef}
                                viewMode={1}
                                dragMode="move"
                                background={false}
                                responsive={true}
                            />
                        ) : (
                            <img src={activePage.original} alt="Original" className="w-full h-full object-contain shadow-sm rounded-lg" />
                        )
                   ) : (
                        <div className="text-center p-6">
                           <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                               <Upload size={32} className="text-blue-500"/>
                           </div>
                           <h4 className="font-bold text-slate-700 mb-1">No Document</h4>
                           <p className="text-xs text-slate-400 mb-6">Select a source below</p>
                           <div className="flex gap-3 justify-center">
                              <button onClick={() => fileInputRef.current.click()} className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:shadow-md transition-all">Upload</button>
                              <button onClick={() => setIsCameraActive(true)} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-200 transition-all">Camera</button>
                           </div>
                        </div>
                   )}
                </div>
              </div>

              {/* --- RIGHT: OUTPUT CARD --- */}
              <div className="flex flex-col w-full h-auto min-h-[450px] md:min-h-[600px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
                <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-white z-10">
                   <div className="flex bg-slate-100 p-1 rounded-lg">
                       <button onClick={() => setResultView('image')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${resultView === 'image' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Image</button>
                       <button onClick={() => setResultView('text')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${resultView === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Text</button>
                   </div>
                   {resultView === 'text' && activePage?.text && (
                       <button onClick={handleCopyText} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-all">
                           {copySuccess ? <Check size={14}/> : <Copy size={14}/>} {copySuccess ? "Copied" : "Copy"}
                       </button>
                   )}
                </div>
                <div className="flex-1 bg-slate-50 relative flex items-center justify-center p-4 min-h-[300px]">
                   {loading ? (
                      <div className="text-center">
                         <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                         <p className="text-sm font-bold text-slate-600">Processing...</p>
                         <p className="text-xs text-slate-400 mt-1">Applying filters & OCR</p>
                      </div>
                   ) : activePage ? (
                      resultView === 'image' ? (
                          activePage.processed ? (
                             <img src={activePage.processed} alt="Processed" className="w-full h-full object-contain shadow-sm rounded-lg" />
                          ) : (
                             <div className="text-center opacity-40">
                                <Layers size={48} className="mx-auto mb-2"/>
                                <p className="text-sm font-medium">Ready to process</p>
                             </div>
                          )
                      ) : (
                          <textarea 
                            className="w-full h-full bg-white border border-slate-200 rounded-xl p-6 text-sm font-mono text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none shadow-inner"
                            value={activePage.text || ""}
                            onChange={(e) => {
                                const txt = e.target.value;
                                setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, text: txt } : p));
                            }}
                            placeholder="Extracted text will appear here..."
                          />
                      )
                   ) : (
                      <div className="text-center text-slate-400">
                         <p className="text-sm">Output Preview</p>
                      </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {/* HISTORY VIEW */}
          {activeTab === 'history' && (
             <div className="max-w-4xl mx-auto pb-20">
               {filteredHistory.length === 0 ? (
                  <div className="text-center py-20 opacity-50"><History size={48} className="mx-auto mb-4"/><p>No history yet</p></div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredHistory.map(h => (
                      <div key={h.id} onClick={() => window.open(h.previewUrl)} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group">
                         <div className="flex items-center gap-4">
                            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl"><FilePlus size={20}/></div>
                            <div>
                               <h4 className="font-bold text-slate-700 text-sm group-hover:text-blue-600">{h.name}</h4>
                               <p className="text-xs text-slate-400">{h.date} • {h.pageCount} Pages</p>
                            </div>
                         </div>
                         <Download size={16} className="text-slate-300 group-hover:text-blue-500"/>
                      </div>
                    ))}
                  </div>
               )}
             </div>
          )}
        </div>

        {/* --- FLOATING DOCK (Mobile Optimized) --- */}
        {activeTab === 'scan' && !isCameraActive && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 w-[95%] md:w-[90%] max-w-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-2 z-40 flex items-center gap-2 md:gap-4 transition-all">
                {/* 1. THUMBNAILS CAROUSEL */}
                <div className="flex gap-2 overflow-x-auto max-w-[140px] md:max-w-[350px] no-scrollbar px-2 py-1 border-r border-slate-200 shrink-0">
                    <button onClick={() => setIsCameraActive(true)} className="w-10 h-14 md:w-12 md:h-16 shrink-0 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-600 hover:bg-white transition-all group" title="Add from Camera">
                        <Camera size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button onClick={() => appendInputRef.current.click()} className="w-10 h-14 md:w-12 md:h-16 shrink-0 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-600 hover:bg-white transition-all group" title="Add from Files">
                        <FilePlus size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                    
                    {pages.map((page, idx) => (
                        <div key={page.id} onClick={() => setActivePageIndex(idx)} className={`relative w-10 h-14 md:w-12 md:h-16 shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all border-2 ${idx === activePageIndex ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                            <img src={page.processed || page.original} className="w-full h-full object-cover" />
                            {idx === activePageIndex && <button onClick={(e) => { e.stopPropagation(); deletePage(idx); }} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={8}/></button>}
                        </div>
                    ))}
                </div>

                {/* 2. ACTION BUTTONS */}
                {pages.length > 0 ? (
                    <div className="flex gap-2 items-center flex-1 justify-end overflow-x-auto no-scrollbar pr-1">
                        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                             <button onClick={() => handleProcessCurrent('scan')} className="px-2 md:px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">Scan</button>
                             <button onClick={() => handleProcessCurrent('enhance')} className="px-2 md:px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white hover:shadow-sm rounded-md transition-all text-blue-600 flex items-center gap-1"><Wand2 size={10}/><span className="hidden sm:inline">Enhance</span></button>
                             <button onClick={() => handleProcessCurrent('bw')} className="px-2 md:px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">B&W</button>
                        </div>
                        <button onClick={handleSavePDF} className="bg-slate-900 text-white px-3 md:px-4 py-2 rounded-xl text-xs font-bold hover:bg-black shadow-lg flex items-center gap-2 transition-transform active:scale-95 ml-1 shrink-0">
                            <Download size={14} /> <span className="hidden sm:inline">Save PDF</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 text-center text-xs font-bold text-slate-400">Add pages</div>
                )}
            </div>
        )}

        {/* --- MOBILE BOTTOM NAV (Only visible on mobile) --- */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button onClick={() => setActiveTab('scan')} className={`flex flex-col items-center gap-1 ${activeTab === 'scan' ? 'text-blue-600' : 'text-slate-400'}`}>
                <ScanLine size={20} />
                <span className="text-[10px] font-bold">Scanner</span>
            </button>
            <div className="w-px h-8 bg-slate-100"></div>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}>
                <History size={20} />
                <span className="text-[10px] font-bold">History</span>
            </button>
        </div>

      </main>
    </div>
  );
};

export default ScannerApp;