// Global variables to store application state
let uploadedFiles = []; // Stores an array of file objects with their processed data
let selectedTechnology = null; // Stores the chosen printing technology ('FDM' or 'Resin')
let selectedColor = null; // Stores the selected printing color
let selectedResolution = null; // Stores the selected printing resolution
let orderData = {}; // Stores all compiled order details before submission

// Base URL for the backend API
const API_BASE_URL = 'https://inne-production.up.railway.app';

// Image URLs and descriptions for different technologies
const TECH_IMAGES = {
    FDM: {
        src: 'https://placehold.co/300x200/e0f2f7/000000?text=FDM+Machine',
        description: 'Công nghệ FDM (Fused Deposition Modeling) sử dụng sợi nhựa nhiệt dẻo để tạo ra các lớp vật thể. Phù hợp cho các mô hình lớn, chức năng và chi phí thấp.'
    },
    Resin: {
        src: 'https://placehold.co/300x200/e0f2f7/000000?text=Resin+Machine',
        description: 'Công nghệ Resin (SLA/DLP) sử dụng nhựa lỏng được làm cứng bằng tia UV. Tạo ra các vật thể có độ chi tiết cao, bề mặt mịn, lý tưởng cho mô hình nghệ thuật và trang sức.'
    }
};

// Available colors for each technology
const COLORS = {
    FDM: [
        { name: 'Đen', hex: '#000000' },
        { name: 'Trắng', hex: '#FFFFFF' },
        { name: 'Xám', hex: '#808080' },
        { name: 'Đỏ', hex: '#FF0000' },
        { name: 'Xanh dương', hex: '#0000FF' },
        { name: 'Xanh lá', hex: '#008000' }
    ],
    Resin: [
        { name: 'Trong suốt', hex: '#E0FFFF' },
        { name: 'Trắng', hex: '#FFFFFF' },
        { name: 'Xám', hex: '#808080' },
        { name: 'Đen', hex: '#000000' }
    ]
};

// Available resolutions (layer heights)
const RESOLUTIONS = [
    { value: 100, label: '100 micron (Mịn)' },
    { value: 200, label: '200 micron (Trung bình)' },
    { value: 300, label: '300 micron (Thô)' }
];

// Three.js variables for STL viewer
let scene, camera, renderer, stlLoader;
let stlMesh = null; // To store the current STL mesh

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeFileUpload();
    initializeFormValidation();
    initializeSTLViewer(); // Initialize the 3D viewer
});

// --- File Upload Functions ---

/**
 * Initializes event listeners for the file upload area.
 */
function initializeFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');

    fileInput.addEventListener('change', handleFileSelect);
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleDrop);
}

/**
 * Handles file selection from the input element.
 * @param {Event} event - The change event from the file input.
 */
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    files.forEach(file => addFileToQueue(file));
}

/**
 * Handles the 'dragover' event for the file upload area.
 * Prevents default behavior to allow dropping and adds a visual indicator.
 * @param {Event} event - The dragover event.
 */
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

/**
 * Handles the 'dragleave' event for the file upload area.
 * Removes the visual indicator when the dragged item leaves the area.
 * @param {Event} event - The dragleave event.
 */
function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

/**
 * Handles the 'drop' event for the file upload area.
 * Processes dropped files and adds them to the upload queue.
 * @param {Event} event - The drop event.
 */
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    files.forEach(file => {
        if (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.obj')) {
            addFileToQueue(file);
        } else {
            showError(`File "${file.name}" không phải là định dạng STL hoặc OBJ.`);
        }
    });
}

/**
 * Adds a file to the processing queue and initiates its upload.
 * @param {File} file - The file object to be added.
 */
function addFileToQueue(file) {
    const newFileEntry = {
        id: Date.now() + Math.random(), // Unique ID for the file
        file: file,
        name: file.name,
        mass_grams: null,
        volume_cm3: null,
        processing: true // Flag to indicate processing state
    };
    uploadedFiles.push(newFileEntry);
    updateFileListUI(); // Update UI immediately to show file is added
    document.getElementById('uploadLoading').classList.add('active'); // Show global loading

    uploadFile(newFileEntry); // Upload the individual file
}

/**
 * Uploads a single file to the backend API for processing (mass/volume calculation).
 * Updates the specific file entry in `uploadedFiles` array upon success.
 * @param {Object} fileEntry - The file entry object from `uploadedFiles` array.
 */
