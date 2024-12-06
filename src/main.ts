// Import and setup
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Constants and parameters
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const NEIGHBORHOOD_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const MAX_COINS = 5;
const MIN_COINS = 1;

// Global state
let playerLocation = OAKES_CLASSROOM;
const inventory: string[] = [];
const cacheData: Record<string, Geocache> = {};

// UI elements
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;

// Interfaces
interface Coin {
  i: number;
  j: number;
  number: number; // Unique identifier within a cache
}

interface Geocache {
  i: number;
  j: number;
  coins: Coin[];
}

// Factory function for Geocache
function createGeocache(i: number, j: number, coins: Coin[] = []): Geocache {
  return { i, j, coins };
}

// Utility functions
function formatCoin(coin: Coin): string {
  return `${coin.i}:${coin.j}#${coin.number}`;
}

function renderInventory() {
  inventoryPanel.innerHTML = `<h3>Inventory</h3><ul>`;
  inventory.forEach((coin) => {
    inventoryPanel.innerHTML += `<li>${coin}</li>`;
  });
  inventoryPanel.innerHTML += `</ul>`;
}

function updateStatus() {
  statusPanel.innerText = `Coins: ${inventory.length}`;
}

function spawnCache(cell: Cell) {
  const bounds = board.getCellBounds(cell);
  const key = `${cell.i},${cell.j}`;

  if (!(key in cacheData)) {
    if (luck(key) >= CACHE_SPAWN_PROBABILITY) return;
    const numCoins = Math.floor(
      luck(key + "_coins") * (MAX_COINS - MIN_COINS + 1),
    ) + MIN_COINS;
    cacheData[key] = createGeocache(
      cell.i,
      cell.j,
      Array.from({ length: numCoins }, (_, idx) => ({
        i: cell.i,
        j: cell.j,
        number: idx,
      })),
    );
  }

  const cache = cacheData[key];
  leaflet
    .rectangle(bounds)
    .addTo(map)
    .bindPopup(() => {
      const popupDiv = document.createElement("div");
      const coinList = cache.coins;
      popupDiv.innerHTML = `
        <div>Cache at "${cell.i},${cell.j}"</div>
        <button id="collectCoin">Collect Coin</button>
        <button id="depositCoin">Deposit Coin</button>
        <div>Coins: ${coinList.map(formatCoin).join(", ")}</div>`;

      popupDiv.querySelector<HTMLButtonElement>("#collectCoin")!
        .addEventListener("click", () => {
          if (coinList.length > 0) {
            const coin = coinList.pop()!;
            inventory.push(formatCoin(coin));
            renderInventory();
            updateStatus();

            popupDiv.innerHTML = `
            <div>Cache at "${cell.i},${cell.j}"</div>
            <button id="collectCoin">Collect Coin</button>
            <button id="depositCoin">Deposit Coin</button>
            <div>Coins: ${coinList.map(formatCoin).join(", ")}</div>`;
          }
        });

      popupDiv.querySelector<HTMLButtonElement>("#depositCoin")!
        .addEventListener("click", () => {
          if (inventory.length > 0) {
            const coinStr = inventory.pop()!;
            const [i, j, number] = coinStr.split(/[:#]/).map(Number);
            cache.coins.push({ i, j, number });
            renderInventory();
            updateStatus();

            popupDiv.innerHTML = `
            <div>Cache at "${cell.i},${cell.j}"</div>
            <button id="collectCoin">Collect Coin</button>
            <button id="depositCoin">Deposit Coin</button>
            <div>Coins: ${coinList.map(formatCoin).join(", ")}</div>`;
          }
        });
      return popupDiv;
    });
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
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Board and updates
const board = new Board(TILE_WIDTH, NEIGHBORHOOD_RADIUS);

function updateCaches() {
  const visibleCells = board.getCellsNearPoint(playerLocation);

  // Remove existing non-tile layers
  map.eachLayer((layer: L.Layer) => {
    if (layer instanceof leaflet.Rectangle || layer instanceof leaflet.Marker) {
      map.removeLayer(layer);
    }
  });

  // Re-add player marker
  const playerMarker = leaflet.marker(playerLocation, {
    title: "You are here",
  });
  playerMarker.addTo(map);

  // Add caches
  visibleCells.forEach((cell) => spawnCache(cell));
}

// Movement
function movePlayer(dx: number, dy: number) {
  playerLocation = leaflet.latLng(
    playerLocation.lat + dy * TILE_WIDTH,
    playerLocation.lng + dx * TILE_WIDTH,
  );
  map.panTo(playerLocation);
  updateCaches();
}

// Movement buttons
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

// Initialize
updateCaches();
renderInventory();
updateStatus();
