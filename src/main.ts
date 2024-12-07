// Import and setup
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";
import { Coin, createGeocache, Geocache } from "./geocache.ts";

// Constants and parameters
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const NEIGHBORHOOD_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const MAX_COINS = 5;
const MIN_COINS = 1;
const MAX_INVENTORY_SIZE = 10;

// Global state
let playerLocation = OAKES_CLASSROOM;
const inventory: string[] = JSON.parse(
  localStorage.getItem("inventory") || "[]",
);
const cacheData: Record<string, string> = JSON.parse(
  localStorage.getItem("cacheData") || "{}",
);
const movementHistory: leaflet.LatLng[] = []; // To track movement history
let movementPolyline: leaflet.Polyline; // Polyline to represent the player's path
let isAutoUpdating = false; // Track whether automatic updating is active
let geoWatchId: number | null = null; // Store the watch ID

interface MovementCoordinate {
  lat: number;
  lng: number;
}

// Map setup
const map = leaflet.map("map", {
  center: playerLocation,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Tile layer setup
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Board setup
const board = new Board(TILE_WIDTH, NEIGHBORHOOD_RADIUS);

// UI elements
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;

// Cache data management
function ensureCacheExists(cell: Cell): Geocache {
  const key = `${cell.i},${cell.j}`;
  if (key in cacheData) {
    const memento = cacheData[key];
    const cache = createGeocache(0, 0);
    cache.fromMemento(memento); // Restore state
    return cache;
  } else {
    if (luck(key) >= CACHE_SPAWN_PROBABILITY) {
      throw new Error("No cache exists here.");
    }
    const numCoins = Math.floor(
      luck(key + "_coins") * (MAX_COINS - MIN_COINS + 1),
    ) + MIN_COINS;

    const cache = createGeocache(
      cell.i,
      cell.j,
      Array.from({ length: numCoins }, (_, idx) => ({
        i: cell.i,
        j: cell.j,
        number: idx,
      })),
    );

    cacheData[key] = cache.toMemento();
    saveGameState(); // Save state after mutation
    return cache;
  }
}

function updateCacheMemento(cache: Geocache) {
  const key = `${cache.i},${cache.j}`;
  cacheData[key] = cache.toMemento();
  saveGameState(); // Save state after mutation
}

// Game State Management
function saveGameState() {
  localStorage.setItem("playerLocation", JSON.stringify(playerLocation));
  localStorage.setItem("inventory", JSON.stringify(inventory));
  localStorage.setItem("cacheData", JSON.stringify(cacheData));
  localStorage.setItem(
    "movementHistory",
    JSON.stringify(
      movementHistory.map((point) => ({ lat: point.lat, lng: point.lng })),
    ),
  ); // Save movement history
}

function loadGameState() {
  const savedLocation = localStorage.getItem("playerLocation");
  if (savedLocation) {
    playerLocation = leaflet.latLng(JSON.parse(savedLocation));
  } else {
    playerLocation = OAKES_CLASSROOM;
  }

  const savedInventory = localStorage.getItem("inventory");
  if (savedInventory) {
    inventory.push(...JSON.parse(savedInventory));
  }

  const savedCacheData = localStorage.getItem("cacheData");
  if (savedCacheData) {
    Object.assign(cacheData, JSON.parse(savedCacheData));
  }

  // Load movement history from local storage
  const savedMovementHistory = localStorage.getItem("movementHistory");
  if (savedMovementHistory) {
    const loadedHistory: MovementCoordinate[] = JSON.parse(
      savedMovementHistory,
    ); // Use MovementCoordinate type
    movementHistory.push(
      ...loadedHistory.map((latLng) => leaflet.latLng(latLng.lat, latLng.lng)),
    );
  }

  // Center the map around the loaded player location
  map.setView(playerLocation, GAMEPLAY_ZOOM_LEVEL);
  updateCaches(); // Ensure caches and player are rendered based on loaded data

  // Update the polyline based on the loaded movement history
  updateMovementPolyline();
}

// Inventory Management
function addCoinToInventory(coin: string): boolean {
  if (inventory.length >= MAX_INVENTORY_SIZE) {
    console.warn("Inventory full!");
    showTemporaryPopup("Inventory full!");
    return false;
  }
  inventory.push(coin);
  saveGameState(); // Save state after mutation
  return true;
}

function updateInventoryUI() {
  inventoryPanel.innerHTML = `<h3>Inventory</h3><ul>`;
  inventory.forEach((coin) => {
    inventoryPanel.innerHTML += `<li>${coin}</li>`;
  });
  inventoryPanel.innerHTML += `</ul>`;
  updateStatus();
}

// UI Feedback Utilities
function showTemporaryPopup(message: string) {
  const notification = document.createElement("div");
  notification.innerText = message;
  notification.className = "notification";
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

function updateStatus() {
  statusPanel.innerText = `Coins: ${inventory.length}`;
}

// Map Caches Management
function renderCacheOnMap(cell: Cell) {
  const bounds = board.getCellBounds(cell);
  const cache = ensureCacheExists(cell);
  leaflet
    .rectangle(bounds)
    .addTo(map)
    .bindPopup(() => createPopupContent(cache, cell));
}

// Popup Rendering
function createPopupContent(cache: Geocache, cell: Cell): HTMLDivElement {
  const popupDiv = document.createElement("div");
  renderPopupContent(popupDiv, cache, cell);
  return popupDiv;
}

function renderPopupContent(
  popupDiv: HTMLDivElement,
  cache: Geocache,
  cell: Cell,
) {
  popupDiv.innerHTML = `
        <div>Cache at "${cell.i},${cell.j}"</div>
        <button id="collectCoin">Collect Coin</button>
        <button id="depositCoin">Deposit Coin</button>
        <div>Coins: ${cache.coins.map(formatCoin).join(", ")}</div>
    `;
  setupPopupEventListeners(popupDiv, cache, cell);
}

// Event Listeners for Popup Buttons
function setupPopupEventListeners(
  popupDiv: HTMLDivElement,
  cache: Geocache,
  cell: Cell,
) {
  popupDiv.querySelector<HTMLButtonElement>("#collectCoin")!.addEventListener(
    "click",
    () => {
      if (cache.coins.length > 0) {
        const coin = cache.coins.pop()!;
        if (!addCoinToInventory(formatCoin(coin))) {
          cache.coins.push(coin);
        }
        updateCacheMemento(cache); // Save state after mutation
        updateInventoryUI();
        renderPopupContent(popupDiv, cache, cell);
      }
    },
  );

  popupDiv.querySelector<HTMLButtonElement>("#depositCoin")!.addEventListener(
    "click",
    () => {
      if (inventory.length > 0) {
        const coinStr = inventory.pop()!;
        const [i, j, number] = coinStr.split(/[:#]/).map(Number);
        cache.coins.push({ i, j, number });
        updateCacheMemento(cache); // Save state after mutation
        updateInventoryUI();
        renderPopupContent(popupDiv, cache, cell);
      }
    },
  );
}

// Updating Caches on the Map
function updateCaches() {
  const visibleCells = board.getCellsNearPoint(playerLocation);
  map.eachLayer((layer: L.Layer) => {
    if (layer instanceof leaflet.Rectangle || layer instanceof leaflet.Marker) {
      map.removeLayer(layer);
    }
  });
  leaflet.marker(playerLocation, { title: "You are here" }).addTo(map);
  visibleCells.forEach((cell) => {
    try {
      renderCacheOnMap(cell);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(error.message);
      } else {
        console.warn("An unknown error occurred.");
      }
    }
  });
}

// Player Movement Logic
function movePlayer(dx: number, dy: number) {
  playerLocation = leaflet.latLng(
    playerLocation.lat + dy * TILE_WIDTH,
    playerLocation.lng + dx * TILE_WIDTH,
  );

  // Store the new location in history
  movementHistory.push(playerLocation); // Add the current position to history

  // Draw or update the polyline with the new movement history
  updateMovementPolyline();

  map.panTo(playerLocation);
  updateCaches();
  saveGameState(); // Save after player moves
}

// Function to update the movement polyline
function updateMovementPolyline() {
  // If the polyline already exists, remove it
  if (movementPolyline) {
    map.removeLayer(movementPolyline);
  }

  // Create a new polyline with the movement history
  movementPolyline = leaflet.polyline(movementHistory, {
    color: "blue", // Set color of the polyline
    weight: 5, // Thickness of the line
    opacity: 0.7, // Line transparency
  }).addTo(map); // Add the polyline to the map
}

// Movement Button Handlers
document.querySelector("#north")!.addEventListener(
  "click",
  () => movePlayer(0, 1),
);
document.querySelector("#south")!.addEventListener(
  "click",
  () => movePlayer(0, -1),
);
document.querySelector("#east")!.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.querySelector("#west")!.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);

// Utility Functions
function formatCoin(coin: Coin): string {
  return `${coin.i}:${coin.j}#${coin.number}`;
}

// Reset Game State Function
document.querySelector("#reset")!.addEventListener("click", resetGameState);
function resetGameState() {
  const confirmReset = confirm(
    "Are you sure you want to erase your game state?",
  ); // Ask for confirmation
  if (!confirmReset) {
    return; // If the user cancels, exit the function
  }
  stopAutoUpdate(); // Ensure automatic tracking is disabled when resetting

  // Clear inventory
  inventory.length = 0;

  // Reset cache data
  const keys = Object.keys(cacheData);
  keys.forEach((key) => {
    delete cacheData[key]; // Remove all caches
  });

  // Clear player location history
  playerLocation = OAKES_CLASSROOM;

  // Clear all local storage
  localStorage.removeItem("playerLocation");
  localStorage.removeItem("inventory");
  localStorage.removeItem("cacheData");

  // Clear movement history and polyline
  movementHistory.length = 0; // Reset movement history
  if (movementPolyline) {
    map.removeLayer(movementPolyline); // Remove polyline if it exists
  }

  // Center the map back to the initial location
  map.setView(playerLocation, GAMEPLAY_ZOOM_LEVEL);

  // Update the UI to reflect the reset state
  updateInventoryUI();
  updateStatus();
  updateCaches(); // Refresh caches to make sure they are rendered correctly
}

// Initialization logic
loadGameState();
updateInventoryUI();
updateStatus();

// Automatic Position Updating
document.querySelector("#sensor")!.addEventListener("click", () => {
  if (isAutoUpdating) {
    stopAutoUpdate();
    showTemporaryPopup("Automatic location updates stopped.");
  } else {
    startAutoUpdate();
    showTemporaryPopup("Automatic location updates started.");
  }
});

function startAutoUpdate() {
  if (!isAutoUpdating) {
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        playerLocation = leaflet.latLng(
          position.coords.latitude,
          position.coords.longitude,
        );
        movementHistory.push(playerLocation); // Save current position in history
        updateMovementPolyline(); // Update the polyline
        map.setView(playerLocation, GAMEPLAY_ZOOM_LEVEL); // Center map on updated location
        updateCaches(); // Update the map caches
        saveGameState(); // Save game state
      },
      (error) => {
        console.error("Geolocation error: ", error);
      },
      { enableHighAccuracy: true }, // High accuracy for better location tracking
    );
    isAutoUpdating = true; // Set the flag to true
  }
}

function stopAutoUpdate() {
  if (isAutoUpdating && geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId); // Stop tracking geolocation
    isAutoUpdating = false; // Set the flag to false
  }
}
