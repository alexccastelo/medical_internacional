document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const categoryNav = document.getElementById('categoryNav');
    const documentsGrid = document.getElementById('documentsGrid');
    const currentCategoryTitle = document.getElementById('currentCategoryTitle');
    const searchInput = document.getElementById('searchInput');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // PDF Modal Elements
    const pdfModal = document.getElementById('pdfModal');
    const pdfModalTitle = document.getElementById('pdfModalTitle');
    const pdfClose = document.getElementById('pdfClose');
    const pdfCanvas = document.getElementById('pdfCanvas');
    const pdfLoading = document.getElementById('pdfLoading');
    const pdfViewerContainer = document.getElementById('pdfViewerContainer');
    
    // PDF Controls
    const pdfZoomIn = document.getElementById('pdfZoomIn');
    const pdfZoomOut = document.getElementById('pdfZoomOut');
    const pdfZoomLevel = document.getElementById('pdfZoomLevel');
    const pdfPrevPage = document.getElementById('pdfPrevPage');
    const pdfNextPage = document.getElementById('pdfNextPage');
    const pdfCurrentPage = document.getElementById('pdfCurrentPage');
    const pdfTotalPages = document.getElementById('pdfTotalPages');
    const pdfShare = document.getElementById('pdfShare');
    const pdfDownload = document.getElementById('pdfDownload');

    // State
    let allPdfs = [];
    let currentCategory = 'Todos';
    let categories = new Set();
    
    // PDF State
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.0; // initial scale based on container width later
    let currentPdfUrl = '';
    let currentPdfName = '';

    // Icons mapping for categories
    const categoryIcons = {
        'Cartões de embarque': 'flight_takeoff',
        'Documentos': 'badge',
        'Receitas e docs médicos': 'medical_information',
        'Outros': 'folder'
    };

    // Initialization
    async function init() {
        try {
            const response = await fetch('pdfs.json');
            if (!response.ok) throw new Error('Falha ao carregar pdfs.json');
            
            const data = await response.json();
            allPdfs = data.files;
            
            // Extract categories
            allPdfs.forEach(pdf => categories.add(pdf.category));
            
            renderCategories();
            renderDocuments();
        } catch (error) {
            documentsGrid.innerHTML = `
                <div class="loading-state" style="color: #ef4444;">
                    <span class="material-icons-round" style="font-size: 48px; margin-bottom: 16px;">error_outline</span>
                    <p>Erro ao carregar documentos.</p>
                    <p style="font-size: 0.85rem; margin-top: 8px;">Certifique-se de ter rodado 'npm run build' (node generate-index.js).</p>
                </div>
            `;
            console.error(error);
        }
    }

    // Render Categories in Sidebar
    function renderCategories() {
        categoryNav.innerHTML = '';
        
        // "All" category
        const allItem = document.createElement('div');
        allItem.className = `nav-item ${currentCategory === 'Todos' ? 'active' : ''}`;
        allItem.innerHTML = `<span class="material-icons-round">grid_view</span> Todos`;
        allItem.onclick = () => setCategory('Todos');
        categoryNav.appendChild(allItem);

        // Sorted specific categories
        Array.from(categories).sort().forEach(cat => {
            const icon = categoryIcons[cat] || categoryIcons['Outros'];
            const item = document.createElement('div');
            item.className = `nav-item ${currentCategory === cat ? 'active' : ''}`;
            item.innerHTML = `<span class="material-icons-round">${icon}</span> ${cat}`;
            item.onclick = () => setCategory(cat);
            categoryNav.appendChild(item);
        });
    }

    // Set current category and re-render
    function setCategory(cat) {
        currentCategory = cat;
        currentCategoryTitle.textContent = cat === 'Todos' ? 'Todos os Documentos' : cat;
        renderCategories(); // update active state
        renderDocuments();
        
        // Close sidebar on mobile after selection
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }
    }

    // Format file size
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // Render Document Cards
    function renderDocuments() {
        const query = searchInput.value.toLowerCase();
        
        const filtered = allPdfs.filter(pdf => {
            const matchesCat = currentCategory === 'Todos' || pdf.category === currentCategory;
            const matchesSearch = pdf.name.toLowerCase().includes(query) || pdf.path.toLowerCase().includes(query);
            return matchesCat && matchesSearch;
        });

        documentsGrid.innerHTML = '';

        if (filtered.length === 0) {
            documentsGrid.innerHTML = `
                <div class="loading-state">
                    <span class="material-icons-round" style="font-size: 48px; margin-bottom: 16px; color: var(--text-muted);">search_off</span>
                    <p>Nenhum documento encontrado.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(pdf => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            
            // Icon based on name
            let iconStr = 'picture_as_pdf';
            if(pdf.name.toLowerCase().includes('receita') || pdf.name.toLowerCase().includes('medicamento')) iconStr = 'medication';
            if(pdf.name.toLowerCase().includes('passaporte') || pdf.name.toLowerCase().includes('rg') || pdf.name.toLowerCase().includes('cnh')) iconStr = 'badge';
            if(pdf.name.toLowerCase().includes('embarque')) iconStr = 'flight_ticket';

            const dateStr = new Date(pdf.lastModified).toLocaleDateString('pt-BR');

            card.innerHTML = `
                <div class="doc-icon"><span class="material-icons-round">${iconStr}</span></div>
                <h3 class="doc-title" title="${pdf.name}">${pdf.name.replace('.pdf', '')}</h3>
                <div class="doc-meta">
                    <span>${formatBytes(pdf.size)}</span>
                    <span>${dateStr}</span>
                </div>
            `;

            card.onclick = () => openPdfViewer(pdf);
            documentsGrid.appendChild(card);
        });
    }

    // Event Listeners
    searchInput.addEventListener('input', renderDocuments);
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // --- PDF Viewer Logic ---

    // Render the page
    function renderPage(num) {
        pageRendering = true;
        
        pdfDoc.getPage(num).then(function(page) {
            const ctx = pdfCanvas.getContext('2d');
            
            // Adjust scale for mobile to fit width initially
            let viewport = page.getViewport({scale: scale});
            
            // If scale is 1.0 (default), let's calculate a better fit
            if (scale === 1.0) {
                const containerWidth = pdfViewerContainer.clientWidth - 40;
                const pageScale = containerWidth / viewport.width;
                // Don't scale up too much, but allow scaling down to fit
                scale = Math.min(1.5, pageScale);
                viewport = page.getViewport({scale: scale});
                updateZoomText();
            }

            // Output resolution adjustment for crisp rendering
            const outputScale = window.devicePixelRatio || 1;

            pdfCanvas.width = Math.floor(viewport.width * outputScale);
            pdfCanvas.height = Math.floor(viewport.height * outputScale);
            pdfCanvas.style.width = Math.floor(viewport.width) + "px";
            pdfCanvas.style.height = Math.floor(viewport.height) + "px";

            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            const renderContext = {
                canvasContext: ctx,
                transform: transform,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);

            renderTask.promise.then(function() {
                pageRendering = false;
                pdfLoading.style.display = 'none';
                
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });
        });

        pdfCurrentPage.textContent = num;
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function onPrevPage() {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    }

    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    }
    
    function onZoomIn() {
        scale += 0.2;
        updateZoomText();
        queueRenderPage(pageNum);
    }
    
    function onZoomOut() {
        if (scale <= 0.4) return;
        scale -= 0.2;
        updateZoomText();
        queueRenderPage(pageNum);
    }
    
    function updateZoomText() {
        pdfZoomLevel.textContent = Math.round(scale * 100) + '%';
    }

    pdfPrevPage.addEventListener('click', onPrevPage);
    pdfNextPage.addEventListener('click', onNextPage);
    pdfZoomIn.addEventListener('click', onZoomIn);
    pdfZoomOut.addEventListener('click', onZoomOut);

    function openPdfViewer(pdfInfo) {
        currentPdfUrl = pdfInfo.path;
        currentPdfName = pdfInfo.name;
        
        pdfModalTitle.textContent = pdfInfo.name;
        pdfModal.classList.add('active');
        pdfLoading.style.display = 'block';
        pdfCanvas.style.width = '0px'; // hide until rendered
        
        // Reset state
        scale = 1.0; 
        pageNum = 1;
        updateZoomText();

        // Load PDF
        pdfjsLib.getDocument(currentPdfUrl).promise.then(function(pdfDoc_) {
            pdfDoc = pdfDoc_;
            pdfTotalPages.textContent = pdfDoc.numPages;
            renderPage(pageNum);
        }).catch(err => {
            console.error('Error loading PDF:', err);
            pdfLoading.style.display = 'none';
            alert('Não foi possível carregar o PDF. Ele pode estar corrompido ou o caminho está incorreto.');
        });
    }

    function closePdfViewer() {
        pdfModal.classList.remove('active');
        setTimeout(() => {
            const ctx = pdfCanvas.getContext('2d');
            ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
            pdfDoc = null;
        }, 300);
    }

    pdfClose.addEventListener('click', closePdfViewer);
    
    // Close on backdrop click
    document.getElementById('pdfModalBackdrop').addEventListener('click', closePdfViewer);

    // Download action
    pdfDownload.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = currentPdfUrl;
        link.download = currentPdfName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Share action using Web Share API
    pdfShare.addEventListener('click', async () => {
        if (navigator.share) {
            try {
                // To share a file, we need to fetch it as a blob first
                pdfLoading.style.display = 'block';
                const response = await fetch(currentPdfUrl);
                const blob = await response.blob();
                const file = new File([blob], currentPdfName, { type: 'application/pdf' });
                
                pdfLoading.style.display = 'none';

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: currentPdfName,
                        text: 'Confira este documento médico.',
                        files: [file]
                    });
                } else {
                    // Fallback to sharing URL if file sharing is not supported
                    await navigator.share({
                        title: currentPdfName,
                        text: 'Confira este documento médico.',
                        url: window.location.href + currentPdfUrl // pseudo URL
                    });
                }
            } catch (err) {
                console.error('Error sharing:', err);
                pdfLoading.style.display = 'none';
                if(err.name !== 'AbortError') {
                    alert('Erro ao compartilhar o arquivo.');
                }
            }
        } else {
            alert('A funcionalidade de compartilhamento nativo não é suportada neste navegador. Use o botão de download.');
        }
    });

    // Start App
    init();
});
