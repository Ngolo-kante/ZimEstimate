// Gemini Vision API Client
// Wrapper for Google's Generative AI for floor plan analysis

import { GoogleGenerativeAI } from '@google/generative-ai';
import { VisionAnalysisResult, DetectedRoom, DetectedWall } from './types';

// Lazy initialization of Gemini client
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// Floor plan analysis prompt
const FLOOR_PLAN_PROMPT = `You are an expert architectural floor plan analyzer. Analyze this floor plan image and extract detailed room information.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation, just the JSON object.

Extract and return the following information in this exact JSON format:
{
  "rooms": [
    {
      "name": "Room Name",
      "width": 5.2,
      "length": 4.0,
      "x": 10,
      "y": 15,
      "w": 30,
      "h": 25,
      "wallType": "external"
    }
  ],
  "doors": 8,
  "windows": 12,
  "confidence": 85
}

Rules for extraction:
1. "name" - Identify room types: Living Room, Bedroom 1/2/3, Kitchen, Bathroom, Toilet, Corridor, Garage, etc.
2. "width" and "length" - Dimensions in METERS. If dimensions are shown, use them. If not, estimate based on typical Zimbabwean house sizes (bedrooms ~3x4m, living ~5x6m, bathrooms ~2x2m).
3. "x", "y", "w", "h" - Position and size as PERCENTAGE of the image (0-100). This is for overlay rendering.
4. "wallType" - "external" for perimeter walls, "internal" for partition walls.
5. "doors" - Count all door symbols/openings.
6. "windows" - Count all window symbols.
7. "confidence" - Your confidence in the accuracy (0-100):
   - 90-100: Clear technical drawing with dimensions marked
   - 70-89: Clear layout but some dimensions estimated
   - 50-69: Blurry or partial plan, significant estimation
   - Below 50: Very unclear, mostly guesswork

If the image is not a floor plan, return: {"error": "This does not appear to be a floor plan", "confidence": 0}`;

// Parse Gemini response into structured data
function parseGeminiResponse(text: string): {
  rooms: Array<{
    name: string;
    width: number;
    length: number;
    x: number;
    y: number;
    w: number;
    h: number;
    wallType: 'external' | 'internal';
  }>;
  doors: number;
  windows: number;
  confidence: number;
  error?: string;
} {
  try {
    // Remove any markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (e) {
    console.error('Failed to parse Gemini response:', e, 'Raw text:', text);
    return {
      rooms: [],
      doors: 0,
      windows: 0,
      confidence: 0,
      error: 'Failed to parse AI response',
    };
  }
}

// Generate unique IDs
function generateId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Demo mode fallback data (used when API quota is exceeded)
function getDemoAnalysisResult(): VisionAnalysisResult {
  const demoRooms: DetectedRoom[] = [
    { id: 'demo_1', name: 'Living Room', dimensions: { width: 5.5, length: 4.5 }, area: 24.75, position: { x: 5, y: 5, width: 35, height: 30 }, wallType: 'external', isEdited: false },
    { id: 'demo_2', name: 'Master Bedroom', dimensions: { width: 4.0, length: 4.0 }, area: 16, position: { x: 45, y: 5, width: 25, height: 25 }, wallType: 'external', isEdited: false },
    { id: 'demo_3', name: 'Bedroom 2', dimensions: { width: 3.5, length: 3.5 }, area: 12.25, position: { x: 45, y: 35, width: 22, height: 22 }, wallType: 'external', isEdited: false },
    { id: 'demo_4', name: 'Kitchen', dimensions: { width: 4.0, length: 3.0 }, area: 12, position: { x: 5, y: 40, width: 25, height: 20 }, wallType: 'internal', isEdited: false },
    { id: 'demo_5', name: 'Bathroom', dimensions: { width: 2.5, length: 2.5 }, area: 6.25, position: { x: 75, y: 5, width: 18, height: 18 }, wallType: 'internal', isEdited: false },
    { id: 'demo_6', name: 'Corridor', dimensions: { width: 6.0, length: 1.2 }, area: 7.2, position: { x: 35, y: 60, width: 40, height: 8 }, wallType: 'internal', isEdited: false },
  ];

  return {
    rooms: demoRooms,
    walls: generateWallsFromRooms(demoRooms),
    totalArea: demoRooms.reduce((sum, r) => sum + r.area, 0),
    doors: 7,
    windows: 10,
    confidence: 85,
    imageWidth: 100,
    imageHeight: 100,
    rawResponse: 'Demo mode - API quota exceeded',
  };
}

