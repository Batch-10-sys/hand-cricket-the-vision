
// MediaPipe service for hand gesture recognition
export class MediaPipeService {
  private hands: any;
  private camera: any;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private gestureCallback: ((gesture: number) => void) | null = null;
  private isCalibrating: boolean = true;
  private isReady: boolean = false;
  private calibrationData: { handSize: number; thumbIndexDist: number } | null = null;
  private lastGestureDetected: number = 0;
  private gestureConfidence: { [key: number]: number } = {};
  private readonly gestureThreshold: number = 3; // Increased threshold for more reliability
  private cameraStartAttempts: number = 0;
  private maxCameraAttempts: number = 5; // Increased max attempts
  private lastFrameProcessed: number = 0;
  private processingFrameRate: number = 15; // Process at most 15 frames per second
  private stuckDetectionTimer: number | null = null;
  private lastLandmarkTime: number = 0;
  private noLandmarksTimeout: number | null = null;

  constructor() {
    // The actual Hands and Camera initialization will happen when initialize() is called
  }

  public initialize(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onGestureDetected: (gesture: number) => void
  ): void {
    if (!window.Hands || !window.Camera) {
      console.error("MediaPipe libraries not loaded yet");
      setTimeout(() => this.initialize(videoElement, canvasElement, onGestureDetected), 500);
      return;
    }

    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasCtx = canvasElement.getContext('2d');
    this.gestureCallback = onGestureDetected;
    
    // Create the hands object with optimized settings
    this.hands = new window.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // Optimize for performance over accuracy for smoother experience
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1, // Use medium complexity for better detection
      minDetectionConfidence: 0.6, // Higher threshold for more reliable detection
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results: any) => this.onResults(results));

    // Initialize camera
    this.initializeCamera();
    
    // Set up stuck detection
    this.setupStuckDetection();
    
    this.isReady = true;
    console.log("MediaPipe service initialized");
  }
  
  private initializeCamera(): void {
    try {
      this.cameraStartAttempts++;
      
      if (this.videoElement) {
        this.camera = new window.Camera(this.videoElement, {
          onFrame: async () => {
            // Only process frames at specified frame rate to improve performance
            const now = Date.now();
            if (now - this.lastFrameProcessed > 1000 / this.processingFrameRate) {
              this.lastFrameProcessed = now;
              if (this.videoElement && this.hands) {
                await this.hands.send({ image: this.videoElement });
              }
            }
          },
          width: 640,
          height: 480
        });
        
        this.camera.start().catch((err: any) => {
          console.error("Camera start error:", err);
          if (this.cameraStartAttempts < this.maxCameraAttempts) {
            // Try again with a delay
            setTimeout(() => this.initializeCamera(), 1000);
          }
        });
      }
    } catch (err) {
      console.error("Camera initialization error:", err);
      if (this.cameraStartAttempts < this.maxCameraAttempts) {
        // Try again with a delay
        setTimeout(() => this.initializeCamera(), 1000);
      }
    }
  }
  
  private setupStuckDetection(): void {
    // Check every 2 seconds if landmarks are being updated
    this.stuckDetectionTimer = window.setInterval(() => {
      const now = Date.now();
      // If no landmarks received for 3 seconds, try to restart camera
      if (now - this.lastLandmarkTime > 3000 && this.lastLandmarkTime !== 0) {
        console.log("Hand tracking appears to be stuck, restarting camera...");
        if (this.camera) {
          this.camera.stop();
        }
        
        // Clear any existing timeouts
        if (this.noLandmarksTimeout) {
          clearTimeout(this.noLandmarksTimeout);
          this.noLandmarksTimeout = null;
        }
        
        setTimeout(() => this.initializeCamera(), 500);
      }
    }, 2000);
  }

  public startCalibration(): void {
    this.isCalibrating = true;
    this.calibrationData = null;
    // Reset all gesture confidence levels
    this.gestureConfidence = {};
    this.lastGestureDetected = 0;
    console.log("Calibration started");
    
    // After 5 seconds, end calibration
    setTimeout(() => {
      this.isCalibrating = false;
      console.log("Calibration completed");
    }, 5000);
  }

  public isInitialized(): boolean {
    return this.isReady;
  }

  public stopCamera(): void {
    if (this.camera) {
      this.camera.stop();
    }
    
    if (this.stuckDetectionTimer) {
      clearInterval(this.stuckDetectionTimer);
      this.stuckDetectionTimer = null;
    }
    
    if (this.noLandmarksTimeout) {
      clearTimeout(this.noLandmarksTimeout);
      this.noLandmarksTimeout = null;
    }
  }

  private onResults(results: any): void {
    this.lastLandmarkTime = Date.now();
    
    // Clear any pending timeouts for "no landmarks"
    if (this.noLandmarksTimeout) {
      clearTimeout(this.noLandmarksTimeout);
      this.noLandmarksTimeout = null;
    }
    
    if (!this.canvasCtx || !this.canvasElement) return;
    
    // Clear canvas
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Draw camera feed (mirrored)
    if (this.videoElement) {
      this.canvasCtx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    // Draw hands with improved visibility
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        // Draw connections with increased visibility
        window.drawConnectors(this.canvasCtx, landmarks, window.HAND_CONNECTIONS, 
          { color: '#22c55e', lineWidth: 3 });
        
        // Draw landmarks with different colors for better visualization
        window.drawLandmarks(this.canvasCtx, landmarks.slice(0, 5), // Thumb landmarks
          { color: '#f59e0b', lineWidth: 2, radius: 4 });
        
        window.drawLandmarks(this.canvasCtx, landmarks.slice(5, 9), // Index finger
          { color: '#ef4444', lineWidth: 2, radius: 4 });
          
        window.drawLandmarks(this.canvasCtx, landmarks.slice(9, 13), // Middle finger
          { color: '#3b82f6', lineWidth: 2, radius: 4 });
          
        window.drawLandmarks(this.canvasCtx, landmarks.slice(13, 17), // Ring finger
          { color: '#8b5cf6', lineWidth: 2, radius: 4 });
          
        window.drawLandmarks(this.canvasCtx, landmarks.slice(17, 21), // Pinky
          { color: '#ec4899', lineWidth: 2, radius: 4 });
        
        // If we're calibrating, collect calibration data
        if (this.isCalibrating) {
          this.collectCalibrationData(landmarks);
        } 
        // Only detect gestures if not calibrating
        else if (this.gestureCallback) {
          const gesture = this.detectImprovedGesture(landmarks);
          
          // Only trigger callback if we're confident about the gesture
          if (gesture > 0) {
            // Implement confidence-based gesture detection
            this.processGestureWithConfidence(gesture);
          }
        }
      }
    } else {
      // No hand landmarks detected
      // If this persists for too long, we should try to restart the camera
      if (!this.noLandmarksTimeout) {
        this.noLandmarksTimeout = window.setTimeout(() => {
          console.log("No landmarks detected for an extended period, attempting to restart camera");
          if (this.camera) {
            this.camera.stop();
          }
          setTimeout(() => this.initializeCamera(), 500);
        }, 5000); // Wait 5 seconds of no landmarks before trying to restart
      }
    }
    
    this.canvasCtx.restore();
  }

  private collectCalibrationData(landmarks: any[]): void {
    if (!landmarks || landmarks.length < 21) return;
    
    // Calculate hand size (distance from wrist to middle finger tip)
    const wrist = landmarks[0];
    const middleTip = landmarks[12];
    const handSize = Math.sqrt(
      Math.pow(middleTip.x - wrist.x, 2) + 
      Math.pow(middleTip.y - wrist.y, 2) + 
      Math.pow(middleTip.z - wrist.z, 2)
    );
    
    // Calculate thumb-index separation
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const thumbIndexDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2) + 
      Math.pow(thumbTip.z - indexTip.z, 2)
    );
    
    this.calibrationData = {
      handSize,
      thumbIndexDist: thumbIndexDist * 0.7 // 70% of max separation as threshold
    };
  }

  // Improved confidence-based gesture detection
  private processGestureWithConfidence(gesture: number): void {
    // Reset confidence for other gestures
    for (const key in this.gestureConfidence) {
      if (parseInt(key) !== gesture) {
        this.gestureConfidence[parseInt(key)] = 0;
      }
    }
    
    // Increment confidence for the current gesture
    this.gestureConfidence[gesture] = (this.gestureConfidence[gesture] || 0) + 1;
    
    // If we've reached the threshold, trigger the callback
    if (this.gestureConfidence[gesture] >= this.gestureThreshold && 
        this.lastGestureDetected !== gesture) {
      this.lastGestureDetected = gesture;
      if (this.gestureCallback) {
        this.gestureCallback(gesture);
      }
      
      // Reset confidence after triggering
      setTimeout(() => {
        // Reset lastGestureDetected after a delay to allow for new gesture detection
        this.lastGestureDetected = 0;
        this.gestureConfidence = {};
      }, 1000);
    }
  }

  private detectImprovedGesture(landmarks: any[]): number {
    // Improved gesture detection optimized for Hand Cricket game
    if (!landmarks || landmarks.length < 21) return 0;
    
    // Fingertips and key joints
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    // MCP joints (knuckles)
    const indexMCP = landmarks[5];
    const middleMCP = landmarks[9];
    const ringMCP = landmarks[13];
    const pinkyMCP = landmarks[17];
    
    // PIP joints (middle joints)
    const indexPIP = landmarks[6];
    const middlePIP = landmarks[10];
    const ringPIP = landmarks[14];
    const pinkyPIP = landmarks[18];
    
    // Check if each finger is extended using improved criteria
    const isThumbUp = this.isFingerExtended(thumbTip, landmarks[3], landmarks[2], wrist, true);
    const isIndexExtended = this.isFingerExtended(indexTip, indexPIP, indexMCP, wrist);
    const isMiddleExtended = this.isFingerExtended(middleTip, middlePIP, middleMCP, wrist);
    const isRingExtended = this.isFingerExtended(ringTip, ringPIP, ringMCP, wrist);
    const isPinkyExtended = this.isFingerExtended(pinkyTip, pinkyPIP, pinkyMCP, wrist);
    
    // Count extended fingers (excluding thumb)
    const extendedFingerCount = 
      (isIndexExtended ? 1 : 0) + 
      (isMiddleExtended ? 1 : 0) + 
      (isRingExtended ? 1 : 0) + 
      (isPinkyExtended ? 1 : 0);
    
    // GESTURE DETECTION LOGIC:
    
    // Gesture 6: Only thumb up (👍) - more strict check
    if (isThumbUp && extendedFingerCount === 0) {
      return 6;
    }
    
    // Gesture 5: Open hand with all fingers extended
    if (extendedFingerCount >= 4) {
      return 5;
    }
    
    // Gesture 1-4: Number of extended fingers (excluding thumb)
    if (extendedFingerCount > 0 && extendedFingerCount <= 4) {
      return extendedFingerCount;
    }
    
    // Default - no recognized gesture
    return 0;
  }
  
  // Improved finger extension detection
  private isFingerExtended(
    tipLandmark: any, 
    pipLandmark: any, 
    mcpLandmark: any, 
    wristLandmark: any,
    isThumb: boolean = false
  ): boolean {
    if (isThumb) {
      // For thumb, we need special detection since it moves differently
      // Check if thumb is pointing up
      const thumbUp = tipLandmark.y < pipLandmark.y - 0.05;
      
      // Check if thumb is not curled in (comparing z coordinates)
      const notCurled = Math.abs(tipLandmark.z - pipLandmark.z) < 0.1;
      
      // For thumbs-up, we want the thumb extended upward
      return thumbUp && notCurled;
    } else {
      // For other fingers:
      // 1. Check if finger tip is higher (smaller y) than the PIP joint with a bigger margin
      const isHigherThanPIP = tipLandmark.y < pipLandmark.y - 0.07;
      
      // 2. Check if the fingertip is extended outward (not curled)
      const isForward = Math.abs(tipLandmark.z - pipLandmark.z) < 0.07;
      
      // More strict criteria for finger extension
      return isHigherThanPIP && isForward;
    }
  }
}

// Add global type declarations for MediaPipe
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

export const mediaPipeService = new MediaPipeService();
