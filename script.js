// Global variables to store application state
let selectedFile = null; // Stores the currently selected file object
let fileData = null;     // Stores processed data (mass, volume) received from the API for the selected file
let selectedTechnology = null; // Stores the chosen printing technology ('FDM' or 'Resin')
let orderData = {};      // Stores all compiled order details before submission

// Base URL for the backend API
const API_BASE_URL = 'https://inne-production.up.railway.app';

// Image URLs for different technologies
const TECH_IMAGES = {
    FDM: {
        src: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/FDM_3D_Printer.jpg
',
        description: 'Công nghệ FDM (Fused Deposition Modeling) sử dụng sợi nhựa nhiệt dẻo để tạo ra các lớp vật thể. Phù hợp cho các mô hình lớn, chức năng và chi phí thấp.'
    },
    Resin: {
        src: 'https://placehold.co/300x200/e0f2f7/000000?text=Resin+Machine',
        description: 'Công nghệ Resin (SLA/DLP) sử dụng nhựa lỏng được làm cứng bằng tia UV. Tạo ra các vật thể có độ chi tiết cao, bề mặt mịn, lý tưởng cho mô hình nghệ thuật và trang sức.'
    }
};

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeFileUpload();    // Set up file upload event listeners
    initializeFormValidation(); // Set up form input validation
});

// --- File Upload Functions ---

/**
 * Initializes event listeners for the file upload area.
 */
function initializeFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');

    // Listen for changes on the hidden file input (when a file is selected via click)
    fileInput.addEventListener('change', handleFileSelect);

    // Add drag and drop event listeners to the file upload area
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleDrop);
}

/**
 * Handles file selection from the input element.
 * @param {Event} event - The change event from the file input.
 */
function handleFileSelect(event) {
    const file = event.target.files[0]; // Get the first selected file
    if (file) {
        processFile(file); // Process the file if one is selected
    }
}

/**
 * Handles the 'dragover' event for the file upload area.
 * Prevents default behavior to allow dropping and adds a visual indicator.
 * @param {Event} event - The dragover event.
 */
function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow a drop
    event.currentTarget.classList.add('dragover'); // Add visual feedback
}

/**
 * Handles the 'dragleave' event for the file upload area.
 * Removes the visual indicator when the dragged item leaves the area.
 * @param {Event} event - The dragleave event.
 */
function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover'); // Remove visual feedback
}

/**
 * Handles the 'drop' event for the file upload area.
 * Processes the dropped file if it's of a valid type.
 * @param {Event} event - The drop event.
 */
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover'); // Remove visual feedback

    const files = event.dataTransfer.files; // Get files from the drop event
    if (files.length > 0) {
        const file = files[0];
        // Check if the file extension is .stl or .obj (case-insensitive)
        if (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.obj')) {
            processFile(file); // Process the valid file
        } else {
            showError('Vui lòng chọn file STL hoặc OBJ'); // Show error for invalid file type
        }
    }
}

/**
 * Processes the selected file: updates UI, shows loading, and initiates upload.
 * @param {File} file - The file object to be processed.
 */
function processFile(file) {
    selectedFile = file; // Store the selected file globally

    // Update UI to show file name and summary
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('summaryFileName').textContent = file.name;
    document.getElementById('fileInfo').classList.remove('hidden'); // Show file info block

    // Show loading indicator and hide previous results
    document.getElementById('uploadLoading').classList.add('active');
    document.getElementById('fileResults').classList.add('hidden');

    uploadFile(file); // Start the file upload process
}

/**
 * Uploads the file to the backend API for processing (mass/volume calculation).
 * @param {File} file - The file to upload.
 */
function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file); // Append the file to form data

    fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData // Send the file as multipart/form-data
    })
    .then(response => {
        // Check if the response was successful (status code 2xx)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json(); // Parse the JSON response
    })
    .then(data => {
        fileData = data; // Store the processed file data (mass, volume)
        displayFileResults(data); // Display the results on the UI
        document.getElementById('uploadLoading').classList.remove('active'); // Hide loading
        checkFormCompletion(); // Re-check form completion to enable/disable submit button
    })
    .catch(error => {
        console.error('Upload error:', error);
        document.getElementById('uploadLoading').classList.remove('active'); // Hide loading on error
        showError('Lỗi khi tải file lên. Vui lòng thử lại.'); // Show user-friendly error message
    });
}

/**
 * Displays the processed file results (mass and volume) on the UI.
 * @param {Object} data - Object containing mass_grams and volume_cm3.
 */