function uploadFile(fileEntry) {
    const formData = new FormData();
    formData.append('file', fileEntry.file);

    fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Find the file entry and update its data
        const index = uploadedFiles.findIndex(f => f.id === fileEntry.id);
        if (index !== -1) {
            uploadedFiles[index].mass_grams = data.mass_grams;
            uploadedFiles[index].volume_cm3 = data.volume_cm3;
            uploadedFiles[index].processing = false; // Mark as processed
            
            // Add optimization info if available
            if (data.was_optimized) {
                uploadedFiles[index].was_optimized = true;
                uploadedFiles[index].original_size_mb = data.original_size_mb;
                uploadedFiles[index].optimized_size_mb = data.optimized_size_mb;
                uploadedFiles[index].compression_ratio = data.compression_ratio;
            }
        }
        updateFileListUI(); // Update UI to show results for this file
        calculatePrice(); // Recalculate total price
        checkFormCompletion(); // Re-check form completion

        // Hide global loading if all files are processed
        if (uploadedFiles.every(f => !f.processing)) {
            document.getElementById('uploadLoading').classList.remove('active');
        }

        // Render STL preview for the first uploaded STL file
        if (fileEntry.name.toLowerCase().endsWith('.stl')) {
            renderSTLPreview(fileEntry.file);
        }
    })
    .catch(error => {
        console.error('Upload error for file', fileEntry.name, ':', error);
        const index = uploadedFiles.findIndex(f => f.id === fileEntry.id);
        if (index !== -1) {
            uploadedFiles.splice(index, 1); // Remove file on error
        }
        updateFileListUI();
        calculatePrice();
        showError(`Lỗi khi tải file "${fileEntry.name}" lên. Vui lòng thử lại.`);
        if (uploadedFiles.every(f => !f.processing)) {
            document.getElementById('uploadLoading').classList.remove('active');
        }
    });
}

/**
 * Updates the displayed list of uploaded files and total mass.
 */
