// Global variables
let selectedFile = null;
let fileData = null;
let selectedTechnology = null;
let orderData = {};

// API Base URL
const API_BASE_URL = 'https://inne-production.up.railway.app';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeFileUpload();
    initializeFormValidation();
});

// File Upload Functions
function initializeFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');

    // File input change event
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleDrop);

    // Click to upload
    fileUploadArea.addEventListener('click', () => fileInput.click());
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.obj')) {
            processFile(file);
        } else {
            showError('Vui lòng chọn file STL hoặc OBJ');
        }
    }
}

function processFile(file) {
    selectedFile = file;
    
    // Show file info
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileInfo').classList.remove('hidden');
    
    // Show loading
    document.getElementById('uploadLoading').classList.add('active');
    document.getElementById('fileResults').classList.add('hidden');
    
    // Upload file to server
    uploadFile(file);
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

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
        fileData = data;
        displayFileResults(data);
        document.getElementById('uploadLoading').classList.remove('active');
        checkFormCompletion();
    })
    .catch(error => {
        console.error('Upload error:', error);
        document.getElementById('uploadLoading').classList.remove('active');
        showError('Lỗi khi tải file lên. Vui lòng thử lại.');
    });
}

function displayFileResults(data) {
    document.getElementById('fileMass').textContent = `${data.mass_grams} grams`;
    document.getElementById('fileVolume').textContent = `${data.volume_cm3} cm³`;
    document.getElementById('fileResults').classList.remove('hidden');
}

function removeFile() {
    selectedFile = null;
    fileData = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').classList.add('hidden');
    document.getElementById('fileResults').classList.add('hidden');
    document.getElementById('uploadLoading').classList.remove('active');
    checkFormCompletion();
}

// Technology Selection Functions
function selectTechnology(technology) {
    selectedTechnology = technology;
    
    // Update UI
    document.querySelectorAll('input[name="technology"]').forEach(radio => {
        radio.checked = radio.value === technology;
    });
    
    // Update visual selection
    document.querySelectorAll('.border').forEach(div => {
        div.classList.remove('border-primary', 'bg-blue-50');
        div.classList.add('border-gray-300');
    });
    
    event.currentTarget.classList.remove('border-gray-300');
    event.currentTarget.classList.add('border-primary', 'bg-blue-50');
    
    // Show radio button
    const radio = event.currentTarget.querySelector('input[type="radio"]');
    const radioCircle = event.currentTarget.querySelector('.w-2.h-2');
    radio.checked = true;
    radioCircle.classList.remove('hidden');
    
    // Calculate price if file data is available
    if (fileData) {
        calculatePrice();
    }
    
    checkFormCompletion();
}

function calculatePrice() {
    if (!fileData || !selectedTechnology) return;
    
    const requestData = {
        mass_grams: fileData.mass_grams,
        tech: selectedTechnology,
        material: selectedTechnology === 'FDM' ? 'PLA' : 'Resin'
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

function checkFormCompletion() {
    const hasFile = selectedFile !== null;
    const hasTechnology = selectedTechnology !== null;
    const hasName = document.getElementById('customerName').value.trim() !== '';
    const hasPhone = document.getElementById('customerPhone').value.trim() !== '';
    const hasAddress = document.getElementById('customerAddress').value.trim() !== '';
    
    const isComplete = hasFile && hasTechnology && hasName && hasPhone && hasAddress;
    
    const submitBtn = document.getElementById('submitBtn');
    if (isComplete) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        submitBtn.classList.add('bg-primary', 'hover:bg-blue-700', 'cursor-pointer');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.remove('bg-primary', 'hover:bg-blue-700', 'cursor-pointer');
        submitBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
    }
}

function submitOrder() {
    if (!validateForm()) {
        return;
    }
    
    // Prepare order data
    orderData = {
        // File information
        filename: selectedFile.name,
        mass_grams: fileData.mass_grams,
        volume_cm3: fileData.volume_cm3,
        
        // Technology and pricing
        technology: selectedTechnology,
        material: selectedTechnology === 'FDM' ? 'PLA' : 'Resin',
        
        // Customer information
        customer_name: document.getElementById('customerName').value.trim(),
        customer_phone: document.getElementById('customerPhone').value.trim(),
        customer_address: document.getElementById('customerAddress').value.trim(),
        
        // Timestamp
        order_date: new Date().toISOString()
    };
    
    // Show loading state
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Đang xử lý...';
    submitBtn.disabled = true;
    
    // Send order to server
    fetch(`${API_BASE_URL}/order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        showSuccess();
    })
    .catch(error => {
        console.error('Order submission error:', error);
        showError('Lỗi khi đặt hàng. Vui lòng thử lại.');
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
}

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
    
    if (!selectedFile) {
        showError('Vui lòng chọn file 3D');
        isValid = false;
    }
    
    if (!selectedTechnology) {
        showError('Vui lòng chọn công nghệ in');
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

function resetForm() {
    // Reset all form data
    selectedFile = null;
    fileData = null;
    selectedTechnology = null;
    orderData = {};
    
    // Reset UI
    document.getElementById('successMessage').classList.remove('active');
    document.getElementById('mainForm').classList.remove('hidden');
    
    // Reset file upload
    removeFile();
    
    // Reset technology selection
    document.querySelectorAll('input[name="technology"]').forEach(radio => {
        radio.checked = false;
    });
    document.querySelectorAll('.border').forEach(div => {
        div.classList.remove('border-primary', 'bg-blue-50');
        div.classList.add('border-gray-300');
    });
    document.querySelectorAll('.w-2.h-2').forEach(circle => {
        circle.classList.add('hidden');
    });
    document.getElementById('priceDisplay').classList.add('hidden');
    
    // Reset form fields
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerAddress').value = '';
    
    // Reset validation
    document.querySelectorAll('.border-red-500').forEach(field => {
        field.classList.remove('border-red-500');
    });
    
    // Reset submit button
    checkFormCompletion();
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 