// Analyze floor plan image
export async function analyzeFloorPlan(
  imageBase64: string,
  mimeType: string
): Promise<VisionAnalysisResult> {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      FLOOR_PLAN_PROMPT,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ]);

    const response = result.response;
    const text = response.text();
    const parsed = parseGeminiResponse(text);

    if (parsed.error) {
      return {
        rooms: [],
        walls: [],
        totalArea: 0,
        doors: 0,
        windows: 0,
        confidence: parsed.confidence || 0,
        imageWidth: 0,
        imageHeight: 0,
        rawResponse: text,
      };
    }

    // Convert parsed rooms to DetectedRoom format
    const rooms: DetectedRoom[] = parsed.rooms.map((room, index) => ({
      id: generateId(),
      name: room.name || `Room ${index + 1}`,
      dimensions: {
        width: room.width || 4,
        length: room.length || 4,
      },
      area: (room.width || 4) * (room.length || 4),
      position: {
        x: room.x || 10 + index * 15,
        y: room.y || 10 + index * 10,
        width: room.w || 20,
        height: room.h || 20,
      },
      wallType: room.wallType || 'internal',
      isEdited: false,
    }));

    // Generate walls from room perimeters
    const walls: DetectedWall[] = generateWallsFromRooms(rooms);

    // Calculate total area
    const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);

    return {
      rooms,
      walls,
      totalArea,
      doors: parsed.doors || 0,
      windows: parsed.windows || 0,
      confidence: parsed.confidence || 50,
      imageWidth: 100,
      imageHeight: 100,
      rawResponse: text,
    };
  } catch (error) {
    console.error('Gemini API error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Provide more specific error messages or fallback to demo
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        throw new Error('Invalid API key. Please check your GOOGLE_GEMINI_API_KEY.');
      }
      if (error.message.includes('quota') || error.message.includes('rate') || error.message.includes('429')) {
        // Return demo data so the user can still test the feature
        return getDemoAnalysisResult();
      }
      if (error.message.includes('blocked') || error.message.includes('safety')) {
        throw new Error('Image was blocked by safety filters. Please try a different image.');
      }
    }

    throw new Error('Failed to analyze floor plan. Please try again.');
  }
}

// Generate wall segments from room definitions
function generateWallsFromRooms(rooms: DetectedRoom[]): DetectedWall[] {
  const walls: DetectedWall[] = [];

  rooms.forEach((room) => {
    const { x, y, width: w, height: h } = room.position;
    const wallHeight = 2.7; // Default wall height

    // Calculate wall lengths based on room dimensions
    const roomWidth = room.dimensions.width;
    const roomLength = room.dimensions.length;

    // Top wall
    walls.push({
      id: `wall_${room.id}_top`,
      startPoint: { x, y },
      endPoint: { x: x + w, y },
      length: roomWidth,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });

    // Right wall
    walls.push({
      id: `wall_${room.id}_right`,
      startPoint: { x: x + w, y },
      endPoint: { x: x + w, y: y + h },
      length: roomLength,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });

    // Bottom wall
    walls.push({
      id: `wall_${room.id}_bottom`,
      startPoint: { x: x + w, y: y + h },
      endPoint: { x, y: y + h },
      length: roomWidth,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });

    // Left wall
    walls.push({
      id: `wall_${room.id}_left`,
      startPoint: { x, y: y + h },
      endPoint: { x, y },
      length: roomLength,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });
  });

  return walls;
}

// Convert file to base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