function updateFileListUI() {
    const uploadedFilesList = document.getElementById('uploadedFilesList');
    if (!uploadedFilesList) return; // If element doesn't exist, skip
    
    uploadedFilesList.innerHTML = ''; // Clear existing list

    let totalMass = 0;

    if (uploadedFiles.length === 0) {
        const fileListContainer = document.getElementById('fileListContainer');
        if (fileListContainer) fileListContainer.classList.add('hidden');
        
        const summaryFileCount = document.getElementById('summaryFileCount');
        if (summaryFileCount) summaryFileCount.textContent = '0';
        
        const summaryTotalMass = document.getElementById('summaryTotalMass');
        if (summaryTotalMass) summaryTotalMass.textContent = '---';
        
        const totalMassDisplay = document.getElementById('totalMassDisplay');
        if (totalMassDisplay) totalMassDisplay.classList.add('hidden');
        return;
    }

    uploadedFiles.forEach((fileEntry, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200';
        
        let massText = fileEntry.processing ? 'Đang xử lý...' : `${fileEntry.mass_grams.toFixed(2)} grams`;
        if (fileEntry.mass_grams) {
            totalMass += fileEntry.mass_grams;
        }

        let optimizationInfo = '';
        if (fileEntry.was_optimized) {
            optimizationInfo = `
                <div class="mt-2 text-xs text-blue-600">
                    <div>Đã tối ưu: ${fileEntry.original_size_mb}MB → ${fileEntry.optimized_size_mb}MB (${fileEntry.compression_ratio}%)</div>
                </div>
            `;
        }

        listItem.innerHTML = `
            <div class="flex items-center flex-grow">
                <svg class="h-5 w-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <div class="flex-grow">
                    <span class="text-gray-900 font-medium text-sm truncate">${fileEntry.name}</span>
                    <span class="ml-auto text-gray-600 text-xs">${massText}</span>
                    ${optimizationInfo}
                </div>
            </div>
            <button type="button" onclick="removeFile(${index})" class="ml-3 text-red-500 hover:text-red-700">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;
        uploadedFilesList.appendChild(listItem);
    });

    const fileListContainer = document.getElementById('fileListContainer');
    if (fileListContainer) fileListContainer.classList.remove('hidden');
    
    const summaryFileCount = document.getElementById('summaryFileCount');
    if (summaryFileCount) summaryFileCount.textContent = uploadedFiles.length;
    
    const totalMassAmount = document.getElementById('totalMassAmount');
    if (totalMassAmount) totalMassAmount.textContent = `${totalMass.toFixed(2)} grams`;
    
    const summaryTotalMass = document.getElementById('summaryTotalMass');
    if (summaryTotalMass) summaryTotalMass.textContent = `${totalMass.toFixed(2)} grams`;
    
    const totalMassDisplay = document.getElementById('totalMassDisplay');
    if (totalMassDisplay) totalMassDisplay.classList.remove('hidden');
}

/**
 * Removes a file from the uploaded list by its index.
 * @param {number} index - The index of the file to remove.
 */
function removeFile(index) {
    if (index > -1 && index < uploadedFiles.length) {
        uploadedFiles.splice(index, 1); // Remove the file from the array
        updateFileListUI(); // Update the UI list
        calculatePrice(); // Recalculate price
        checkFormCompletion(); // Re-check form completion
        if (uploadedFiles.length === 0) {
            clearSTLViewer(); // Clear viewer if no files left
        }
    }
}

// --- Technology Selection, Color, and Resolution Functions ---

/**
 * Handles the selection of a printing technology.
 * Updates UI to highlight the selected card and triggers price calculation.
 * @param {HTMLElement} element - The clicked HTML element (tech-card).
 * @param {string} technology - The selected technology ('FDM' or 'Resin').
 */
function selectTechnology(element, technology) {
    // Remove 'selected' class and primary border from all technology cards
    document.querySelectorAll('.tech-card').forEach(card => {
        card.classList.remove('selected');
        card.classList.remove('border-primary');
        card.classList.add('border-gray-300');
    });

    // Add 'selected' class and primary border to the clicked card
    element.classList.add('selected');
    element.classList.remove('border-gray-300');
    element.classList.add('border-primary');
    
    selectedTechnology = technology; // Store the selected technology
    
    const summaryTechnology = document.getElementById('summaryTechnology');
    if (summaryTechnology) {
        summaryTechnology.textContent = technology === 'FDM' ? 'FDM (Nhựa)' : 'Resin (Nhựa lỏng)';
    }
    
    // Display the corresponding technology image and description
    const techImageDisplay = document.getElementById('techImageDisplay');
    const techImage = document.getElementById('techImage');
    const techDescription = document.getElementById('techDescription');

    if (TECH_IMAGES[technology] && techImageDisplay && techImage && techDescription) {
        techImage.src = TECH_IMAGES[technology].src;
        techImage.alt = `Máy in 3D ${technology}`;
        techDescription.textContent = TECH_IMAGES[technology].description;
        techImageDisplay.classList.remove('hidden');
        // Trigger reflow to restart animation
        void techImageDisplay.offsetWidth; 
        techImageDisplay.classList.add('active');
    } else if (techImageDisplay) {
        techImageDisplay.classList.remove('active');
        techImageDisplay.classList.add('hidden');
    }

    // Update color and resolution options based on selected technology
    renderColorOptions(technology);
    renderResolutionOptions(); // Resolution options are static for now, but can be dynamic later
    
    // Reset selected color and resolution if technology changes
    selectedColor = null;
    selectedResolution = null;
    
    const summaryColor = document.getElementById('summaryColor');
    if (summaryColor) summaryColor.textContent = 'Chưa chọn';
    
    const summaryResolution = document.getElementById('summaryResolution');
    if (summaryResolution) summaryResolution.textContent = 'Chưa chọn';

    // If file data is available, calculate the price immediately
    if (uploadedFiles.length > 0) {
        calculatePrice();
    }
    
    checkFormCompletion(); // Re-check form completion
}

/**
 * Renders color options based on the selected technology.
 * @param {string} technology - The selected technology ('FDM' or 'Resin').
 */
function renderColorOptions(technology) {
    const colorOptionsContainer = document.getElementById('colorOptions');
    if (!colorOptionsContainer) return;
    
    colorOptionsContainer.innerHTML = ''; // Clear existing options

    const availableColors = COLORS[technology] || [];
    if (availableColors.length > 0) {
        const colorSelectionSection = document.getElementById('colorSelectionSection');
        if (colorSelectionSection) colorSelectionSection.classList.remove('hidden');
        
        availableColors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'flex items-center p-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors';
            colorDiv.onclick = () => selectColor(color.name);
            
            colorDiv.innerHTML = `
                <div class="w-5 h-5 rounded-full mr-2 border border-gray-300" style="background-color: ${color.hex};"></div>
                <span class="text-sm font-medium text-gray-800">${color.name}</span>
            `;
            colorOptionsContainer.appendChild(colorDiv);
        });
    } else {
        const colorSelectionSection = document.getElementById('colorSelectionSection');
        if (colorSelectionSection) colorSelectionSection.classList.add('hidden');
    }
}

/**
 * Handles the selection of a printing color.
 * @param {string} colorName - The name of the selected color.
 */
function selectColor(colorName) {
    selectedColor = colorName;
    
    const summaryColor = document.getElementById('summaryColor');
    if (summaryColor) summaryColor.textContent = colorName;

    // Highlight selected color
    document.querySelectorAll('#colorOptions > div').forEach(div => {
        div.classList.remove('border-primary', 'bg-blue-50');
        div.classList.add('border-gray-300');
    });
    event.currentTarget.classList.remove('border-gray-300');
    event.currentTarget.classList.add('border-primary', 'bg-blue-50');

    calculatePrice();
    checkFormCompletion();
}

/**
 * Renders resolution options.
 */
function renderResolutionOptions() {
    const resolutionOptionsContainer = document.getElementById('resolutionOptions');
    if (!resolutionOptionsContainer) return;
    
    resolutionOptionsContainer.innerHTML = ''; // Clear existing options

    const resolutionSelectionSection = document.getElementById('resolutionSelectionSection');
    if (resolutionSelectionSection) resolutionSelectionSection.classList.remove('hidden');
    
    RESOLUTIONS.forEach(resolution => {
        const resolutionDiv = document.createElement('div');
        resolutionDiv.className = 'flex items-center p-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors';
        resolutionDiv.onclick = () => selectResolution(resolution.value);

        resolutionDiv.innerHTML = `
            <span class="text-sm font-medium text-gray-800">${resolution.label}</span>
        `;
        resolutionOptionsContainer.appendChild(resolutionDiv);
    });
}

/**
 * Handles the selection of a printing resolution.
 * @param {number} resolutionValue - The value of the selected resolution (e.g., 100, 200, 300).
 */
function selectResolution(resolutionValue) {
    selectedResolution = resolutionValue;
    
    const summaryResolution = document.getElementById('summaryResolution');
    if (summaryResolution) summaryResolution.textContent = `${resolutionValue} micron`;

    // Highlight selected resolution
    document.querySelectorAll('#resolutionOptions > div').forEach(div => {
        div.classList.remove('border-primary', 'bg-blue-50');
        div.classList.add('border-gray-300');
    });
    event.currentTarget.classList.remove('border-gray-300');
    event.currentTarget.classList.add('border-primary', 'bg-blue-50');

    calculatePrice();
    checkFormCompletion();
}

/**
 * Calculates the estimated price based on total mass and selected technology.
 */
function calculatePrice() {
    const totalMass = uploadedFiles.reduce((sum, file) => sum + (file.mass_grams || 0), 0);

    if (totalMass === 0 || !selectedTechnology) {
        const priceDisplay = document.getElementById('priceDisplay');
        if (priceDisplay) priceDisplay.classList.add('hidden');
        return;
    }
    
    const requestData = {
        mass_grams: totalMass,
        tech: selectedTechnology,
        material: selectedTechnology === 'FDM' ? 'PLA' : 'Resin' // Determine material based on technology
    };
    
    fetch(`${API_BASE_URL}/price`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        displayPrice(data.price);
    })
    .catch(error => {
        console.error('Price calculation error:', error);
        showError('Lỗi khi tính giá. Vui lòng thử lại.');
        const priceDisplay = document.getElementById('priceDisplay');
        if (priceDisplay) priceDisplay.classList.add('hidden');
    });
}

function displayPrice(price) {
    document.getElementById('priceAmount').textContent = `${price.toLocaleString('vi-VN')} VNĐ`;
    document.getElementById('priceDisplay').classList.remove('hidden');
}

// Form Validation and Submission
function initializeFormValidation() {
    const inputs = ['customerName', 'customerPhone', 'customerAddress'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        input.addEventListener('input', checkFormCompletion);
        input.addEventListener('blur', validateField);
    });
}

function validateField(event) {
    const field = event.target;
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        field.classList.add('border-red-500');
        return false;
    } else {
        field.classList.remove('border-red-500');
        return true;
    }
}

/**
 * Checks if all required form fields are filled and enables/disables the submit button accordingly.
 */
function checkFormCompletion() {
    const hasFiles = uploadedFiles.length > 0 && uploadedFiles.every(f => !f.processing && f.mass_grams !== null);
    const hasTechnology = selectedTechnology !== null;
    const hasColor = selectedColor !== null;
    const hasResolution = selectedResolution !== null;
    const hasName = document.getElementById('customerName').value.trim() !== '';
    const hasPhone = document.getElementById('customerPhone').value.trim() !== '';
    const hasAddress = document.getElementById('customerAddress').value.trim() !== '';
    
    const isComplete = hasFiles && hasTechnology && hasColor && hasResolution && hasName && hasPhone && hasAddress;
    
    const submitBtn = document.getElementById('submitBtn');
    if (isComplete) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
        submitBtn.classList.add('bg-accent', 'hover:bg-accent-dark', 'cursor-pointer');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.remove('bg-accent', 'hover:bg-accent-dark', 'cursor-pointer');
        submitBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
    }
}

/**
 * Submits the order to the backend API after validating the form.
 */
function submitOrder() {
    if (!validateForm()) {
        return;
    }

    const totalMass = uploadedFiles.reduce((sum, f) => sum + (f.mass_grams || 0), 0);
    const totalVolume = uploadedFiles.reduce((sum, f) => sum + (f.volume_cm3 || 0), 0);
    const filenameList = uploadedFiles.map(f => f.name).join(', ');

    orderData = {
        name: document.getElementById('customerName').value.trim(),
        phone: document.getElementById('customerPhone').value.trim(),
        address: document.getElementById('customerAddress').value.trim(),
        email: "", // If you have an email input field, get its value here
        quote: {
            filename: filenameList,
            mass_grams: totalMass,
            volume_cm3: totalVolume,
            technology: selectedTechnology,
            material: selectedTechnology === 'FDM' ? 'PLA' : 'Resin',
            color: selectedColor,
            resolution: selectedResolution,
            price: parseInt(document.getElementById('priceAmount').textContent.replace(/\D/g, '')) || 0,
            order_date: new Date().toISOString()
        }
    };

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Đang xử lý...';
    submitBtn.disabled = true;

    const mainForm = document.getElementById('mainForm');
    const orderProgressDisplay = document.getElementById('orderProgressDisplay');
    
    if (mainForm) mainForm.classList.add('hidden');
    if (orderProgressDisplay) orderProgressDisplay.classList.remove('hidden');

    showOrderProgress('Đang gửi đơn hàng của bạn...');
    setTimeout(() => showOrderProgress('Đã nhận đơn hàng, đang xác nhận thông tin...'), 2000);
    setTimeout(() => showOrderProgress('Đang gửi email xác nhận đến bạn...'), 4000);
    setTimeout(() => showOrderProgress('Đang chuẩn bị sản xuất sản phẩm của bạn...'), 6000);

    fetch(`${API_BASE_URL}/order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        setTimeout(() => {
            showOrderProgress('Đơn hàng đã được xử lý thành công! Chúng tôi sẽ liên hệ sớm nhất.');
            const successMessage = document.getElementById('successMessage');
            if (successMessage) successMessage.classList.add('active');
            if (orderProgressDisplay) orderProgressDisplay.classList.add('hidden');
        }, 8000);
    })
    .catch(error => {
        console.error('Order submission error:', error);
        setTimeout(() => {
            showError('Lỗi khi đặt hàng. Vui lòng thử lại.');
            if (orderProgressDisplay) orderProgressDisplay.classList.add('hidden');
            if (mainForm) mainForm.classList.remove('hidden');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 8000);
    });
}

/**
 * Updates the order progress display with new status messages.
 * @param {string} message - The status message to display.
 */
function showOrderProgress(message) {
    const progressSteps = document.getElementById('progressSteps');
    if (!progressSteps) return;
    
    const stepDiv = document.createElement('div');
    stepDiv.className = 'flex items-center text-gray-700 animate-fade-in-up';
    stepDiv.innerHTML = `
        <svg class="h-5 w-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>${message}</span>
    `;
    progressSteps.appendChild(stepDiv);
    // Scroll to bottom to show latest message
    progressSteps.scrollTop = progressSteps.scrollHeight;
}

/**
 * Performs a comprehensive validation of all form fields.
 * @returns {boolean} - True if all fields are valid, false otherwise.
 */
function validateForm() {
    const fields = [
        { id: 'customerName', name: 'Họ và tên' },
        { id: 'customerPhone', name: 'Số điện thoại' },
        { id: 'customerAddress', name: 'Địa chỉ' }
    ];
    
    let isValid = true;
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!validateField({ target: element })) {
            isValid = false;
        }
    });
    
    if (uploadedFiles.length === 0 || !uploadedFiles.every(f => !f.processing && f.mass_grams !== null)) {
        showError('Vui lòng tải lên ít nhất một file 3D và đợi xử lý xong.');
        isValid = false;
    }
    
    if (!selectedTechnology) {
        showError('Vui lòng chọn công nghệ in');
        isValid = false;
    }

    if (!selectedColor) {
        showError('Vui lòng chọn màu in');
        isValid = false;
    }

    if (!selectedResolution) {
        showError('Vui lòng chọn độ phân giải');
        isValid = false;
    }
    
    return isValid;
}

