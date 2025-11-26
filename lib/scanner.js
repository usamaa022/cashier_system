// lib/scanner.js
export class EpsonScanner {
    constructor() {
      this.scanner = null;
      this.isConnected = false;
      this.isInitialized = false;
    }
  
    // Initialize the scanner
    async initializeScanner() {
      return new Promise((resolve, reject) => {
        try {
          // Load Epson ePOS SDK
          const script = document.createElement('script');
          script.src = '/epson-epos-sdk/epos-2.24.0.js';
          script.onload = () => {
            console.log('Epson ePOS SDK loaded successfully');
            this.isInitialized = true;
            resolve(true);
          };
          script.onerror = () => {
            console.error('Failed to load Epson ePOS SDK');
            reject(new Error('Failed to load Epson ePOS SDK'));
          };
          document.head.appendChild(script);
        } catch (error) {
          reject(error);
        }
      });
    }
  
    // Find and connect to scanner
    async connectScanner() {
      if (!this.isInitialized) {
        await this.initializeScanner();
      }
  
      return new Promise((resolve, reject) => {
        try {
          // Create scanner object
          this.scanner = new epson.ePOSDevice();
          
          // Device connection callback
          this.scanner.onconnect = () => {
            console.log('Scanner connected successfully');
            this.isConnected = true;
            resolve(true);
          };
          
          this.scanner.onerror = (error) => {
            console.error('Scanner connection error:', error);
            reject(new Error(`Scanner connection failed: ${error}`));
          };
          
          // Connect to device (you'll need to specify your scanner's IP address or USB ID)
          const deviceId = 'TCP:192.168.1.100'; // Replace with your scanner's IP
          // const deviceId = 'USB:'; // For USB connection
          
          this.scanner.connect(deviceId, {}, (result) => {
            if (result === 'OK') {
              console.log('Scanner connection initiated');
            } else {
              reject(new Error(`Scanner connection failed: ${result}`));
            }
          });
          
        } catch (error) {
          reject(new Error(`Scanner initialization error: ${error.message}`));
        }
      });
    }
  
    // Scan document
    async scanDocument() {
      if (!this.isConnected) {
        await this.connectScanner();
      }
  
      return new Promise((resolve, reject) => {
        try {
          // Create scanner object
          const scan = this.scanner.createScanner();
          
          scan.onscan = (data) => {
            console.log('Scan completed successfully');
            resolve(data);
          };
          
          scan.onerror = (error) => {
            console.error('Scan error:', error);
            reject(new Error(`Scan failed: ${error}`));
          };
          
          // Configure scan settings for black and white
          const settings = {
            color: 'BW', // Black and White
            resolution: 300,
            format: 'JPEG',
            compression: 80
          };
          
          console.log('Starting scan...');
          scan.scan(settings);
          
        } catch (error) {
          reject(new Error(`Scan error: ${error.message}`));
        }
      });
    }
  
    // Alternative method using browser's Image Capture API (for compatible scanners)
    async scanWithImageCapture() {
      try {
        // Get connected devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          throw new Error('No video devices found');
        }
  
        // Try to find a scanner device
        const scannerDevice = videoDevices.find(device => 
          device.label.toLowerCase().includes('scanner') || 
          device.label.toLowerCase().includes('epson')
        ) || videoDevices[0];
  
        // Get media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: scannerDevice.deviceId,
            width: { ideal: 2480 }, // A4 width at 300 DPI
            height: { ideal: 3508 } // A4 height at 300 DPI
          }
        });
  
        // Get video track
        const videoTrack = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);
  
        // Capture photo
        const blob = await imageCapture.takePhoto();
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
  
        return blob;
      } catch (error) {
        console.error('Image Capture error:', error);
        throw new Error(`Scanner not available: ${error.message}`);
      }
    }
  
    // Convert blob to base64
    async blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  
    // Main scan function
    async scanAndConvertToBase64() {
      try {
        let imageData;
        
        // Try Epson SDK first
        try {
          console.log('Attempting Epson SDK scan...');
          imageData = await this.scanDocument();
        } catch (sdkError) {
          console.log('Epson SDK failed, trying Image Capture API...');
          // Fallback to Image Capture API
          const blob = await this.scanWithImageCapture();
          imageData = await this.blobToBase64(blob);
        }
  
        const fileName = `scan_${Date.now()}.jpg`;
        
        return {
          base64: imageData,
          fileName: fileName,
          fileType: 'image/jpeg',
          fileSize: this.getBase64Size(imageData)
        };
      } catch (error) {
        console.error('All scan methods failed:', error);
        throw error;
      }
    }
  
    // Calculate base64 size
    getBase64Size(base64String) {
      if (base64String.startsWith('data:')) {
        base64String = base64String.split(',')[1];
      }
      return (base64String.length * 3) / 4 - (base64String.endsWith('==') ? 2 : base64String.endsWith('=') ? 1 : 0);
    }
  
    // Disconnect scanner
    async disconnectScanner() {
      if (this.scanner && this.isConnected) {
        try {
          this.scanner.disconnect();
          this.isConnected = false;
          console.log('Scanner disconnected');
        } catch (error) {
          console.error('Error disconnecting scanner:', error);
        }
      }
    }
  }
  
  // Singleton instance
  export const epsonScanner = new EpsonScanner();