function displayFileResults(data) {
    // Format and display mass and volume, rounding to 2 decimal places
    document.getElementById('fileMass').textContent = `${data.mass_grams.toFixed(2)} grams`;
    document.getElementById('fileVolume').textContent = `${data.volume_cm3.toFixed(2)} cm³`;
    document.getElementById('summaryMass').textContent = `${data.mass_grams.toFixed(2)} grams`; // Update summary panel
    document.getElementById('fileResults').classList.remove('hidden'); // Show the results block
}

/**
 * Removes the currently selected file and resets related UI elements.
 */
function removeFile() {
    selectedFile = null; // Clear selected file
    fileData = null;     // Clear file data
    document.getElementById('fileInput').value = ''; // Clear file input value
    document.getElementById('fileInfo').classList.add('hidden'); // Hide file info block
    document.getElementById('fileResults').classList.add('hidden'); // Hide file results block
    document.getElementById('uploadLoading').classList.remove('active'); // Hide loading
    document.getElementById('summaryFileName').textContent = 'Chưa có'; // Reset summary panel
    checkFormCompletion(); // Re-check form completion
}

// --- Technology Selection Functions ---

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
    // Update summary panel with the chosen technology's display name
    document.getElementById('summaryTechnology').textContent = technology === 'FDM' ? 'FDM (Nhựa)' : 'Resin (Nhựa lỏng)';
    
    // Display the corresponding technology image and description
    const techImageDisplay = document.getElementById('techImageDisplay');
    const techImage = document.getElementById('techImage');
    const techDescription = document.getElementById('techDescription');

    if (TECH_IMAGES[technology]) {
        techImage.src = TECH_IMAGES[technology].src;
        techImage.alt = `Máy in 3D ${technology}`;
        techDescription.textContent = TECH_IMAGES[technology].description;
        techImageDisplay.classList.remove('hidden');
        // Trigger reflow to restart animation
        void techImageDisplay.offsetWidth; 
        techImageDisplay.classList.add('active');
    } else {
        techImageDisplay.classList.remove('active');
        techImageDisplay.classList.add('hidden');
    }

    // If file data is available, calculate the price immediately
    if (fileData) {
        calculatePrice();
    }
    
    checkFormCompletion(); // Re-check form completion
}

/**
 * Calculates the estimated price based on file data and selected technology
 * by making an API call.
 */
function calculatePrice() {
    // Only proceed if both file data and technology are selected
    if (!fileData || !selectedTechnology) return;
    
    const requestData = {
        mass_grams: fileData.mass_grams,
        tech: selectedTechnology,
        material: selectedTechnology === 'FDM' ? 'PLA' : 'Resin' // Determine material based on technology
    };
    
    fetch(`${API_BASE_URL}/price`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json', // Specify content type as JSON
        },
        body: JSON.stringify(requestData) // Send data as JSON string
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        displayPrice(data.price); // Display the calculated price
    })
    .catch(error => {
        console.error('Price calculation error:', error);
        showError('Lỗi khi tính giá. Vui lòng thử lại.'); // Show error message
    });
}

/**
 * Displays the calculated price on the UI.
 * @param {number} price - The calculated price amount.
 */
function displayPrice(price) {
    // Format price to Vietnamese currency and display
    document.getElementById('priceAmount').textContent = `${price.toLocaleString('vi-VN')} VNĐ`;
    document.getElementById('priceDisplay').classList.remove('hidden'); // Show the price display block
}

// --- Form Validation and Submission ---

/**
 * Initializes event listeners for form input validation.
 */
function initializeFormValidation() {
    const inputs = ['customerName', 'customerPhone', 'customerAddress'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        // Listen for input changes to continuously check form completion
        input.addEventListener('input', checkFormCompletion);
        // Listen for blur event to validate field when user leaves it
        input.addEventListener('blur', validateField);
    });
}

/**
 * Validates a single form field and applies visual feedback.
 * @param {Event} event - The event object (e.g., 'blur' or 'input').
 * @returns {boolean} - True if the field is valid, false otherwise.
 */
function validateField(event) {
    const field = event.target;
    const value = field.value.trim(); // Get trimmed value
    const parent = field.closest('.form-input-group'); // Get the parent container for styling

    // Check if the field is required and empty
    if (field.hasAttribute('required') && !value) {
        parent.classList.add('border-red-500'); // Add red border for invalid state
        return false;
    } else {
        parent.classList.remove('border-red-500'); // Remove red border if valid
        return true;
    }
}

/**
 * Checks if all required form fields are filled and enables/disables the submit button accordingly.
 */