// UI Functions
function showSuccess() {
    document.getElementById('successMessage').classList.add('active');
    document.getElementById('mainForm').classList.add('hidden');
}

function showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Resets the entire form to its initial state.
 */
function resetForm() {
    // Reset all global state variables
    uploadedFiles = [];
    selectedTechnology = null;
    selectedColor = null;
    selectedResolution = null;
    orderData = {};
    
    // Hide success message and show main form
    const successMessage = document.getElementById('successMessage');
    if (successMessage) successMessage.classList.remove('active');
    
    const orderProgressDisplay = document.getElementById('orderProgressDisplay');
    if (orderProgressDisplay) orderProgressDisplay.classList.add('hidden');
    
    const mainForm = document.getElementById('mainForm');
    if (mainForm) mainForm.classList.remove('hidden');
    
    // Clear progress steps
    const progressSteps = document.getElementById('progressSteps');
    if (progressSteps) progressSteps.innerHTML = '';

    // Reset file upload section
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = ''; // Clear file input value
    updateFileListUI(); // Clear file list UI
    document.getElementById('uploadLoading').classList.remove('active');
    clearSTLViewer(); // Clear the 3D viewer

    // Reset technology selection UI
    document.querySelectorAll('.tech-card').forEach(card => {
        card.classList.remove('selected');
        card.classList.remove('border-primary');
        card.classList.add('border-gray-300');
    });
    
    const techImageDisplay = document.getElementById('techImageDisplay');
    if (techImageDisplay) {
        techImageDisplay.classList.remove('active');
        techImageDisplay.classList.add('hidden');
    }
    
    const techImage = document.getElementById('techImage');
    if (techImage) techImage.src = '';
    
    const techDescription = document.getElementById('techDescription');
    if (techDescription) techDescription.textContent = '';

    const priceDisplay = document.getElementById('priceDisplay');
    if (priceDisplay) priceDisplay.classList.add('hidden');
    
    const summaryTechnology = document.getElementById('summaryTechnology');
    if (summaryTechnology) summaryTechnology.textContent = 'Chưa chọn';
    
    const summaryColor = document.getElementById('summaryColor');
    if (summaryColor) summaryColor.textContent = 'Chưa chọn';
    
    const summaryResolution = document.getElementById('summaryResolution');
    if (summaryResolution) summaryResolution.textContent = 'Chưa chọn';
    
    const summaryTotalMass = document.getElementById('summaryTotalMass');
    if (summaryTotalMass) summaryTotalMass.textContent = '---';
    
    // Reset color and resolution sections
    const colorSelectionSection = document.getElementById('colorSelectionSection');
    if (colorSelectionSection) colorSelectionSection.classList.add('hidden');
    
    const resolutionSelectionSection = document.getElementById('resolutionSelectionSection');
    if (resolutionSelectionSection) resolutionSelectionSection.classList.add('hidden');
    
    const colorOptions = document.getElementById('colorOptions');
    if (colorOptions) colorOptions.innerHTML = '';
    
    const resolutionOptions = document.getElementById('resolutionOptions');
    if (resolutionOptions) resolutionOptions.innerHTML = '';

    // Clear customer information form fields
    const customerName = document.getElementById('customerName');
    if (customerName) customerName.value = '';
    
    const customerPhone = document.getElementById('customerPhone');
    if (customerPhone) customerPhone.value = '';
    
    const customerAddress = document.getElementById('customerAddress');
    if (customerAddress) customerAddress.value = '';
    
    // Remove any validation error borders
    document.querySelectorAll('.form-input-group').forEach(group => {
        group.classList.remove('border-red-500');
    });
    
    // Re-check form completion to set the submit button to its initial disabled state
    checkFormCompletion();
}

