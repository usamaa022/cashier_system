// lib/fileScanner.js - Enhanced file upload with scanner-like interface
export class FileScanner {
    constructor() {
      this.isAvailable = true; // File upload is always available
    }
  
    // Simulate scanner with file input
    async scanDocument() {
      return new Promise((resolve, reject) => {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.capture = 'environment'; // This might trigger camera on mobile devices
        
        fileInput.onchange = (event) => {
          const file = event.target.files[0];
          if (!file) {
            reject(new Error('No file selected'));
            return;
          }
  
          // Validate file
          if (!file.type.startsWith('image/')) {
            reject(new Error('Please select an image file'));
            return;
          }
  
          if (file.size > 5 * 1024 * 1024) { // 5MB limit
            reject(new Error('File size too large. Please select an image smaller than 5MB.'));
            return;
          }
  
          // Convert to base64
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              base64: reader.result,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size
            });
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        };
  
        fileInput.oncancel = () => {
          reject(new Error('Scan cancelled by user'));
        };
  
        // Trigger file selection
        fileInput.click();
      });
    }
  
    // Convert image to black and white using canvas
    async convertToBlackAndWhite(base64Image) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // Convert to grayscale
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = brightness;     // red
            data[i + 1] = brightness; // green
            data[i + 2] = brightness; // blue
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // Convert back to base64
          const bwBase64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve(bwBase64);
        };
        img.src = base64Image;
      });
    }
  
    // Enhanced scan with black and white conversion
    async scanAndConvertToBase64() {
      try {
        const scanResult = await this.scanDocument();
        
        // Convert to black and white
        const bwImage = await this.convertToBlackAndWhite(scanResult.base64);
        
        return {
          ...scanResult,
          base64: bwImage,
          fileName: `bw_scan_${Date.now()}.jpg`
        };
      } catch (error) {
        console.error('Scan error:', error);
        throw error;
      }
    }
  
    getStatus() {
      return {
        available: this.isAvailable,
        status: 'ready',
        type: 'file_upload'
      };
    }
  }
  
  export const fileScanner = new FileScanner();