function checkFormCompletion() {
    // Check if essential data is present
    const hasFile = selectedFile !== null;
    const hasTechnology = selectedTechnology !== null;
    // Check if customer information fields are not empty
    const hasName = document.getElementById('customerName').value.trim() !== '';
    const hasPhone = document.getElementById('customerPhone').value.trim() !== '';
    const hasAddress = document.getElementById('customerAddress').value.trim() !== '';
    
    // Determine if the entire form is complete
    const isComplete = hasFile && hasTechnology && hasName && hasPhone && hasAddress;
    
    const submitBtn = document.getElementById('submitBtn');
    if (isComplete) {
        submitBtn.disabled = false; // Enable button
        // Apply active button styling
        submitBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
        submitBtn.classList.add('bg-accent', 'hover:bg-accent-dark', 'cursor-pointer');
    } else {
        submitBtn.disabled = true; // Disable button
        // Apply disabled button styling
        submitBtn.classList.remove('bg-accent', 'hover:bg-accent-dark', 'cursor-pointer');
        submitBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
    }
}

/**
 * Submits the order to the backend API after validating the form.
 */
function submitOrder() {
    // Perform final validation before submission
    if (!validateForm()) {
        return; // Stop if validation fails
    }
    
    // Compile all order data into an object
    orderData = {
        filename: selectedFile.name,
        mass_grams: fileData.mass_grams,
        volume_cm3: fileData.volume_cm3,
        
        technology: selectedTechnology,
        material: selectedTechnology === 'FDM' ? 'PLA' : 'Resin',
        
        customer_name: document.getElementById('customerName').value.trim(),
        customer_phone: document.getElementById('customerPhone').value.trim(),
        customer_address: document.getElementById('customerAddress').value.trim(),
        
        order_date: new Date().toISOString() // Add a timestamp for the order
    };
    
    // Show loading state on the submit button
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent; // Store original text to restore later
    submitBtn.textContent = 'Đang xử lý...';
    submitBtn.disabled = true; // Disable button during submission
    
    // Send order data to the backend API
    fetch(`${API_BASE_URL}/order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData) // Send order data as JSON
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        showSuccess(); // Show success message on successful order
    })
    .catch(error => {
        console.error('Order submission error:', error);
        showError('Lỗi khi đặt hàng. Vui lòng thử lại.'); // Show error message to user
        
        // Reset button state on error
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
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
    
    // Validate each customer information field
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        // Call validateField directly, passing a mock event target
        if (!validateField({ target: element })) {
            isValid = false;
        }
    });
    
    // Validate file upload
    if (!selectedFile) {
        showError('Vui lòng chọn file 3D');
        isValid = false;
    }
    
    // Validate technology selection
    if (!selectedTechnology) {
        showError('Vui lòng chọn công nghệ in');
        isValid = false;
    }
    
    return isValid;
}

// --- UI Utility Functions ---

/**
 * Displays the success message and hides the main form.
 */
function showSuccess() {
    document.getElementById('successMessage').classList.add('active'); // Show success message
    document.getElementById('mainForm').classList.add('hidden');       // Hide the main form
}

/**
 * Displays a temporary error notification.
 * @param {string} message - The error message to display.
 */
function showError(message) {
    // Remove any existing error notifications to prevent stacking
    const existingError = document.querySelector('.error-notification');
    if (existingError) existingError.remove();

    // Create a new error notification div
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv); // Add to the body
    
    // Set a timeout to remove the error message after 4 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.classList.add('animate-fade-out-up'); // Start fade-out animation
            // Remove the element from DOM after animation completes
            errorDiv.addEventListener('animationend', () => errorDiv.remove());
        }
    }, 4000);
}

/**
 * Resets the entire form to its initial state.
 */
function resetForm() {
    // Reset all global state variables
    selectedFile = null;
    fileData = null;
    selectedTechnology = null;
    orderData = {};
    
    // Hide success message and show main form
    document.getElementById('successMessage').classList.remove('active');
    document.getElementById('mainForm').classList.remove('hidden');
    
    // Reset file upload section by calling removeFile()
    removeFile();
    
    // Reset technology selection UI
    document.querySelectorAll('.tech-card').forEach(card => {
        card.classList.remove('selected');
        card.classList.remove('border-primary');
        card.classList.add('border-gray-300');
    });
    document.getElementById('priceDisplay').classList.add('hidden'); // Hide price display
    document.getElementById('summaryTechnology').textContent = 'Chưa chọn'; // Reset summary
    document.getElementById('summaryMass').textContent = '---'; // Reset summary
    
    // Hide and reset technology image display
    const techImageDisplay = document.getElementById('techImageDisplay');
    techImageDisplay.classList.remove('active');
    techImageDisplay.classList.add('hidden');
    document.getElementById('techImage').src = '';
    document.getElementById('techDescription').textContent = '';

    // Clear customer information form fields
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerAddress').value = '';
    
    // Remove any validation error borders
    document.querySelectorAll('.form-input-group').forEach(group => {
        group.classList.remove('border-red-500');
    });
    
    // Re-check form completion to set the submit button to its initial disabled state
    checkFormCompletion();
}