// --- Three.js STL Viewer Functions ---

/**
 * Initializes the Three.js scene, camera, and renderer for the STL viewer.
 */
function initializeSTLViewer() {
    const canvas = document.getElementById('stlViewer');
    if (!canvas) return; // If element doesn't exist, skip
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Light grey background

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 50); // Initial camera position

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    stlLoader = new THREE.STLLoader();

    // Handle mouse interaction for basic rotation (manual orbit-like behavior)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        // Apply rotation based on mouse movement
        if (stlMesh) {
            stlMesh.rotation.y += deltaX * 0.01;
            stlMesh.rotation.x += deltaY * 0.01;
        }

        previousMousePosition = { x: e.clientX, y: e.clientY };
        animateSTLViewer();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        const viewerCanvas = document.getElementById('stlViewer');
        if (viewerCanvas && camera && renderer) {
            camera.aspect = viewerCanvas.clientWidth / viewerCanvas.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(viewerCanvas.clientWidth, viewerCanvas.clientHeight);
            animateSTLViewer();
        }
    });

    animateSTLViewer(); // Start the animation loop
}

/**
 * Renders an STL file in the Three.js viewer.
 * @param {File} stlFile - The STL file object to render.
 */
function renderSTLPreview(stlFile) {
    if (!stlLoader) return; // If Three.js is not loaded, skip
    
    const reader = new FileReader();
    reader.onload = function (event) {
        const geometry = stlLoader.parse(event.target.result);
        geometry.computeBoundingBox();
        const material = new THREE.MeshLambertMaterial({ color: 0xAAAAAA, specular: 0x111111, shininess: 200 });

        // Remove previous mesh if exists
        if (stlMesh) {
            scene.remove(stlMesh);
            stlMesh.geometry.dispose();
            stlMesh.material.dispose();
        }

        stlMesh = new THREE.Mesh(geometry, material);
        scene.add(stlMesh);

        // Center and scale the model
        const boundingBox = geometry.boundingBox;
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        stlMesh.position.sub(center); // Center the mesh

        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 30 / maxDim; // Scale to fit within a certain view size
        stlMesh.scale.set(scale, scale, scale);

        // Adjust camera to fit the model
        camera.position.z = maxDim * 1.5;
        camera.position.y = maxDim * 0.5;
        camera.lookAt(scene.position);

        const stlViewer = document.getElementById('stlViewer');
        if (stlViewer) {
            stlViewer.classList.remove('hidden');
            stlViewer.classList.add('active');
        }
        animateSTLViewer();
    };
    reader.readAsArrayBuffer(stlFile);
}

/**
 * Clears the STL viewer.
 */
function clearSTLViewer() {
    if (stlMesh) {
        scene.remove(stlMesh);
        stlMesh.geometry.dispose();
        stlMesh.material.dispose();
        stlMesh = null;
    }
    const stlViewer = document.getElementById('stlViewer');
    if (stlViewer) {
        stlViewer.classList.remove('active');
        stlViewer.classList.add('hidden');
    }
    animateSTLViewer();
}

/**
 * Animation loop for the Three.js viewer.
 */
function animateSTLViewer() {
    if (!renderer || !scene || !camera) return;
    
    requestAnimationFrame(animateSTLViewer);
    renderer.render(scene, camera);
}

// --- UI Utility Functions ---

/**
 * Displays the success message and hides the main form.
 */
function showSuccess() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) successMessage.classList.add('active');
    
    const mainForm = document.getElementById('mainForm');
    if (mainForm) mainForm.classList.add('hidden');
}

/**
 * Displays a temporary error notification.
 * @param {string} message - The error message to display.
 */
function showError(message) {
    const existingError = document.querySelector('.error-notification');
    if (existingError) existingError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.classList.add('animate-fade-out-up');
            errorDiv.addEventListener('animationend', () => errorDiv.remove());
        }
    }, 4000);
}

// --- Utility Functions ---

/**
 * Formats a number as Vietnamese currency.
 * @param {number} amount - The amount to format.
 * @returns {string} - The formatted currency string.
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

/**
 * Formats file size in bytes to human readable format.
 * @param {number} bytes - The size in bytes.
 * @returns {string} - The formatted size string.
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 
